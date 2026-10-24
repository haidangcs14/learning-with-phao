from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow

SUMMARY = {"groups": 0, "transcript": 0}


class ExamRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db, self.exams, self.attempts = db, db["exams"], db["exam_attempts"]

    # ---- exams
    async def create_exam(self, doc: dict) -> dict:
        now = utcnow()
        doc = {**doc, "created_at": now, "updated_at": now}
        doc["_id"] = (await self.exams.insert_one(doc)).inserted_id
        return serialize(doc)

    async def get_exam(self, exam_id: str):
        oid = to_oid(exam_id)
        return serialize(await self.exams.find_one({"_id": oid})) if oid else None

    async def list_exams(self, published_only: bool):
        q = {"status": "published"} if published_only else {}
        return [serialize(e) async for e in self.exams.find(q, SUMMARY).sort("created_at", -1)]

    async def update_exam(self, exam_id: str, fields: dict) -> None:
        await self.exams.update_one({"_id": to_oid(exam_id)}, {"$set": {**fields, "updated_at": utcnow()}})

    async def delete_exam(self, exam_id: str) -> None:
        await self.exams.delete_one({"_id": to_oid(exam_id)})
        await self.attempts.delete_many({"exam_id": exam_id})

    # ---- attempts
    async def create_attempt(self, doc: dict) -> dict:
        doc = dict(doc)
        doc["_id"] = (await self.attempts.insert_one(doc)).inserted_id
        return serialize(doc)

    async def get_attempt(self, attempt_id: str):
        oid = to_oid(attempt_id)
        return serialize(await self.attempts.find_one({"_id": oid})) if oid else None

    async def open_attempt(self, user_id: str, exam_id: str):
        return serialize(await self.attempts.find_one({"user_id": user_id, "exam_id": exam_id, "status": "in_progress"}))

    async def save_answers(self, attempt_id: str, answers: dict) -> bool:
        res = await self.attempts.update_one({"_id": to_oid(attempt_id), "status": "in_progress"}, {"$set": {"answers": answers}})
        return res.matched_count == 1

    async def finish_attempt(self, attempt_id: str, answers: dict, result: dict, now: datetime):
        """Atomic: only the first call wins, so a result can't be submitted twice."""
        doc = await self.attempts.find_one_and_update(
            {"_id": to_oid(attempt_id), "status": "in_progress"},
            {"$set": {"status": "submitted", "answers": answers, "result": result, "submitted_at": now}})
        return doc is not None

    async def previous_submissions(self, user_id: str, exam_id: str) -> int:
        return await self.attempts.count_documents({"user_id": user_id, "exam_id": exam_id, "status": "submitted"})

    async def exam_attempts(self, exam_id: str):
        return [serialize(a) async for a in self.attempts.find({"exam_id": exam_id}, {"answers": 0}).sort("started_at", -1).limit(500)]

    async def stats_by_exam(self, user_id: str | None = None) -> dict[str, dict]:
        match = {"status": "submitted", **({"user_id": user_id} if user_id else {})}
        rows = self.attempts.aggregate([{"$match": match}, {"$group": {
            "_id": "$exam_id", "best": {"$max": "$result.score"}, "count": {"$sum": 1}, "max": {"$max": "$result.max_score"}}}])
        return {r["_id"]: {"best": r["best"], "count": r["count"], "max": r["max"]} async for r in rows}

    async def usernames(self, ids: list[str]) -> dict[str, str]:
        oids = [o for o in (to_oid(i) for i in ids) if o]
        return {str(u["_id"]): u["username"] async for u in self.db["users"].find({"_id": {"$in": oids}}, {"username": 1})}
