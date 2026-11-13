from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import to_oid, utcnow


class StudyRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db, self.study, self.reports = db, db["word_study"], db["word_reports"]

    async def word(self, word_id: str):
        oid = to_oid(word_id)
        return await self.db["words"].find_one({"_id": oid}, {"word": 1, "topics": 1}) if oid else None

    async def record(self, user_id: str, word_id: str, topic: str, correct: bool) -> bool:
        """Returns True when the word has just become 'learned' for this user."""
        before = await self.study.find_one({"user_id": user_id, "word_id": word_id})
        update: dict = {"$set": {"topic": topic, "updated_at": utcnow()}, "$inc": {"correct" if correct else "wrong": 1}}
        if correct:
            update["$set"]["learned"] = True
        await self.study.update_one({"user_id": user_id, "word_id": word_id}, update, upsert=True)
        return correct and not (before and before.get("learned"))

    async def learned_by_topic(self, user_id: str) -> dict[str, int]:
        rows = self.study.aggregate([{"$match": {"user_id": user_id, "learned": True}}, {"$group": {"_id": "$topic", "n": {"$sum": 1}}}])
        return {r["_id"]: r["n"] async for r in rows}

    async def learned_ids(self, user_id: str, topic: str) -> list[str]:
        return [r["word_id"] async for r in self.study.find({"user_id": user_id, "topic": topic, "learned": True}, {"word_id": 1})]

    async def add_report(self, doc: dict) -> None:
        await self.reports.insert_one({**doc, "created_at": utcnow(), "status": "open"})
