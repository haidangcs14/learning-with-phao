from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import serialize, to_oid


class GameRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.words, self.cloze = db["words"], db["cloze_questions"]
        self.sessions, self.results = db["game_sessions"], db["game_results"]

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
