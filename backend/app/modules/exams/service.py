import asyncio
import logging
import os
import tempfile
from datetime import timedelta
from pathlib import Path

from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import as_utc, utcnow
from app.core.config import get_settings
from app.modules.exams.file_parser import parse_file
from app.modules.exams.grading import all_questions, grade
from app.modules.exams.repository import ExamRepository
from app.modules.exams.schema import UpdateExamIn
from app.modules.leaderboard.service import XpService
from app.modules.speaking.service import sniff_audio

logger = logging.getLogger("app.exams")
MAX_EXAM_FILE, MAX_AUDIO, GRACE_SECONDS = 15 * 1024 * 1024, 80 * 1024 * 1024, 30
MIME_BY_EXT = {"webm": "audio/webm", "ogg": "audio/ogg", "wav": "audio/wav", "mp3": "audio/mpeg", "m4a": "audio/mp4"}
_BACKEND_DIR = Path(__file__).resolve().parents[3]


def audio_path(exam_id: str, ext: str) -> Path:
    base = Path(get_settings().storage_dir)
    return (base if base.is_absolute() else _BACKEND_DIR / base) / "exam_audio" / f"{exam_id}.{ext}"  # server-made name only


def question_count(groups: list[dict]) -> int:
    return sum(len(g["questions"]) for g in groups)


def public_exam(exam: dict) -> dict:
    """What a student may see BEFORE submitting: no answer keys, no explanations, no transcript."""
    groups = [{**g, "questions": [{k: v for k, v in q.items() if k not in ("correct", "explanation")} for q in g["questions"]]} for g in exam["groups"]]
    return {"id": exam["id"], "title": exam["title"], "duration_minutes": exam["duration_minutes"], "total_score": exam["total_score"],
            "question_count": exam.get("question_count", question_count(exam["groups"])), "has_audio": bool(exam.get("audio")), "groups": groups}


def summary(exam: dict) -> dict:
    return {k: exam.get(k) for k in ("id", "title", "duration_minutes", "total_score", "status", "question_count", "created_at")} | {
        "has_audio": bool(exam.get("audio")), "source_filename": exam.get("source_filename", ""),
        "has_listening": bool(exam.get("has_listening"))}


class ExamService:
    def __init__(self, repo: ExamRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    # ================= teacher / admin =================
    async def create_from_upload(self, admin_id: str, filename: str, content: bytes) -> dict:
        ext = Path(filename or "").suffix.lower()
        if ext not in (".docx", ".pdf"):
            raise AppException(400, "UNSUPPORTED_FILE", "Only .docx or .pdf files are supported")
        if not content or len(content) > MAX_EXAM_FILE:
            raise AppException(413, "INVALID_FILE_SIZE", "File must be between 1 byte and 15MB")
        magic_ok = content[:2] == b"PK" if ext == ".docx" else content[:5] == b"%PDF-"
        if not magic_ok:
            raise AppException(400, "UNSUPPORTED_FILE", "The file content does not match its extension")
        fd, tmp = tempfile.mkstemp(suffix=ext)  # the client's filename is never used as a path
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(content)
            parsed = await asyncio.to_thread(parse_file, tmp, filename)
        except ValueError as exc:
            raise AppException(400, "PARSE_ERROR", str(exc)) from exc
        except ImportError as exc:
            raise AppException(501, "PARSER_UNAVAILABLE", "Install the parsers: pip install python-docx pdfplumber") from exc
        finally:
            Path(tmp).unlink(missing_ok=True)
        groups = parsed["groups"]
        return await self.repo.create_exam({
            "title": parsed["title"], "duration_minutes": parsed["duration_minutes"], "total_score": parsed["total_score"],
            "transcript": parsed.get("transcript", ""), "warnings": parsed.get("warnings", []), "groups": groups, "status": "draft",
            "question_count": question_count(groups), "has_listening": any(g["kind"] == "listening" for g in groups),
            "audio": None, "source_filename": Path(filename).name[:200], "created_by": admin_id})

    async def manage_get(self, exam_id: str) -> dict:
        exam = await self.repo.get_exam(exam_id)
        if not exam:
            raise NotFoundError("EXAM_NOT_FOUND", "Exam not found")
        return exam

    async def manage_list(self) -> list[dict]:
        stats = await self.repo.stats_by_exam()
        return [{**summary(e), "attempts": stats.get(e["id"], {}).get("count", 0)} for e in await self.repo.list_exams(False)]

    async def update(self, exam_id: str, data: UpdateExamIn) -> dict:
        exam = await self.manage_get(exam_id)
        fields = data.model_dump(exclude_unset=True)
        groups = fields.get("groups", exam["groups"])
        numbers = [q["no"] for q in all_questions({"groups": groups})]
        if len(numbers) != len(set(numbers)):
            raise AppException(422, "DUPLICATE_QUESTION_NO", "Question numbers must be unique")
        if "groups" in fields:
            fields["question_count"] = question_count(groups)
            fields["has_listening"] = any(g["kind"] == "listening" for g in groups)
        if fields.get("status") == "published" and not any(q.get("correct") for q in all_questions({"groups": groups})):
            raise AppException(422, "NO_ANSWER_KEY", "Add the correct answer to at least one question before publishing")
        if fields:
            await self.repo.update_exam(exam_id, fields)
        return await self.manage_get(exam_id)

    async def delete(self, exam_id: str) -> None:
        exam = await self.manage_get(exam_id)
        if exam.get("audio"):
            await asyncio.to_thread(audio_path(exam_id, exam["audio"]["ext"]).unlink, True)
        await self.repo.delete_exam(exam_id)

    async def set_audio(self, exam_id: str, content: bytes) -> dict:
        exam = await self.manage_get(exam_id)
        ext = sniff_audio(content[:16]) if content else None
        if not content or len(content) > MAX_AUDIO or not ext:
            raise AppException(415, "UNSUPPORTED_AUDIO", "Upload an mp3, wav, m4a or ogg file (max 80MB)")
        path = audio_path(exam_id, ext)
        path.parent.mkdir(parents=True, exist_ok=True)
        if exam.get("audio") and exam["audio"]["ext"] != ext:
            await asyncio.to_thread(audio_path(exam_id, exam["audio"]["ext"]).unlink, True)
        await asyncio.to_thread(path.write_bytes, content)
        await self.repo.update_exam(exam_id, {"audio": {"ext": ext, "size": len(content)}})
        return await self.manage_get(exam_id)

    async def remove_audio(self, exam_id: str) -> None:
        exam = await self.manage_get(exam_id)
        if exam.get("audio"):
            await asyncio.to_thread(audio_path(exam_id, exam["audio"]["ext"]).unlink, True)
            await self.repo.update_exam(exam_id, {"audio": None})

    async def attempts_of(self, exam_id: str) -> list[dict]:
        await self.manage_get(exam_id)
        rows = await self.repo.exam_attempts(exam_id)
        names = await self.repo.usernames([r["user_id"] for r in rows])
        return [{"id": r["id"], "username": names.get(r["user_id"], "?"), "status": r["status"], "started_at": r["started_at"],
                 "submitted_at": r.get("submitted_at"), "score": (r.get("result") or {}).get("score"),
                 "max_score": (r.get("result") or {}).get("max_score")} for r in rows]

    # ================= students =================
    async def student_list(self, user_id: str) -> list[dict]:
        mine = await self.repo.stats_by_exam(user_id)
        return [{**summary(e), "my": mine.get(e["id"])} for e in await self.repo.list_exams(True)]

    async def _visible(self, user: dict, exam_id: str) -> dict:
        exam = await self.repo.get_exam(exam_id)
        if not exam or (exam["status"] != "published" and user["role"] != "admin"):
            raise NotFoundError("EXAM_NOT_FOUND", "Exam not found")
        return exam

    async def public(self, user: dict, exam_id: str) -> dict:
        return public_exam(await self._visible(user, exam_id))

    async def audio_file(self, user: dict, exam_id: str) -> tuple[Path, str]:
        exam = await self._visible(user, exam_id)
        info = exam.get("audio")
        path = audio_path(exam_id, info["ext"]) if info else None
        if not path or not path.exists():
            raise NotFoundError("AUDIO_NOT_FOUND", "This exam has no audio")
        return path, MIME_BY_EXT.get(info["ext"], "application/octet-stream")

    @staticmethod
    def _timing(attempt: dict) -> dict:
        return {"started_at": as_utc(attempt["started_at"]).timestamp(), "deadline": as_utc(attempt["deadline"]).timestamp(),
                "server_now": utcnow().timestamp()}

    async def start(self, user: dict, exam_id: str) -> dict:
        exam = await self._visible(user, exam_id)
        open_attempt = await self.repo.open_attempt(user["id"], exam_id)
        if open_attempt:  # resume instead of starting a second attempt
            open_attempt = await self._finalize_if_expired(open_attempt, exam)
            if open_attempt["status"] == "in_progress":
                return await self._attempt_view(open_attempt, exam)
        now = utcnow()
        attempt = await self.repo.create_attempt({
            "exam_id": exam_id, "user_id": user["id"], "status": "in_progress", "answers": {}, "started_at": now,
            "deadline": now + timedelta(minutes=exam["duration_minutes"]), "result": None, "submitted_at": None})
        return await self._attempt_view(attempt, exam)

    async def _attempt_view(self, attempt: dict, exam: dict) -> dict:
        return {"id": attempt["id"], "exam_id": attempt["exam_id"], "status": attempt["status"], "answers": attempt.get("answers", {}),
                **self._timing(attempt), "exam": public_exam(exam)}

    async def _own(self, user: dict, attempt_id: str, allow_admin: bool = False) -> dict:
        attempt = await self.repo.get_attempt(attempt_id)
        if not attempt or (attempt["user_id"] != user["id"] and not (allow_admin and user["role"] == "admin")):
            raise NotFoundError("ATTEMPT_NOT_FOUND", "Attempt not found")
        return attempt

    async def _finalize_if_expired(self, attempt: dict, exam: dict) -> dict:
        if attempt["status"] == "in_progress" and utcnow() > as_utc(attempt["deadline"]) + timedelta(seconds=GRACE_SECONDS):
            await self._finish(attempt, exam, attempt.get("answers", {}))  # time is up: grade what was saved
            return await self.repo.get_attempt(attempt["id"])
        return attempt

    async def get_attempt(self, user: dict, attempt_id: str) -> dict:
        attempt = await self._own(user, attempt_id)
        exam = await self.repo.get_exam(attempt["exam_id"])
        if not exam:
            raise NotFoundError("EXAM_NOT_FOUND", "Exam not found")
        return await self._attempt_view(await self._finalize_if_expired(attempt, exam), exam)

    async def save_answers(self, user: dict, attempt_id: str, answers: dict) -> dict:
        attempt = await self._own(user, attempt_id)
        exam = await self.repo.get_exam(attempt["exam_id"])
        attempt = await self._finalize_if_expired(attempt, exam)
        if attempt["status"] != "in_progress":
            return {"status": attempt["status"]}
        await self.repo.save_answers(attempt_id, answers)
        return {"status": "in_progress", "saved": len(answers)}

    async def _finish(self, attempt: dict, exam: dict, answers: dict) -> dict:
        result = grade(exam, answers)
        first = await self.repo.previous_submissions(attempt["user_id"], attempt["exam_id"]) == 0
        if await self.repo.finish_attempt(attempt["id"], answers, result, utcnow()) and first and result["max_score"]:
            await self.xp.award(attempt["user_id"], "exam", round(result["score"] / result["max_score"] * 50), daily_cap=150)
        return result

    async def submit(self, user: dict, attempt_id: str, answers: dict | None) -> dict:
        attempt = await self._own(user, attempt_id)
        exam = await self.repo.get_exam(attempt["exam_id"])
        if attempt["status"] == "in_progress":
            late = utcnow() > as_utc(attempt["deadline"]) + timedelta(seconds=GRACE_SECONDS)
            await self._finish(attempt, exam, attempt.get("answers", {}) if late or answers is None else answers)
        return await self.result(user, attempt_id)

    async def result(self, user: dict, attempt_id: str) -> dict:
        attempt = await self._own(user, attempt_id, allow_admin=True)
        exam = await self.repo.get_exam(attempt["exam_id"])
        if not exam:
            raise NotFoundError("EXAM_NOT_FOUND", "Exam not found")
        attempt = await self._finalize_if_expired(attempt, exam)
        if attempt["status"] != "submitted":
            raise AppException(409, "NOT_SUBMITTED", "Submit the exam to see the result")
        # after submitting, the student may see the keys, explanations and transcript
        return {"id": attempt["id"], "status": "submitted", "result": attempt["result"], "answers": attempt["answers"],
                "submitted_at": as_utc(attempt["submitted_at"]).timestamp(),
                "exam": {**public_exam(exam), "groups": exam["groups"], "transcript": exam.get("transcript", "")}}
