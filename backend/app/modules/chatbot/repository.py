from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow


class ChatRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.sessions, self.messages = db["chat_sessions"], db["chat_messages"]

    async def create_session(self, user_id: str, title: str) -> dict:
        now = utcnow()
        doc = {"user_id": user_id, "title": title, "created_at": now, "updated_at": now}
        doc["_id"] = (await self.sessions.insert_one(doc)).inserted_id
        return serialize(doc)

    async def get_session(self, session_id: str, user_id: str):
        oid = to_oid(session_id)
        return serialize(await self.sessions.find_one({"_id": oid, "user_id": user_id})) if oid else None

    async def list_sessions(self, user_id: str, limit: int = 50):
        cur = self.sessions.find({"user_id": user_id}).sort("updated_at", -1).limit(limit)
        return [serialize(s) async for s in cur]

    async def touch(self, session_id: str, title: str | None = None) -> None:
        fields = {"updated_at": utcnow(), **({"title": title} if title else {})}
        await self.sessions.update_one({"_id": to_oid(session_id)}, {"$set": fields})

    async def add_message(self, session_id: str, user_id: str, role: str, content: str, extra=None) -> dict:
        doc = {"session_id": session_id, "user_id": user_id, "role": role, "content": content,
               "created_at": utcnow(), **(extra or {})}
        doc["_id"] = (await self.messages.insert_one(doc)).inserted_id
        return serialize(doc)

    async def list_messages(self, session_id: str, limit: int = 200):
        cur = self.messages.find({"session_id": session_id}).sort("created_at", 1).limit(limit)
        return [serialize(m) async for m in cur]

    async def count_messages(self, session_id: str) -> int:
        return await self.messages.count_documents({"session_id": session_id})
