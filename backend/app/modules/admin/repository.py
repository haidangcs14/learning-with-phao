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

    async def save_preview(self, admin_id: str, rows: list[dict], kind: str = "questions") -> str:
        res = await self.db["import_previews"].insert_one(
            {"admin_id": admin_id, "kind": kind, "rows": rows, "created_at": utcnow()})
        return str(res.inserted_id)

    async def pop_preview(self, import_id: str, admin_id: str, kind: str = "questions"):
        oid = to_oid(import_id)
        if not oid:
            return None
        q: dict = {"_id": oid, "admin_id": admin_id}
        q["kind"] = kind if kind != "questions" else {"$in": ["questions", None]}  # old previews have no kind
        return await self.db["import_previews"].find_one_and_delete(q)

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

    async def existing_slugs(self, slugs: list[str]) -> set[str]:
        return {w["slug"] async for w in self.db["words"].find({"slug": {"$in": slugs}}, {"slug": 1})}

    async def upsert_words(self, rows: list[dict]) -> tuple[int, int]:
        now, inserted, updated = utcnow(), 0, 0
        for r in rows:
            fields = {k: v for k, v in r.items() if k != "image_url"}
            update: dict = {"$set": {**fields, "updated_at": now}, "$setOnInsert": {"created_at": now}}
            if r["image_url"]:
                update["$set"]["image_url"] = r["image_url"]
            else:
                update["$setOnInsert"]["image_url"] = ""  # an image added by a teacher is never wiped by an import without one
            res = await self.db["words"].update_one({"slug": r["slug"]}, update, upsert=True)
            inserted, updated = inserted + (1 if res.upserted_id else 0), updated + (0 if res.upserted_id else 1)
        return inserted, updated

    async def xp_totals(self, user_ids: list[str]) -> dict[str, int]:
        rows = self.db["xp_events"].aggregate([{"$match": {"user_id": {"$in": user_ids}}}, {"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}}])
        return {r["_id"]: r["xp"] async for r in rows}

    async def charts(self) -> dict:
        """Series and distributions for the admin dashboard charts."""
        db, today = self.db, period_start("daily")
        start = today - timedelta(days=13)
        days = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(14)]
        fmt = {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}

        async def by_day(col: str, pipeline_tail: list[dict], key: str) -> list[int]:
            rows = {r["_id"]: r[key] async for r in db[col].aggregate([{"$match": {"created_at": {"$gte": start}}}, *pipeline_tail])}
            return [rows.get(d, 0) for d in days]

        new_users = await by_day("users", [{"$group": {"_id": fmt, "n": {"$sum": 1}}}], "n")
        events = await by_day("xp_events", [{"$group": {"_id": fmt, "n": {"$sum": 1}}}], "n")
        active = await by_day("xp_events", [{"$group": {"_id": fmt, "u": {"$addToSet": "$user_id"}}}, {"$project": {"n": {"$size": "$u"}}}], "n")

        async def dist(col: str, group_id, pre: list[dict] | None = None, limit: int = 10) -> list[dict]:
            rows = db[col].aggregate([*(pre or []), {"$group": {"_id": group_id, "value": {"$sum": 1}}}, {"$sort": {"value": -1}}, {"$limit": limit}])
            return [{"label": str(r["_id"]), "value": r["value"]} async for r in rows]

        xp_src = [{"label": r["_id"], "value": r["xp"]} async for r in db["xp_events"].aggregate(
            [{"$group": {"_id": "$source", "xp": {"$sum": "$amount"}}}, {"$sort": {"xp": -1}}])]
        totals = [r["xp"] async for r in db["xp_events"].aggregate([{"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}}])]
        buckets = {"Lv.1": 0, "Lv.2-3": 0, "Lv.4-6": 0, "Lv.7-10": 0, "Lv.11+": 0}
        for xp in totals:
            lv = xp // 100 + 1
            buckets["Lv.1" if lv == 1 else "Lv.2-3" if lv <= 3 else "Lv.4-6" if lv <= 6 else "Lv.7-10" if lv <= 10 else "Lv.11+"] += 1
        buckets["Lv.1"] += max(0, await db["users"].count_documents({"role": "user"}) - len(totals))  # learners with no XP yet
        return {"series": {"dates": days, "new_users": new_users, "active_users": active, "events": events}, "xp_by_source": xp_src,
                "words_by_level": sorted(await dist("words", "$level"), key=lambda x: x["label"]),
                "words_by_topic": await dist("words", "$topics", [{"$unwind": "$topics"}]),
                "users_by_role": await dist("users", "$role"),
                "users_by_level": [{"label": k, "value": v} for k, v in buckets.items()]}
