from app.common.mongo import utcnow
from datetime import timedelta
from tests.conftest import signup


def word(w, sentence, vi="x", topic="Food & Drink"):
    return {"word": w, "slug": w, "phonetic": f"/{w}/", "topics": [topic], "level": "A1", "emoji": "🍎",
            "meanings": [{"part_of_speech": "noun", "definition": "d", "translation_vi": vi, "examples": [sentence], "examples_vi": ["Câu " + w]}]}


SENT = ["I eat an apple every day.", "She drinks hot tea.", "We cook rice for dinner.", "He likes fresh bread.", "They buy cheap fruit."]


async def seed(db, n=5):
    await db["words"].insert_many([word(f"w{i}", SENT[i % 5]) for i in range(n)])


async def backdate(db, seconds):
    await db["game_sessions"].update_one({}, {"$set": {"started_at": utcnow() - timedelta(seconds=seconds)}})


async def test_word_bridge_levels_come_from_the_topic_and_the_score_is_recomputed(api, db):
    await seed(db)
    h = await signup(api)
    d = (await api.post("/api/v1/games/word_bridge/start", json={"topic": "Food & Drink", "count": 4}, headers=h)).json()["data"]
    assert len(d["levels"]) == 4 and all(3 <= len(x["sentence"].split()) <= 9 and x["sentence_vi"] for x in d["levels"])
    await backdate(db, 120)
    words = sum(len(x["sentence"].split()) for x in d["levels"])
    r = await api.post("/api/v1/games/word_bridge/finish", json={"session_id": d["session_id"], "correct": words, "perfect": 3, "completed": 4, "mistakes": 2}, headers=h)
    assert r.json()["data"]["score"] == words * 10 + 150 and r.json()["data"]["xp_awarded"] > 0
    assert (await api.post("/api/v1/games/word_bridge/finish", json={"session_id": d["session_id"], "correct": 1}, headers=h)).status_code == 404   # once
    assert (await api.get("/api/v1/games/summary", headers=h)).json()["data"]["word_bridge"] == words * 10 + 150


async def test_word_bridge_rejects_impossible_results(api, db):
    await seed(db)
    h = await signup(api)
    d = (await api.post("/api/v1/games/word_bridge/start", json={"topic": "Food & Drink", "count": 3}, headers=h)).json()["data"]
    fast = await api.post("/api/v1/games/word_bridge/finish", json={"session_id": d["session_id"], "correct": 10, "perfect": 3, "completed": 3}, headers=h)
    assert fast.status_code == 400 and fast.json()["error_code"] == "SUSPICIOUS_RESULT"
    d2 = (await api.post("/api/v1/games/word_bridge/start", json={"topic": "Food & Drink", "count": 3}, headers=h)).json()["data"]
    await db["game_sessions"].update_many({}, {"$set": {"started_at": utcnow() - timedelta(seconds=999)}})
    assert (await api.post("/api/v1/games/word_bridge/finish", json={"session_id": d2["session_id"], "correct": 99, "perfect": 3, "completed": 3}, headers=h)).status_code == 400
    assert (await api.post("/api/v1/games/word_bridge/start", json={"topic": "Nothing"}, headers=h)).status_code == 409


async def test_vocab_rain_words_and_bounded_score(api, db):
    await db["words"].insert_many([word(f"word{chr(97 + i)}", "S one two", topic="Animals") for i in range(8)])
    h = await signup(api)
    d = (await api.post("/api/v1/games/vocab_rain/start", json={"topic": "Animals"}, headers=h)).json()["data"]
    assert len(d["words"]) == 8 and {"word", "translation_vi", "phonetic"} <= set(d["words"][0])
    await backdate(db, 200)
    ok = await api.post("/api/v1/games/vocab_rain/finish", json={"session_id": d["session_id"], "correct": 6, "missed": 2, "mistakes": 3, "score": 90}, headers=h)
    assert ok.status_code == 200 and ok.json()["data"]["score"] == 90
    d2 = (await api.post("/api/v1/games/vocab_rain/start", json={"topic": "Animals"}, headers=h)).json()["data"]
    await db["game_sessions"].update_many({}, {"$set": {"started_at": utcnow() - timedelta(seconds=500)}})
    assert (await api.post("/api/v1/games/vocab_rain/finish", json={"session_id": d2["session_id"], "correct": 3, "missed": 0, "score": 999}, headers=h)).status_code == 400
    assert (await api.post("/api/v1/games/vocab_rain/finish", json={"session_id": d2["session_id"], "correct": 7, "missed": 5, "score": 10}, headers=h)).status_code == 404   # a rejected attempt also uses up the session
