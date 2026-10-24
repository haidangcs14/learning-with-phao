from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid


class FlashcardRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.progress, self.words = db["word_progress"], db["words"]

    async def word_exists(self, word_id: str) -> bool:
        oid = to_oid(word_id)
        return bool(oid) and await self.words.find_one({"_id": oid}, {"_id": 1}) is not None

    async def upsert_new(self, user_id: str, word_id: str, now) -> None:
        await self.progress.update_one(
            {"user_id": user_id, "word_id": word_id},
            {"$setOnInsert": {"status": "new", "ease": 2.5, "interval_days": 0, "repetitions": 0,
                              "lapses": 0, "review_count": 0, "next_review_at": now, "created_at": now}},
            upsert=True)

    async def due(self, user_id: str, now, limit: int) -> list[dict]:
        cur = self.progress.find({"user_id": user_id, "next_review_at": {"$lte": now}}) \
            .sort("next_review_at", 1).limit(limit)
        return [serialize(c) async for c in cur]

    async def words_by_ids(self, ids: list[str]) -> dict[str, dict]:
        oids = [o for o in (to_oid(i) for i in ids) if o]
        return {str(w["_id"]): serialize(w) async for w in self.words.find({"_id": {"$in": oids}})}

    async def get(self, user_id: str, word_id: str):
        return await self.progress.find_one({"user_id": user_id, "word_id": word_id})

    async def apply_review(self, card_id, update: dict) -> None:
        await self.progress.update_one({"_id": card_id}, {"$set": update, "$inc": {"review_count": 1}})

    async def counts_by_status(self, user_id: str) -> dict:
        return {r["_id"]: r["n"] async for r in self.progress.aggregate([
            {"$match": {"user_id": user_id}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}])}

    async def count_due(self, user_id: str, now) -> int:
        return await self.progress.count_documents({"user_id": user_id, "next_review_at": {"$lte": now}})

    async def word_ids_by_topic(self, topic: str, limit: int = 300) -> list[str]:
        return [str(w["_id"]) async for w in self.words.find({"topics": topic}, {"_id": 1}).limit(limit)]
