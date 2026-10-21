from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid


class QuizRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.questions, self.attempts = db["questions"], db["quiz_attempts"]

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
