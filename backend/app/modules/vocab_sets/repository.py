import re

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import to_oid, utcnow


class VocabSetRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.sets, self.cards, self.study = db["vocab_sets"], db["vocab_cards"], db["card_study"]

    # ---------- sets
    async def get(self, set_id: str) -> dict | None:
        oid = to_oid(set_id)
        return await self.sets.find_one({"_id": oid}) if oid else None

    async def create(self, doc: dict) -> dict:
        doc["_id"] = (await self.sets.insert_one(doc)).inserted_id
        return doc

    async def count_mine(self, owner_id: str) -> int:
        return await self.sets.count_documents({"owner_id": owner_id})

    async def next_position(self, owner_id: str) -> int:
        last = await self.sets.find_one({"owner_id": owner_id}, sort=[("position", -1)])
        return (last["position"] + 1) if last else 0

    async def list_public(self, q: str | None, skip: int, limit: int) -> tuple[list[dict], int]:
        flt: dict = {"status": "public"}
        if q:
            flt["title"] = {"$regex": re.escape(q), "$options": "i"}
        total = await self.sets.count_documents(flt)
        items = [s async for s in self.sets.find(flt).sort("published_at", -1).skip(skip).limit(limit)]
        return items, total

    async def list_mine(self, owner_id: str) -> list[dict]:
        return [s async for s in self.sets.find({"owner_id": owner_id}).sort("position", 1)]

    async def update(self, set_id: str, changes: dict) -> None:
        await self.sets.update_one({"_id": to_oid(set_id)}, {"$set": {**changes, "updated_at": utcnow()}})

    async def delete(self, set_id: str) -> None:
        await self.cards.delete_many({"set_id": set_id})
        await self.study.delete_many({"set_id": set_id})
        await self.sets.delete_one({"_id": to_oid(set_id)})

    async def people(self, ids: list[str]) -> dict[str, dict]:
        oids = [o for o in (to_oid(i) for i in set(ids)) if o]
        cur = self.db["users"].find({"_id": {"$in": oids}}, {"username": 1, "full_name": 1, "avatar_url": 1})
        return {str(u["_id"]): {"id": str(u["_id"]), "username": u["username"], "full_name": u.get("full_name", ""), "avatar_url": u.get("avatar_url", "")} async for u in cur}

    # ---------- cards
    async def card_counts(self, set_ids: list[str]) -> dict[str, int]:
        rows = self.cards.aggregate([{"$match": {"set_id": {"$in": set_ids}}}, {"$group": {"_id": "$set_id", "n": {"$sum": 1}}}])
        return {r["_id"]: r["n"] async for r in rows}

    async def group_counts(self, set_id: str) -> dict[str, int]:
        rows = self.cards.aggregate([{"$match": {"set_id": set_id}}, {"$group": {"_id": "$group_id", "n": {"$sum": 1}}}])
        return {r["_id"]: r["n"] async for r in rows}

    async def cards_of(self, set_id: str, group_id: str | None = None) -> list[dict]:
        flt = {"set_id": set_id, **({"group_id": group_id} if group_id else {})}
        return [c async for c in self.cards.find(flt).sort([("group_id", 1), ("position", 1)])]

    async def card(self, card_id: str) -> dict | None:
        oid = to_oid(card_id)
        return await self.cards.find_one({"_id": oid}) if oid else None

    async def next_card_position(self, set_id: str, group_id: str) -> int:
        last = await self.cards.find_one({"set_id": set_id, "group_id": group_id}, sort=[("position", -1)])
        return (last["position"] + 1) if last else 0

    async def add_card(self, doc: dict) -> dict:
        doc["_id"] = (await self.cards.insert_one(doc)).inserted_id
        return doc

    async def update_card(self, card_id: str, changes: dict) -> None:
        await self.cards.update_one({"_id": to_oid(card_id)}, {"$set": {**changes, "updated_at": utcnow()}})

    async def delete_card(self, card_id: str) -> None:
        await self.cards.delete_one({"_id": to_oid(card_id)})
        await self.study.delete_many({"card_id": card_id})

    async def delete_group_cards(self, set_id: str, group_id: str) -> None:
        ids = [str(c["_id"]) async for c in self.cards.find({"set_id": set_id, "group_id": group_id}, {"_id": 1})]
        await self.cards.delete_many({"set_id": set_id, "group_id": group_id})
        if ids:
            await self.study.delete_many({"card_id": {"$in": ids}})

    async def set_card_order(self, ids: list[str]) -> None:
        for pos, cid in enumerate(ids):
            await self.cards.update_one({"_id": to_oid(cid)}, {"$set": {"position": pos}})

    # ---------- learning progress on custom cards
    async def record(self, user_id: str, card: dict, correct: bool) -> bool:
        """True when the card has just become 'learned' for this user."""
        cid = str(card["_id"])
        before = await self.study.find_one({"user_id": user_id, "card_id": cid})
        update: dict = {"$set": {"set_id": card["set_id"], "group_id": card["group_id"], "updated_at": utcnow()}, "$inc": {"correct" if correct else "wrong": 1}}
        if correct:
            update["$set"]["learned"] = True
        await self.study.update_one({"user_id": user_id, "card_id": cid}, update, upsert=True)
        return correct and not (before and before.get("learned"))

    async def learned_by_group(self, user_id: str, set_id: str) -> dict[str, int]:
        rows = self.study.aggregate([{"$match": {"user_id": user_id, "set_id": set_id, "learned": True}}, {"$group": {"_id": "$group_id", "n": {"$sum": 1}}}])
        return {r["_id"]: r["n"] async for r in rows}

    async def learned_ids(self, user_id: str, set_id: str, group_id: str) -> list[str]:
        return [r["card_id"] async for r in self.study.find({"user_id": user_id, "set_id": set_id, "group_id": group_id, "learned": True}, {"card_id": 1})]
