from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import to_oid
from app.modules.leaderboard.service import XpService
from app.modules.video.dictation import check_answer
from app.modules.video.repository import VideoRepository
from app.modules.video.schema import CheckIn, LessonCreate, ProgressIn, ReportIn, SentenceEdit
from app.modules.video.transcript import parse_transcript
from app.modules.video.youtube import parse_youtube_id

MAX_OWN_LESSONS, PASS_ACCURACY, DAILY_XP_CAP = 30, 60, 80


def completion(lesson_sentences: int, progress: dict) -> int:
    done = sum(1 for r in (progress.get("results") or {}).values() if r.get("accuracy", 0) >= PASS_ACCURACY)
    return round(100 * done / lesson_sentences) if lesson_sentences else 0


class VideoService:
    def __init__(self, repo: VideoRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def create(self, user: dict, data: LessonCreate) -> dict:
        video_id = parse_youtube_id(data.url)
        if not video_id:
            raise AppException(422, "INVALID_YOUTUBE_URL", "That is not a valid YouTube link")
        try:
            sentences = parse_transcript(data.transcript)
        except ValueError as exc:
            raise AppException(422, "INVALID_TRANSCRIPT", str(exc)) from exc
        if user["role"] != "admin" and await self.repo.count_owned(user["id"]) >= MAX_OWN_LESSONS:
            raise AppException(429, "LESSON_LIMIT", f"You can keep up to {MAX_OWN_LESSONS} video lessons")
        return await self.repo.create({
            "youtube_id": video_id, "title": data.title, "level": data.level, "category": data.category, "sentences": sentences,
            "owner_id": user["id"], "owner_name": user["username"], "visibility": "public" if user["role"] == "admin" else "private"})

    def _visible(self, user: dict, lesson: dict | None) -> dict:
        if not lesson or not (lesson["visibility"] == "public" or lesson["owner_id"] == user["id"] or user["role"] == "admin"):
            raise NotFoundError("LESSON_NOT_FOUND", "Video lesson not found")
        return lesson

    def _editable(self, user: dict, lesson: dict) -> None:
        if lesson["owner_id"] != user["id"] and user["role"] != "admin":
            raise AppException(403, "NOT_YOUR_LESSON", "Only the owner can edit this lesson: use “report an error” instead")

    async def list(self, user: dict, level, q, skip: int, limit: int):
        items, total = await self.repo.list(user["id"], user["role"] == "admin", level, q, skip, limit)
        items = await self._with_counts(items)
        progress = await self.repo.progress_by_lesson(user["id"], [i["id"] for i in items])
        return [{k: i[k] for k in ("id", "youtube_id", "title", "level", "category", "visibility", "owner_name", "sentence_count")}
                | {"mine": i["owner_id"] == user["id"], "completion": completion(i["sentence_count"], progress.get(i["id"], {}))} for i in items], total

    async def _with_counts(self, items: list[dict]) -> list[dict]:
        """The list query drops the heavy `sentences` array, so the counts come from a small aggregate."""
        oids = [to_oid(i["id"]) for i in items]
        counts = {str(r["_id"]): r["n"] async for r in self.repo.lessons.aggregate(
            [{"$match": {"_id": {"$in": oids}}}, {"$project": {"n": {"$size": "$sentences"}}}])}
        return [{**i, "sentence_count": counts.get(i["id"], 0)} for i in items]

    async def get(self, user: dict, lesson_id: str) -> dict:
        lesson = self._visible(user, await self.repo.get(lesson_id))
        progress = await self.repo.get_progress(user["id"], lesson_id)
        return {**lesson, "mine": lesson["owner_id"] == user["id"], "can_edit": lesson["owner_id"] == user["id"] or user["role"] == "admin",
                "progress": {"mode": progress.get("mode", "normal"), "answers": progress.get("answers", {}), "results": progress.get("results", {}),
                             "completion": completion(len(lesson["sentences"]), progress)}}

    async def edit_sentence(self, user: dict, lesson_id: str, no: int, data: SentenceEdit) -> dict:
        lesson = self._visible(user, await self.repo.get(lesson_id))
        self._editable(user, lesson)
        sentences = lesson["sentences"]
        if not 1 <= no <= len(sentences):
            raise NotFoundError("SENTENCE_NOT_FOUND", "Sentence not found")
        prev_start = sentences[no - 2]["start"] if no > 1 else 0
        next_start = sentences[no]["start"] if no < len(sentences) else None
        if data.start < prev_start or (next_start is not None and data.start >= next_start):
            raise AppException(422, "INVALID_TIMING", "The start time must stay between the previous and the next line")
        await self.repo.update_sentence(lesson_id, no, {"text": data.text, "start": round(data.start, 2), "end": round(data.end, 2)})
        return (await self.repo.get(lesson_id))["sentences"][no - 1]

    async def check(self, user: dict, lesson_id: str, data: CheckIn) -> dict:
        lesson = self._visible(user, await self.repo.get(lesson_id))
        if not 1 <= data.no <= len(lesson["sentences"]):
            raise NotFoundError("SENTENCE_NOT_FOUND", "Sentence not found")
        result = check_answer(lesson["sentences"][data.no - 1]["text"], data.answer)
        progress = await self.repo.get_progress(user["id"], lesson_id)
        first_pass = result["accuracy"] >= PASS_ACCURACY and data.no not in progress.get("awarded", [])
        xp = 0
        if first_pass:  # XP is calculated here, never sent by the client, and only once per sentence
            xp = await self.xp.award(user["id"], "video_listening", 2 + (2 if result["accuracy"] >= 90 else 0), daily_cap=DAILY_XP_CAP)
        summary = {k: result[k] for k in ("accuracy", "correct", "wrong", "missing", "total")}
        await self.repo.save_result(user["id"], lesson_id, data.no, data.answer, summary, data.mode, first_pass)
        done = {**progress.get("results", {}), str(data.no): summary}
        return {**result, "xp_awarded": xp, "completion": completion(len(lesson["sentences"]), {"results": done})}

    async def save_progress(self, user: dict, lesson_id: str, data: ProgressIn) -> None:
        self._visible(user, await self.repo.get(lesson_id))
        await self.repo.save_answers(user["id"], lesson_id, data.answers, data.mode)

    async def report(self, user: dict, lesson_id: str, data: ReportIn) -> None:
        lesson = self._visible(user, await self.repo.get(lesson_id))
        if not 1 <= data.no <= len(lesson["sentences"]):
            raise NotFoundError("SENTENCE_NOT_FOUND", "Sentence not found")
        ok = await self.repo.add_report({"lesson_id": lesson_id, "lesson_title": lesson["title"], "no": data.no, "reason": data.reason,
                                         "note": data.note, "reporter_id": user["id"], "reporter_name": user["username"]})
        if not ok:
            raise AppException(409, "ALREADY_REPORTED", "You already reported this line")

    async def delete(self, user: dict, lesson_id: str) -> None:
        lesson = self._visible(user, await self.repo.get(lesson_id))
        self._editable(user, lesson)
        await self.repo.delete(lesson_id)

    # ---- admin
    async def admin_list(self) -> list[dict]:
        items, _ = await self.repo.list("", True, None, None, 0, 500)
        counts, reports = await self._with_counts(items), await self.repo.open_report_counts()
        return [{k: i[k] for k in ("id", "youtube_id", "title", "level", "category", "visibility", "owner_name", "sentence_count")}
                | {"open_reports": reports.get(i["id"], 0)} for i in counts]

    async def resolve_report(self, report_id: str) -> None:
        if not await self.repo.resolve_report(report_id):
            raise NotFoundError("REPORT_NOT_FOUND", "Report not found")
