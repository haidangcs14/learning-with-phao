import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.common.mongo import serialize, to_oid, utcnow


def slugify(word: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")


class WordRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["words"]

    @staticmethod
    def _build_query(q, level, topic, part_of_speech) -> dict[str, Any]:
        query: dict[str, Any] = {}
        if q:
            query["word"] = {"$regex": re.escape(q), "$options": "i"}
        if level:
            query["level"] = level
        if topic:
            query["topics"] = topic
        if part_of_speech:
            query["meanings.part_of_speech"] = part_of_speech
        return query

    async def list(self, *, q, level, topic, part_of_speech, skip: int, limit: int):
        query = self._build_query(q, level, topic, part_of_speech)
        total = await self.col.count_documents(query)
        cursor = self.col.find(query).sort("word", 1).skip(skip).limit(limit)
        return [serialize(d) async for d in cursor], total

    async def get_by_id(self, word_id: str):
        oid = to_oid(word_id)
        return serialize(await self.col.find_one({"_id": oid})) if oid else None

    async def create(self, data: dict):
        now = utcnow()
        doc = {**data, "slug": slugify(data["word"]), "created_at": now, "updated_at": now}
        res = await self.col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize(doc)

    async def update(self, word_id: str, fields: dict):
        oid = to_oid(word_id)
        if not oid:
            return None
        if "word" in fields:
            fields["slug"] = slugify(fields["word"])
        doc = await self.col.find_one_and_update(
            {"_id": oid}, {"$set": {**fields, "updated_at": utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
        return serialize(doc)

    async def delete(self, word_id: str) -> bool:
        oid = to_oid(word_id)
        return bool(oid) and (await self.col.delete_one({"_id": oid})).deleted_count == 1

    async def topics(self, level: str | None = None) -> list[dict]:
        pipeline: list[dict] = ([{"$match": {"level": level}}] if level else []) + [
            {"$unwind": "$topics"}, {"$group": {"_id": "$topics", "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]
        return [{"topic": r["_id"], "count": r["count"]} async for r in self.col.aggregate(pipeline)]
