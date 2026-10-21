from datetime import timedelta

from app.common.mongo import utcnow
from tests.conftest import signup


async def _seed_cloze(db):
    await db["cloze_questions"].insert_one({"sentence": "She ____ home.", "answer": "goes",
                                            "options": ["goes", "go", "going", "gone"], "level": "A1", "vi": "x"})


async def test_fill_blank_hides_answers_and_grades_server_side(api, db):
    await _seed_cloze(db)
    h = await signup(api)
    start = (await api.post("/api/v1/games/fill_blank/start", headers=h)).json()["data"]
    q = start["questions"][0]
    assert "answer" not in q and sorted(q["options"]) == ["go", "goes", "going", "gone"]
    body = {"session_id": start["session_id"], "question_id": q["id"], "answer": "go"}
    r = (await api.post("/api/v1/games/fill_blank/answer", json=body, headers=h)).json()["data"]
    assert r["correct"] is False and r["correct_answer"] == "goes" and r["finished"] is True
    again = await api.post("/api/v1/games/fill_blank/answer", json=body, headers=h)
    assert again.status_code == 404  # session already finished


async def test_memory_mode_best_score(api, db):
    for i in range(3):
        await db["words"].insert_one({"word": f"w{i}", "slug": f"w{i}", "meanings": [{"translation_vi": "x"}]})
    h = await signup(api)
    start = (await api.post("/api/v1/games/card_matching/start", headers=h)).json()["data"]
    await db["game_sessions"].update_one({}, {"$set": {"started_at": utcnow() - timedelta(seconds=30)}})
    n = len(start["pairs"])
    r = await api.post("/api/v1/games/card_matching/submit", headers=h, json={
        "session_id": start["session_id"], "correct": n, "mode": "memory", "flips": n + 2})
    d = r.json()["data"]
    assert r.status_code == 200 and d["is_record"] is True and d["flips"] == n + 2
    best = (await api.get("/api/v1/games/card_matching/best", headers=h)).json()["data"]
    assert best["memory"]["score"] == d["score"] and best["memory"]["flips"] == n + 2 and best["classic"] is None


async def test_memory_rejects_impossible_flips(api, db):
    for i in range(3):
        await db["words"].insert_one({"word": f"w{i}", "slug": f"w{i}", "meanings": [{"translation_vi": "x"}]})
    h = await signup(api)
    start = (await api.post("/api/v1/games/card_matching/start", headers=h)).json()["data"]
    await db["game_sessions"].update_one({}, {"$set": {"started_at": utcnow() - timedelta(seconds=60)}})
    n = len(start["pairs"])
    r = await api.post("/api/v1/games/card_matching/submit", headers=h, json={
        "session_id": start["session_id"], "correct": n, "mode": "memory", "flips": max(0, n - 1)})
    assert r.status_code == 400
