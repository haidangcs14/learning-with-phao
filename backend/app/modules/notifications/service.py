from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.exceptions import NotFoundError
from app.common.mongo import to_oid, utcnow


def _out(r: dict) -> dict:
    return {"id": str(r["_id"]), "type": r["type"], "params": r.get("params", {}), "link": r.get("link", ""), "read": r["read"], "created_at": r["created_at"]}


class NotificationService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db, self.col = db, db["notifications"]

    async def list(self, user_id: str, limit: int) -> dict:
        rows = [r async for r in self.col.find({"user_id": user_id}).sort("created_at", -1).limit(limit)]
        return {"items": [_out(r) for r in rows], "unread": await self.col.count_documents({"user_id": user_id, "read": False})}

    async def mark_read(self, user_id: str, notification_id: str) -> None:
        oid = to_oid(notification_id)
        # the filter on user_id means nobody can touch somebody else's notification
        if not oid or (await self.col.update_one({"_id": oid, "user_id": user_id}, {"$set": {"read": True}})).matched_count == 0:
            raise NotFoundError("NOTIFICATION_NOT_FOUND", "Notification not found")

    async def mark_all_read(self, user_id: str) -> int:
        return (await self.col.update_many({"user_id": user_id, "read": False}, {"$set": {"read": True}})).modified_count

    async def delete(self, user_id: str, notification_id: str) -> None:
        oid = to_oid(notification_id)
        if not oid or (await self.col.delete_one({"_id": oid, "user_id": user_id})).deleted_count == 0:
            raise NotFoundError("NOTIFICATION_NOT_FOUND", "Notification not found")

    async def announce(self, title: str, body: str, link: str) -> int:
        """Admin announcement to every active learner (admins are not learners)."""
        ids = [str(u["_id"]) async for u in self.db["users"].find({"role": {"$ne": "admin"}, "is_active": {"$ne": False}}, {"_id": 1})]
        now = utcnow()
        docs = [{"user_id": i, "type": "announcement", "params": {"title": title.strip(), "body": body.strip()}, "link": link, "read": False, "created_at": now} for i in ids]
        if docs:
            await self.col.insert_many(docs)
        return len(docs)
