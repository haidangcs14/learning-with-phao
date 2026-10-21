import re

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["users"]

    async def get_by_id(self, user_id: str):
        oid = to_oid(user_id)
        return serialize(await self.col.find_one({"_id": oid})) if oid else None

    async def get_by_email(self, email: str):
        return serialize(await self.col.find_one({"email": email.lower()}))

    async def get_by_username(self, username: str):
        return serialize(await self.col.find_one({"username": username}))

    async def create(self, doc: dict):
        now = utcnow()
        doc = {"avatar_url": "", "provider": "local", **doc, "email": doc["email"].lower(),
               "is_active": True, "created_at": now, "updated_at": now}
        res = await self.col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def list(self, *, q, role, skip: int, limit: int):
        query: dict = {}
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            query["$or"] = [{"email": rx}, {"username": rx}]
        if role:
            query["role"] = role
        total = await self.col.count_documents(query)
        cur = self.col.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit)
        return [serialize(d) async for d in cur], total

    async def update(self, user_id: str, fields: dict):
        oid = to_oid(user_id)
        if not oid:
            return None
        fields = {**fields, "updated_at": utcnow()}
        await self.col.update_one({"_id": oid}, {"$set": fields})
        return await self.get_by_id(user_id)

    async def delete(self, user_id: str) -> bool:
        oid = to_oid(user_id)
        return bool(oid) and (await self.col.delete_one({"_id": oid})).deleted_count == 1

    async def get_by_provider(self, provider: str, provider_id: str):
        return serialize(await self.col.find_one({f"providers.{provider}": provider_id}))
