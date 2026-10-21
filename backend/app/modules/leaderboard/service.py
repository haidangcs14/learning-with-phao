from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import to_oid, utcnow


def period_start(period: str):
    now = utcnow()
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "daily":
        return day
    if period == "weekly":
        return day - timedelta(days=day.weekday())
    if period == "monthly":
        return day.replace(day=1)
    return None  # all time


class XpService:
    """The ONLY place XP is created. Clients never send XP amounts."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db, self.col = db, db["xp_events"]

    async def award(self, user_id: str, source: str, amount: int, *, daily_cap: int | None = None) -> int:
        if amount <= 0:
            return 0
        if daily_cap is not None:
            used = 0
            async for d in self.col.aggregate([
                {"$match": {"user_id": user_id, "source": source, "created_at": {"$gte": period_start("daily")}}},
                {"$group": {"_id": None, "t": {"$sum": "$amount"}}},
            ]):
                used = d["t"]
            amount = min(amount, max(0, daily_cap - used))
            if amount == 0:
                return 0
        await self.col.insert_one(
            {"user_id": user_id, "source": source, "amount": amount, "created_at": utcnow()}
        )
        return amount

    async def board(self, period: str, limit: int) -> list[dict]:
        start = period_start(period)
        match = {"created_at": {"$gte": start}} if start else {}
        rows = [r async for r in self.col.aggregate([
            {"$match": match},
            {"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}},
            {"$sort": {"xp": -1}}, {"$limit": limit},
        ])]
        oids = [o for o in (to_oid(r["_id"]) for r in rows) if o]
        names = {str(u["_id"]): u async for u in self.db["users"].find(
            {"_id": {"$in": oids}}, {"username": 1, "avatar_url": 1})}
        return [{"rank": i + 1, "user_id": r["_id"], "xp": r["xp"],
                 "username": names.get(r["_id"], {}).get("username", "unknown"),
                 "avatar_url": names.get(r["_id"], {}).get("avatar_url", "")}
                for i, r in enumerate(rows)]

    async def summary(self, user_id: str) -> dict:
        by_source = {r["_id"]: r["xp"] async for r in self.col.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": "$source", "xp": {"$sum": "$amount"}}},
        ])}
        return {"total_xp": sum(by_source.values()), "by_source": by_source}

    async def total(self, user_id: str, period: str) -> int:
        start = period_start(period)
        match = {"user_id": user_id, **({"created_at": {"$gte": start}} if start else {})}
        async for d in self.col.aggregate([{"$match": match}, {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]):
            return d["t"]
        return 0

    async def totals(self, user_id: str) -> dict:
        return {p: await self.total(user_id, p) for p in ("daily", "weekly", "monthly", "all")}
