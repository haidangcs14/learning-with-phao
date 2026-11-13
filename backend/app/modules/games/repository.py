from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.common.mongo import serialize, to_oid


class GameRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.words, self.cloze = db["words"], db["cloze_questions"]
        self.sessions, self.results = db["game_sessions"], db["game_results"]
        self.db = db

    async def sample_words(self, n: int) -> list[dict]:
        return [w async for w in self.words.aggregate([
            {"$match": {"meanings.0.translation_vi": {"$exists": True}}}, {"$sample": {"size": n}}])]

    async def sample_cloze(self, n: int) -> list[dict]:
        return [serialize(q) async for q in self.cloze.aggregate([{"$sample": {"size": n}}])]

    async def cloze_by_id(self, qid: str):
        oid = to_oid(qid)
        return await self.cloze.find_one({"_id": oid}) if oid else None

    async def create_session(self, doc: dict) -> str:
        return str((await self.sessions.insert_one(doc)).inserted_id)

    async def get_session(self, session_id: str, user_id: str, game: str):
        oid = to_oid(session_id)
        return await self.sessions.find_one({"_id": oid, "user_id": user_id, "game": game}) if oid else None

    async def close_session(self, session_id: str, user_id: str, game: str, now):
        """Atomic: a session can be closed (= result submitted) only once."""
        oid = to_oid(session_id)
        if not oid:
            return None
        return await self.sessions.find_one_and_update(
            {"_id": oid, "user_id": user_id, "game": game, "finished": False},
            {"$set": {"finished": True, "finished_at": now}})

    async def record_answer(self, session_id: str, user_id: str, qid: str, entry: dict) -> bool:
        """Atomic: each question of a fill-in-the-blank session can be answered only once."""
        res = await self.sessions.update_one(
            {"_id": to_oid(session_id), "user_id": user_id, "game": "fill_blank", "finished": False,
             f"answers.{qid}": {"$exists": False}},
            {"$set": {f"answers.{qid}": entry}})
        return res.matched_count == 1

    async def save_result(self, doc: dict) -> None:
        await self.results.insert_one(doc)

    async def best(self, user_id: str, game: str, mode: str):
        q: dict = {"user_id": user_id, "game": game}
        q["mode"] = {"$in": [mode, None]} if mode == "classic" else mode  # old results had no mode
        return await self.results.find_one(q, sort=[("score", -1), ("flips", 1), ("duration", 1)])

    async def sample_topic_words(self, topic: str | None, n: int, need_example: bool) -> list[dict]:
        match: dict = {"meanings.0.translation_vi": {"$exists": True}}
        if topic:
            match["topics"] = topic
        if need_example:
            match["meanings.0.examples.0"] = {"$exists": True}
        return [w async for w in self.words.aggregate([{"$match": match}, {"$sample": {"size": n}}])]

    async def cas_session(self, session_id: str, user_id: str, game: str, expect: dict, changes: dict) -> bool:
        """Compare-and-set: the update only applies if the session is still in the state the caller saw (no double guesses)."""
        oid = to_oid(session_id)
        if not oid:
            return False
        doc = await self.sessions.find_one_and_update({"_id": oid, "user_id": user_id, "game": game, "finished": False, **expect},
                                                      {"$set": changes}, return_document=ReturnDocument.AFTER)
        return doc is not None

    async def _people(self, ids: list[str]) -> dict[str, dict]:
        oids = [o for o in (to_oid(i) for i in ids) if o]
        cur = self.db["users"].find({"_id": {"$in": oids}}, {"username": 1, "full_name": 1, "avatar_url": 1, "role": 1})
        return {str(u["_id"]): u async for u in cur}

    async def _xp(self, ids: list[str]) -> dict[str, int]:
        rows = self.db["xp_events"].aggregate([{"$match": {"user_id": {"$in": ids}}}, {"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}}])
        return {r["_id"]: r["xp"] async for r in rows}

    async def recent(self, limit: int) -> list[dict]:
        rows = [r async for r in self.results.find({}, {"_id": 0}).sort("created_at", -1).limit(limit * 3)]
        people = await self._people(list({r["user_id"] for r in rows}))
        out = []
        for r in rows:
            u = people.get(r["user_id"])
            if u and u.get("role") != "admin":  # admins don't play, and unknown users are skipped
                out.append({**r, "username": u["username"], "full_name": u.get("full_name", ""), "avatar_url": u.get("avatar_url", "")})
        return out[:limit]

    async def ranking(self, game: str | None, limit: int) -> list[dict]:
        pipeline: list[dict] = ([{"$match": {"game": game}}] if game else []) + [
            {"$group": {"_id": {"u": "$user_id", "g": "$game"}, "best": {"$max": "$score"}}},
            {"$group": {"_id": "$_id.u", "score": {"$sum": "$best"}, "games": {"$sum": 1}}},
            {"$sort": {"score": -1}}, {"$limit": limit + 20}]
        rows = [r async for r in self.results.aggregate(pipeline)]
        people = await self._people([r["_id"] for r in rows])
        rows = [r for r in rows if people.get(r["_id"]) and people[r["_id"]].get("role") != "admin" and r["score"] > 0][:limit]
        xp = await self._xp([r["_id"] for r in rows])
        from app.modules.leaderboard.service import level_of

        return [{"rank": i + 1, "user_id": r["_id"], "score": r["score"], "games": r["games"], "username": people[r["_id"]]["username"],
                 "full_name": people[r["_id"]].get("full_name", ""), "avatar_url": people[r["_id"]].get("avatar_url", ""),
                 "level": level_of(xp.get(r["_id"], 0))} for i, r in enumerate(rows)]
