from motor.motor_asyncio import AsyncIOMotorDatabase


class ActivityRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["xp_events"]

    async def per_day(self, user_id: str, start_utc, tz: str) -> dict[str, dict]:
        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": start_utc}}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": tz}},
                        "count": {"$sum": 1}, "xp": {"$sum": "$amount"}}},
        ]
        return {r["_id"]: {"count": r["count"], "xp": r["xp"]} async for r in self.col.aggregate(pipeline)}
