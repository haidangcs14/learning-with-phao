import re

from app.ai.writing_eval import evaluate_writing
from app.common.exceptions import AppException, NotFoundError
from app.modules.leaderboard.service import XpService
from app.modules.writing.repository import WritingRepository

MIN_WORDS, MAX_CHARS, DAILY_CAP = 5, 6000, 60


class WritingService:
    def __init__(self, repo: WritingRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def submit(self, user_id: str, prompt_id: str | None, text: str) -> dict:
        text = text.strip()
        words = len(re.findall(r"[A-Za-z']+", text))
        if words < MIN_WORDS:
            raise AppException(400, "TEXT_TOO_SHORT", f"Write at least {MIN_WORDS} words")
        prompt = None
        if prompt_id:
            prompt = await self.repo.get_prompt(prompt_id)
            if not prompt:
                raise NotFoundError("PROMPT_NOT_FOUND", "Writing task not found")
        evaluation = await evaluate_writing(text, prompt)
        xp = await self.xp.award(user_id, "writing", round(evaluation["overall"] / 5), daily_cap=DAILY_CAP)
        doc = await self.repo.create({
            "user_id": user_id, "prompt_id": prompt_id, "title": (prompt or {}).get("title", ""), "level": (prompt or {}).get("level", ""),
            "instruction": (prompt or {}).get("instruction", ""), "text": text[:MAX_CHARS], "word_count": words,
            "evaluation": evaluation, "overall": evaluation["overall"]})
        return {**doc, "xp_awarded": xp}

    async def detail(self, user_id: str, sub_id: str) -> dict:
        doc = await self.repo.get(sub_id, user_id)
        if not doc:
            raise NotFoundError("SUBMISSION_NOT_FOUND", "Submission not found")
        return doc

    async def delete(self, user_id: str, sub_id: str) -> None:
        if not await self.repo.delete(sub_id, user_id):
            raise NotFoundError("SUBMISSION_NOT_FOUND", "Submission not found")
