from typing import Literal

from pydantic import BaseModel, Field

from app.common.mongo import serialize, to_oid, utcnow

TargetType = Literal["word", "sentence", "grammar", "topic"]
TARGET_COLLECTION = {"word": "words", "sentence": "sentences", "grammar": "grammar_lessons"}


class FavoriteIn(BaseModel):
    target_type: TargetType
    target_id: str = Field(min_length=1, max_length=64)


class FavoriteService:
    def __init__(self, db):
        self.db, self.col = db, db["favorites"]

    async def add(self, user_id: str, data: FavoriteIn) -> None:
        await self.col.update_one(
            {"user_id": user_id, "target_type": data.target_type, "target_id": data.target_id},
            {"$setOnInsert": {"created_at": utcnow()}}, upsert=True,
        )

    async def remove(self, user_id: str, target_type: str, target_id: str) -> bool:
        res = await self.col.delete_one(
            {"user_id": user_id, "target_type": target_type, "target_id": target_id})
        return res.deleted_count == 1

    async def list(self, user_id: str, target_type: str | None, skip: int, limit: int):
        query = {"user_id": user_id, **({"target_type": target_type} if target_type else {})}
        total = await self.col.count_documents(query)
        items = [serialize(d) async for d in
                 self.col.find(query).sort("created_at", -1).skip(skip).limit(limit)]
        for ttype, coll in TARGET_COLLECTION.items():  # attach the referenced document
            ids = {i["target_id"]: to_oid(i["target_id"]) for i in items if i["target_type"] == ttype}
            oids = [o for o in ids.values() if o]
            found = {str(d["_id"]): serialize(d) async for d in self.db[coll].find({"_id": {"$in": oids}})}
            for i in items:
                if i["target_type"] == ttype:
                    i["item"] = found.get(i["target_id"])
        return items, total
