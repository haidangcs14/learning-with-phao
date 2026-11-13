from app.common.exceptions import NotFoundError
from app.modules.leaderboard.service import XpService
from app.modules.study.repository import StudyRepository

XP_PER_NEW_WORD, DAILY_CAP = 2, 60


class StudyService:
    def __init__(self, repo: StudyRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def answer(self, user_id: str, word_id: str, correct: bool) -> dict:
        word = await self.repo.word(word_id)
        if not word:
            raise NotFoundError("WORD_NOT_FOUND", "Word not found")
        topic = (word.get("topics") or [""])[0]
        new = await self.repo.record(user_id, word_id, topic, correct)
        xp = await self.xp.award(user_id, "vocabulary", XP_PER_NEW_WORD, daily_cap=DAILY_CAP) if new else 0  # only the first time a word is learned
        return {"newly_learned": new, "xp_awarded": xp}

    async def report(self, user: dict, word_id: str, reason: str, note: str) -> None:
        word = await self.repo.word(word_id)
        if not word:
            raise NotFoundError("WORD_NOT_FOUND", "Word not found")
        await self.repo.add_report({"word_id": word_id, "word": word["word"], "reason": reason, "note": note.strip(), "user_id": user["id"], "username": user["username"]})
