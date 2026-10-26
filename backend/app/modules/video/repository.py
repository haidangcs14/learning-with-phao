from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow

NO_SENTENCES = {"sentences": 0}


class VideoRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.lessons, self.progress, self.reports = db["video_lessons"], db["video_progress"], db["video_reports"]

    async def create(self, doc: dict) -> dict:
        now = utcnow()
        doc = {**doc, "created_at": now, "updated_at": now}
        doc["_id"] = (await self.lessons.insert_one(doc)).inserted_id
        return serialize(doc)

    async def count_owned(self, user_id: str) -> int:
        return await self.lessons.count_documents({"owner_id": user_id})

    async def get(self, lesson_id: str):
        oid = to_oid(lesson_id)
        return serialize(await self.lessons.find_one({"_id": oid})) if oid else None

    async def list(self, user_id: str, admin: bool, level, q, skip: int, limit: int):
        query: dict = {} if admin else {"$or": [{"visibility": "public"}, {"owner_id": user_id}]}
        if level:
            query["level"] = level
        if q:
            query["title"] = {"$regex": q.replace("\\", "\\\\").replace(".", "\\.").replace("*", "\\*"), "$options": "i"}
        total = await self.lessons.count_documents(query)
        cur = self.lessons.find(query, NO_SENTENCES).sort("created_at", -1).skip(skip).limit(limit)
        return [serialize(x) async for x in cur], total

    async def update_sentence(self, lesson_id: str, no: int, fields: dict) -> None:
        sets = {f"sentences.{no - 1}.{k}": v for k, v in fields.items()}
        await self.lessons.update_one({"_id": to_oid(lesson_id)}, {"$set": {**sets, "updated_at": utcnow()}})
        await self.progress.update_many({"lesson_id": lesson_id}, {"$unset": {f"results.{no}": ""}})  # an edited line must be re-checked

    async def delete(self, lesson_id: str) -> None:
        await self.lessons.delete_one({"_id": to_oid(lesson_id)})
        await self.progress.delete_many({"lesson_id": lesson_id})
        await self.reports.delete_many({"lesson_id": lesson_id})

    # ---- progress
    async def get_progress(self, user_id: str, lesson_id: str) -> dict:
        return await self.progress.find_one({"user_id": user_id, "lesson_id": lesson_id}, {"_id": 0}) or {}

    async def progress_by_lesson(self, user_id: str, lesson_ids: list[str]) -> dict[str, dict]:
        cur = self.progress.find({"user_id": user_id, "lesson_id": {"$in": lesson_ids}}, {"_id": 0})
        return {p["lesson_id"]: p async for p in cur}

    async def save_answers(self, user_id: str, lesson_id: str, answers: dict, mode: str) -> None:
        await self.progress.update_one({"user_id": user_id, "lesson_id": lesson_id},
                                       {"$set": {"answers": answers, "mode": mode, "updated_at": utcnow()}}, upsert=True)

    async def save_result(self, user_id: str, lesson_id: str, no: int, answer: str, result: dict, mode: str, awarded: bool) -> None:
        update: dict = {"$set": {f"answers.{no}": answer, f"results.{no}": result, "mode": mode, "updated_at": utcnow()}}
        if awarded:
            update["$addToSet"] = {"awarded": no}
        await self.progress.update_one({"user_id": user_id, "lesson_id": lesson_id}, update, upsert=True)

    # ---- reports
    async def add_report(self, doc: dict) -> bool:
        if await self.reports.find_one({k: doc[k] for k in ("lesson_id", "no", "reporter_id")} | {"status": "open"}):
            return False
        await self.reports.insert_one({**doc, "status": "open", "created_at": utcnow()})
        return True

    async def open_report_counts(self) -> dict[str, int]:
        rows = self.reports.aggregate([{"$match": {"status": "open"}}, {"$group": {"_id": "$lesson_id", "n": {"$sum": 1}}}])
        return {r["_id"]: r["n"] async for r in rows}

    async def list_reports(self, status: str):
        return [serialize(r) async for r in self.reports.find({"status": status}).sort("created_at", -1).limit(200)]

    async def resolve_report(self, report_id: str) -> bool:
        oid = to_oid(report_id)
        return bool(oid) and (await self.reports.update_one({"_id": oid}, {"$set": {"status": "resolved", "resolved_at": utcnow()}})).matched_count == 1
