from app.common.exceptions import NotFoundError
from app.common.mongo import utcnow
from app.modules.flashcards.repository import FlashcardRepository
from app.modules.flashcards.scheduler import schedule
from app.modules.leaderboard.service import XpService


class FlashcardService:
    def __init__(self, repo: FlashcardRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def add(self, user_id: str, word_id: str) -> None:
        if not await self.repo.word_exists(word_id):
            raise NotFoundError("WORD_NOT_FOUND", "Word not found")
        await self.repo.upsert_new(user_id, word_id, utcnow())

    async def due(self, user_id: str, limit: int) -> list[dict]:
        cards = await self.repo.due(user_id, utcnow(), limit)
        words = await self.repo.words_by_ids([c["word_id"] for c in cards])
        for c in cards:
            c["word"] = words.get(c["word_id"])
        return [c for c in cards if c["word"]]

    async def review(self, user_id: str, word_id: str, rating: str) -> dict:
        card = await self.repo.get(user_id, word_id)
        if not card:
            raise NotFoundError("CARD_NOT_FOUND", "Word is not in your learning list")
        update = schedule(card, rating, utcnow())
        await self.repo.apply_review(card["_id"], update)
        xp = await self.xp.award(user_id, "vocabulary", 1, daily_cap=100)
        return {**update, "xp_awarded": xp}

    async def stats(self, user_id: str) -> dict:
        return {"by_status": await self.repo.counts_by_status(user_id),
                "due": await self.repo.count_due(user_id, utcnow())}
