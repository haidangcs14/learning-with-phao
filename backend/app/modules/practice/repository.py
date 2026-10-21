import re

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize

SUMMARY_PROJECTION = {"text": 0, "script": 0, "questions": 0, "vocabulary": 0}


class PracticeRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.items, self.attempts = db["practice_items"], db["practice_attempts"]

    async def list(self, kind: str, level: str | None, topic: str | None, q: str | None, skip: int, limit: int):
        query: dict = {"kind": kind}
        if level:
            query["level"] = level
        if topic:
            query["topic"] = topic
        if q:
            query["title"] = {"$regex": re.escape(q), "$options": "i"}
        total = await self.items.count_documents(query)
        cur = self.items.find(query, SUMMARY_PROJECTION).sort([("level", 1), ("title", 1)]).skip(skip).limit(limit)
        return [serialize(d) async for d in cur], total

    async def get(self, kind: str, slug: str):
        return await self.items.find_one({"kind": kind, "slug": slug})

    async def best_by_slug(self, user_id: str, kind: str) -> dict[str, dict]:
        rows = self.attempts.aggregate([
            {"$match": {"user_id": user_id, "kind": kind}},
            {"$group": {"_id": "$slug", "correct": {"$max": "$correct"}, "total": {"$max": "$total"}}}])
        return {r["_id"]: {"correct": r["correct"], "total": r["total"]} async for r in rows}

    async def best_for(self, user_id: str, kind: str, slug: str) -> int:
        doc = await self.attempts.find_one({"user_id": user_id, "kind": kind, "slug": slug}, sort=[("correct", -1)])
        return doc["correct"] if doc else 0

    async def save_attempt(self, doc: dict) -> None:
        await self.attempts.insert_one(doc)
