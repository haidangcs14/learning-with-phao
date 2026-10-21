from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow
from app.modules.leaderboard.service import period_start


class AdminRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def stats(self) -> dict:
        db, today = self.db, period_start("daily")
        dau = [{"date": r["_id"], "users": r["n"]} async for r in db["xp_events"].aggregate([
            {"$match": {"created_at": {"$gte": today - timedelta(days=13)}}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                        "u": {"$addToSet": "$user_id"}}},
            {"$project": {"n": {"$size": "$u"}}}, {"$sort": {"_id": 1}}])]
        return {
            "users": await db["users"].count_documents({}),
            "new_users_7d": await db["users"].count_documents({"created_at": {"$gte": today - timedelta(days=6)}}),
            "active_users_today": len(await db["xp_events"].distinct("user_id", {"created_at": {"$gte": today}})),
            "words": await db["words"].count_documents({}),
            "questions": await db["questions"].count_documents({}),
            "quiz_attempts": await db["quiz_attempts"].count_documents({}),
            "games_played": await db["game_results"].count_documents({}),
            "speaking_sessions": await db["speaking_sessions"].count_documents({}),
            "daily_active_users": dau}

    async def save_preview(self, admin_id: str, rows: list[dict]) -> str:
        res = await self.db["import_previews"].insert_one(
            {"admin_id": admin_id, "rows": rows, "created_at": utcnow()})
        return str(res.inserted_id)

    async def pop_preview(self, import_id: str, admin_id: str):
        oid = to_oid(import_id)
        if not oid:
            return None
        return await self.db["import_previews"].find_one_and_delete({"_id": oid, "admin_id": admin_id})

    async def insert_questions(self, rows: list[dict]) -> int:
        now = utcnow()
        await self.db["questions"].insert_many([{**r, "created_at": now} for r in rows])
        return len(rows)

    async def list_questions(self, skip: int, limit: int):
        col = self.db["questions"]
        total = await col.count_documents({})
        cur = col.find().sort("created_at", -1).skip(skip).limit(limit)
        return [serialize(d) async for d in cur], total

    async def delete_question(self, qid: str) -> bool:
        oid = to_oid(qid)
        return bool(oid) and (await self.db["questions"].delete_one({"_id": oid})).deleted_count == 1
