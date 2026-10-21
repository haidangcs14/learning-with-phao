import re

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow


def pair_key(a: str, b: str) -> str:
    return ":".join(sorted([a, b]))


class FriendRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col, self.users = db["friendships"], db["users"]

    async def find_pair(self, a: str, b: str):
        return serialize(await self.col.find_one({"pair": pair_key(a, b)}))

    async def create(self, requester: str, receiver: str) -> dict:
        now = utcnow()
        doc = {"requester_id": requester, "receiver_id": receiver, "pair": pair_key(requester, receiver),
               "status": "pending", "created_at": now, "updated_at": now}
        doc["_id"] = (await self.col.insert_one(doc)).inserted_id
        return serialize(doc)

    async def get(self, friendship_id: str):
        oid = to_oid(friendship_id)
        return serialize(await self.col.find_one({"_id": oid})) if oid else None

    async def accept(self, friendship_id: str) -> None:
        await self.col.update_one({"_id": to_oid(friendship_id)},
                                  {"$set": {"status": "accepted", "updated_at": utcnow()}})

    async def delete(self, friendship_id: str) -> None:
        await self.col.delete_one({"_id": to_oid(friendship_id)})

    async def incoming(self, uid: str):
        return [serialize(d) async for d in self.col.find({"receiver_id": uid, "status": "pending"}).sort("created_at", -1)]

    async def outgoing(self, uid: str):
        return [serialize(d) async for d in self.col.find({"requester_id": uid, "status": "pending"}).sort("created_at", -1)]

    async def accepted(self, uid: str):
        q = {"status": "accepted", "$or": [{"requester_id": uid}, {"receiver_id": uid}]}
        return [serialize(d) async for d in self.col.find(q)]

    async def briefs(self, ids: list[str]) -> dict[str, dict]:
        oids = [o for o in (to_oid(i) for i in ids) if o]
        cur = self.users.find({"_id": {"$in": oids}}, {"username": 1, "avatar_url": 1, "full_name": 1})
        return {str(u["_id"]): {"id": str(u["_id"]), "username": u["username"],
                                "avatar_url": u.get("avatar_url", "")} async for u in cur}

    async def search_users(self, q: str, exclude_id: str, limit: int = 10) -> list[dict]:
        cur = self.users.find({"username": {"$regex": re.escape(q), "$options": "i"},
                               "is_active": True}, {"username": 1, "avatar_url": 1}).limit(limit + 1)
        return [{"id": str(u["_id"]), "username": u["username"], "avatar_url": u.get("avatar_url", "")}
                async for u in cur if str(u["_id"]) != exclude_id][:limit]
