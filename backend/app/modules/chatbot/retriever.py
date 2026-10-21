import re

from motor.motor_asyncio import AsyncIOMotorDatabase

STOP = {"the", "and", "what", "how", "for", "are", "you", "does", "with", "this", "that", "between",
        "difference", "when", "use", "mean", "means", "meaning", "thì", "của", "là", "gì", "cách", "dùng"}


class KeywordRetriever:
    """Retriever đơn giản trên MongoDB. Cùng interface `search(text) -> list[doc]`
    nên sau này có thể thay bằng vector search (Chroma/Qdrant/Atlas) mà không đổi ChatService."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def search(self, text: str, limit: int = 3) -> list[dict]:
        tokens = [t for t in dict.fromkeys(re.findall(r"[^\W\d_]{3,}", text.lower())) if t not in STOP][:8]
        if not tokens:
            return []
        docs: list[dict] = []
        rx = [{"title": {"$regex": re.escape(t), "$options": "i"}} for t in tokens]
        rx += [{"description": {"$regex": re.escape(t), "$options": "i"}} for t in tokens if len(t) > 3]
        lessons = [g async for g in self.db["grammar_lessons"].find({"$or": rx})]
        lessons.sort(key=lambda g: -sum(t in f"{g['title']} {g['description']}".lower() for t in tokens))
        for g in lessons[:2]:
            formula = "; ".join(f"{k}: {v}" for k, v in g.get("formula", {}).items())
            ex = g["examples"][0]["en"] if g.get("examples") else ""
            docs.append({"type": "grammar", "id": g["slug"], "title": g["title"],
                         "text": f"{g['title']} — {g['description']}. Công thức: {formula}. Ví dụ: {ex}"})
        async for w in self.db["words"].find({"word": {"$in": tokens}}).limit(2):
            m = w["meanings"][0] if w.get("meanings") else {}
            docs.append({"type": "word", "id": str(w["_id"]), "title": w["word"],
                         "text": f"{w['word']} {w.get('phonetic', '')}: {m.get('translation_vi', '')} "
                                 f"({m.get('part_of_speech', '')}). Ví dụ: {(m.get('examples') or [''])[0]}"})
        async for v in self.db["irregular_verbs"].find({"base": {"$in": tokens}}).limit(2):
            docs.append({"type": "verb", "id": v["base"], "title": v["base"],
                         "text": f"{v['base']} – {v['past']} – {v['past_participle']}: {v['meaning_vi']}"})
        return docs[:limit]
