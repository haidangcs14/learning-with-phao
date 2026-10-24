from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid, utcnow

LIST_PROJECTION = {"text": 0, "evaluation.feedback": 0, "evaluation.corrections": 0, "evaluation.comments": 0, "evaluation.improved": 0, "evaluation.summary": 0}


class WritingRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.prompts, self.subs = db["writing_prompts"], db["writing_submissions"]

    async def list_prompts(self, level: str | None) -> list[dict]:
        q = {"level": level} if level else {}
        return [serialize(p) async for p in self.prompts.find(q).sort([("level", 1), ("order", 1)])]

    async def get_prompt(self, prompt_id: str):
        oid = to_oid(prompt_id)
        return serialize(await self.prompts.find_one({"_id": oid})) if oid else None

    async def create(self, doc: dict) -> dict:
        doc = {**doc, "created_at": utcnow()}
        doc["_id"] = (await self.subs.insert_one(doc)).inserted_id
        return serialize(doc)

    async def history(self, user_id: str, skip: int, limit: int):
        q = {"user_id": user_id}
        total = await self.subs.count_documents(q)
        cur = self.subs.find(q, LIST_PROJECTION).sort("created_at", -1).skip(skip).limit(limit)
        return [serialize(s) async for s in cur], total

    async def get(self, sub_id: str, user_id: str):
        oid = to_oid(sub_id)
        return serialize(await self.subs.find_one({"_id": oid, "user_id": user_id})) if oid else None

    async def delete(self, sub_id: str, user_id: str) -> bool:
        oid = to_oid(sub_id)
        return bool(oid) and (await self.subs.delete_one({"_id": oid, "user_id": user_id})).deleted_count == 1
