from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid


class SpeakingRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.topics, self.sessions = db["speaking_topics"], db["speaking_sessions"]

    async def list_topics(self) -> list[dict]:
        return [serialize(t) async for t in self.topics.find().sort("order", 1)]

    async def get_topic(self, topic_id: str):
        oid = to_oid(topic_id)
        return serialize(await self.topics.find_one({"_id": oid})) if oid else None

    async def create_session(self, doc: dict) -> dict:
        doc["_id"] = (await self.sessions.insert_one(doc)).inserted_id
        return serialize(doc)

    async def get_session(self, session_id: str, user_id: str):
        oid = to_oid(session_id)
        return serialize(await self.sessions.find_one({"_id": oid, "user_id": user_id})) if oid else None

    async def update_session(self, session_id: str, fields: dict) -> None:
        await self.sessions.update_one({"_id": to_oid(session_id)}, {"$set": fields})

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        oid = to_oid(session_id)
        return bool(oid) and (await self.sessions.delete_one({"_id": oid, "user_id": user_id})).deleted_count == 1

    async def history(self, user_id: str, skip: int, limit: int, only_submitted: bool = False):
        q: dict = {"user_id": user_id}
        if only_submitted:  # hide abandoned sessions (topic chosen but nothing recorded)
            q["status"] = {"$ne": "created"}
        total = await self.sessions.count_documents(q)
        cur = self.sessions.find(q).sort("created_at", -1).skip(skip).limit(limit)
        return [serialize(s) async for s in cur], total
