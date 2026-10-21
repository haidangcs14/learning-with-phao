import asyncio
import logging
import re
from pathlib import Path

from app.ai.providers import get_speaking_evaluator, get_stt
from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import utcnow
from app.core.config import get_settings
from app.modules.leaderboard.service import XpService
from app.modules.speaking.repository import SpeakingRepository

logger = logging.getLogger("app.speaking")

MAX_AUDIO_BYTES, MAX_DURATION = 10 * 1024 * 1024, 300.0
ALLOWED_MIME = {"audio/webm", "video/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg",
                "audio/mp4", "audio/x-m4a", "audio/m4a", "application/octet-stream"}
MIME_BY_EXT = {"webm": "audio/webm", "ogg": "audio/ogg", "wav": "audio/wav", "mp3": "audio/mpeg", "m4a": "audio/mp4"}


def sniff_audio(b: bytes) -> str | None:
    """Detect the real format from magic bytes (never trust the extension/MIME sent by the client)."""
    if b[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    if b[:4] == b"OggS":
        return "ogg"
    if b[:4] == b"RIFF" and b[8:12] == b"WAVE":
        return "wav"
    if b[:3] == b"ID3" or (len(b) > 1 and b[0] == 0xFF and b[1] & 0xE0 == 0xE0):
        return "mp3"
    if b[4:8] == b"ftyp":
        return "m4a"
    return None


def compute_metrics(transcript: str, duration: float) -> dict:
    words = re.findall(r"[A-Za-z']+", transcript)
    wpm = round(len(words) / (duration / 60)) if duration >= 3 and words else None
    return {"word_count": len(words), "unique_words": len({w.lower() for w in words}),
            "words_per_minute": wpm, "duration": round(duration, 1)}


_BACKEND_DIR = Path(__file__).resolve().parents[3]  # .../backend


def audio_path(session_id: str, ext: str) -> Path:
    base = Path(get_settings().storage_dir)
    if not base.is_absolute():  # anchor to the backend folder so recordings are found wherever uvicorn is started from
        base = _BACKEND_DIR / base
    return base / "audio" / f"{session_id}.{ext}"  # server-generated name only


class SpeakingService:
    def __init__(self, repo: SpeakingRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def create_session(self, user_id: str, topic_id: str) -> dict:
        topic = await self.repo.get_topic(topic_id)
        if not topic:
            raise NotFoundError("TOPIC_NOT_FOUND", "Topic not found")
        return await self.repo.create_session({
            "user_id": user_id, "topic_id": topic["id"], "topic_title": topic["title"], "prompt": topic["prompt"],
            "status": "created", "ai_status": "pending", "transcript": "", "metrics": None,
            "evaluation": None, "audio": None, "created_at": utcnow(), "submitted_at": None})

    async def submit_audio(self, user_id: str, session_id: str, content: bytes, content_type: str | None,
                           transcript: str, duration: float) -> dict:
        session = await self.repo.get_session(session_id, user_id)
        if not session:
            raise NotFoundError("SESSION_NOT_FOUND", "Session not found")
        if session["status"] != "created":
            raise AppException(409, "ALREADY_SUBMITTED", "Audio was already submitted for this session")
        if not content or len(content) > MAX_AUDIO_BYTES:
            raise AppException(413, "INVALID_AUDIO_SIZE", "Audio must be between 1 byte and 10MB")
        mime = (content_type or "").split(";")[0].strip().lower()
        ext = sniff_audio(content)
        if mime not in ALLOWED_MIME or not ext:
            raise AppException(415, "UNSUPPORTED_AUDIO", "Unsupported audio format")

        path = audio_path(session["id"], ext)
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, content)

        duration = max(0.0, min(duration, MAX_DURATION))
        transcript = transcript.strip()[:5000]  # what the browser heard: only a fallback
        stt, evaluator = get_stt(), get_speaking_evaluator()
        words: list[dict] = []
        engine, stt_failed = "browser", False
        if stt:
            try:
                heard = await stt.transcribe(str(path))
                words, engine = heard.get("words", []), heard.get("engine", "local")
                if heard.get("text"):
                    transcript = heard["text"].strip()[:5000]  # the server-side transcript is far more reliable than the browser's
                if heard.get("duration"):
                    duration = min(float(heard["duration"]), MAX_DURATION)
            except Exception:  # model missing, undecodable audio...: continue with whatever we have
                logger.exception("speech-to-text failed")
                stt_failed = True
        evaluation, ai_status = None, "not_configured"
        if stt or evaluator:
            if not transcript:
                ai_status = "failed" if stt_failed else "no_speech"
            elif evaluator:
                try:
                    evaluation = await evaluator.evaluate(prompt=session["prompt"], transcript=transcript, duration=duration, words=words)
                    evaluation.setdefault("method", {})["stt"] = engine
                    ai_status = "evaluated"
                except Exception:
                    logger.exception("speaking evaluation failed")
                    ai_status = "failed"
        fields = {"status": "evaluated" if evaluation else "submitted", "ai_status": ai_status,
                  "transcript": transcript, "metrics": compute_metrics(transcript, duration),
                  "evaluation": evaluation, "audio": {"ext": ext, "size": len(content)},
                  "submitted_at": utcnow()}
        await self.repo.update_session(session["id"], fields)
        xp = await self.xp.award(user_id, "speaking", 20, daily_cap=100)
        return {**session, **fields, "xp_awarded": xp}

    async def delete_session(self, user_id: str, session_id: str) -> None:
        session = await self.repo.get_session(session_id, user_id)
        if not session:
            raise NotFoundError("SESSION_NOT_FOUND", "Session not found")
        if session.get("audio"):
            await asyncio.to_thread(audio_path(session["id"], session["audio"]["ext"]).unlink, True)
        await self.repo.delete_session(session_id, user_id)
