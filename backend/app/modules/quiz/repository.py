from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid


class QuizRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db, self.questions, self.attempts, self.sessions = db, db["questions"], db["quiz_attempts"], db["quiz_sessions"]

    async def sample(self, match: dict, limit: int) -> list[dict]:
        pipeline = [{"$match": match}, {"$sample": {"size": limit}},
                    {"$project": {"correct_answer": 0, "explanation": 0}}]  # never leak answers
        return [serialize(d) async for d in self.questions.aggregate(pipeline)]

    async def by_ids(self, ids: list[str]) -> dict[str, dict]:
        oids = [o for o in (to_oid(i) for i in ids) if o]
        return {str(q["_id"]): q async for q in self.questions.find({"_id": {"$in": oids}})}

    async def save_attempt(self, doc: dict) -> None:
        await self.attempts.insert_one(doc)

    async def history(self, user_id: str, skip: int, limit: int):
        q = {"user_id": user_id}
        total = await self.attempts.count_documents(q)
        cur = self.attempts.find(q).sort("created_at", -1).skip(skip).limit(limit)
        return [serialize(d) async for d in cur], total

    async def bank_topics(self) -> list[dict]:
        rows = self.questions.aggregate([{"$group": {"_id": "$topic", "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}])
        return [{"topic": r["_id"], "count": r["count"]} async for r in rows]

    async def words_pool(self, topic, level, limit: int) -> list[dict]:
        match: dict = {"meanings.0.translation_vi": {"$exists": True}}
        if topic:
            match["topics"] = topic
        if level:
            match["level"] = level
        return [w async for w in self.db["words"].aggregate([{"$match": match}, {"$sample": {"size": limit}}])]

    async def create_session(self, doc: dict) -> str:
        return str((await self.sessions.insert_one(doc)).inserted_id)

    async def close_session(self, session_id: str, user_id: str):
        """Atomic: a generated quiz can be submitted only once."""
        oid = to_oid(session_id)
        if not oid:
            return None
        return await self.sessions.find_one_and_update({"_id": oid, "user_id": user_id, "finished": False}, {"$set": {"finished": True}})
