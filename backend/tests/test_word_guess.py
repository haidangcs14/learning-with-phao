from app.modules.games.service import score_guess
from tests.conftest import signup


def test_wordle_colours_handle_repeated_letters():
    assert score_guess("apple", "apple") == ["correct"] * 5
    assert score_guess("apple", "paper") == ["present", "present", "correct", "present", "absent"]
    assert score_guess("cat", "dog") == ["absent"] * 3
    assert score_guess("book", "boob") == ["correct", "correct", "correct", "absent"]    # the second "b" has no partner left
    assert score_guess("llama", "hello") == ["absent", "absent", "present", "present", "absent"]  # two l's in the answer, both found
    assert score_guess("hello", "llama") == ["present", "present", "absent", "absent", "absent"]  # only the letters that exist are marked


def w(word, vi="nghĩa", topic="Animals"):
    return {"word": word, "slug": word, "phonetic": f"/{word}/", "topics": [topic], "level": "A1", "emoji": "🐶",
            "meanings": [{"part_of_speech": "noun", "definition": "d", "translation_vi": vi, "examples": [], "examples_vi": []}]}


async def start(api, db, h, lives=3):
    await db["words"].insert_many([w(x) for x in ("tiger", "horse", "snake", "mouse", "sheep", "whale")])
    d = (await api.post("/api/v1/games/word_guess/start", json={"topic": "Animals", "lives": lives}, headers=h)).json()["data"]
    session = await db["game_sessions"].find_one({"game": "word_guess"})
    return d, session["answers"]


async def guess(api, h, sid, index, word):
    return await api.post("/api/v1/games/word_guess/guess", json={"session_id": sid, "index": index, "guess": word}, headers=h)


async def test_start_never_reveals_the_answers(api, db):
    h = await signup(api)
    d, answers = await start(api, db, h)
    assert len(d["hints"]) == 6 and d["lives"] == 3 and d["max_attempts"] == 6
    assert all(set(x) == {"length", "translation_vi", "emoji", "pos", "phonetic"} for x in d["hints"])
    assert not any(a in str(d) for a in answers if a not in ("nghĩa",))


async def test_solving_scores_by_speed_and_builds_a_streak(api, db):
    h = await signup(api)
    d, answers = await start(api, db, h)
    sid = d["session_id"]
    wrong = "zzzzz" if len(answers[0]) == 5 else "z" * len(answers[0])
    r = (await guess(api, h, sid, 0, wrong)).json()["data"]
    assert r["pattern"] == ["absent"] * len(answers[0]) and not r["solved"] and r["answer"] is None
    r = (await guess(api, h, sid, 0, answers[0].upper())).json()["data"]            # case does not matter
    assert r["solved"] and r["attempts"] == 2 and r["answer"] == answers[0] and r["points"] == 50 + 5 and r["streak"] == 1
    r2 = (await guess(api, h, sid, 1, answers[1])).json()["data"]
    assert r2["points"] == 60 + 10 and r2["streak"] == 2 and r2["score"] == 55 + 70 and r2["best_streak"] == 2


async def test_losing_a_word_costs_a_life_shows_the_answer_and_the_game_ends_by_itself(api, db):
    h = await signup(api)
    d, answers = await start(api, db, h, lives=3)
    sid = d["session_id"]
    for idx in range(3):                                                             # three lost words = no lives left
        n = len(answers[idx])
        for k in range(6):
            r = (await guess(api, h, sid, idx, "q" * n)).json()["data"]
        assert r["failed"] and r["answer"] == answers[idx] and r["lives"] == 3 - (idx + 1) and r["streak"] == 0
    assert r["finished"] and r["result"]["score"] == 0 and r["result"]["xp_awarded"] == 0
    assert (await guess(api, h, sid, 3, "x" * len(answers[3]))).status_code == 404   # the session is closed


async def test_guess_validation_and_quitting_saves_the_score(api, db):
    h = await signup(api)
    d, answers = await start(api, db, h)
    sid = d["session_id"]
    assert (await guess(api, h, sid, 0, "ab")).status_code == 400                  # wrong length
    assert (await guess(api, h, sid, 0, "12345"[: len(answers[0])])).status_code == 400  # not letters
    assert (await guess(api, h, sid, 2, answers[0])).status_code == 409            # not the current word
    await guess(api, h, sid, 0, answers[0])
    r = (await api.post("/api/v1/games/word_guess/finish", json={"session_id": sid}, headers=h)).json()["data"]
    assert r["score"] == 65 and r["xp_awarded"] > 0 and r["is_record"]
    assert (await api.post("/api/v1/games/word_guess/finish", json={"session_id": sid}, headers=h)).status_code == 404
    assert (await api.get("/api/v1/games/summary", headers=h)).json()["data"]["word_guess"] == 65


async def test_recent_activity_and_ranking_cover_every_player_but_not_admins(api, db):
    ha, hb, hx = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby"), await signup(api, "x@x.com", "boss")
    await db["users"].update_one({"email": "a@x.com"}, {"$set": {"full_name": "Alice Nguyen"}})
    await db["users"].update_one({"email": "x@x.com"}, {"$set": {"role": "admin"}})
    ids = {u["username"]: str(u["_id"]) async for u in db["users"].find()}
    from app.common.mongo import utcnow

    rows = [("alice", "word_bridge", 300, True), ("bobby", "vocab_rain", 120, False), ("alice", "vocab_rain", 80, False), ("boss", "word_bridge", 999, True)]
    await db["game_results"].insert_many([{"user_id": ids[u], "game": g, "mode": "default", "score": s, "correct": 5, "record": r, "created_at": utcnow()} for u, g, s, r in rows])
    act = (await api.get("/api/v1/games/activity?limit=10", headers=hb)).json()["data"]
    assert {a["name"] for a in act} == {"Alice Nguyen", "bobby"} and all(a["game_name"] for a in act) and any(a["record"] for a in act)
    top = (await api.get("/api/v1/games/ranking?game=all", headers=ha)).json()["data"]
    assert [(r["name"], r["score"]) for r in top] == [("Alice Nguyen", 380), ("bobby", 120)] and top[0]["rank"] == 1 and "level" in top[0]
    one = (await api.get("/api/v1/games/ranking?game=vocab_rain", headers=ha)).json()["data"]
    assert [(r["name"], r["score"]) for r in one] == [("bobby", 120), ("Alice Nguyen", 80)]
    assert (await api.get("/api/v1/games/ranking?game=nope", headers=ha)).status_code == 404


async def test_study_answers_award_xp_once_and_progress_is_per_topic(api, db):
    r = await db["words"].insert_many([w("tiger"), w("horse", topic="Animals"), w("pizza", topic="Food & Drink")])
    h = await signup(api)
    tiger, horse, pizza = (str(i) for i in r.inserted_ids)
    a = (await api.post("/api/v1/study/answer", json={"word_id": tiger, "correct": True}, headers=h)).json()["data"]
    assert a["newly_learned"] and a["xp_awarded"] > 0
    again = (await api.post("/api/v1/study/answer", json={"word_id": tiger, "correct": True}, headers=h)).json()["data"]
    assert not again["newly_learned"] and again["xp_awarded"] == 0
    miss = (await api.post("/api/v1/study/answer", json={"word_id": horse, "correct": False}, headers=h)).json()["data"]
    assert not miss["newly_learned"]
    await api.post("/api/v1/study/answer", json={"word_id": pizza, "correct": True}, headers=h)
    assert (await api.get("/api/v1/study/progress", headers=h)).json()["data"] == {"Animals": 1, "Food & Drink": 1}
    assert (await api.get("/api/v1/study/learned?topic=Animals", headers=h)).json()["data"] == [tiger]
    assert (await api.post("/api/v1/study/report", json={"word_id": tiger, "reason": "typo", "note": "x"}, headers=h)).status_code == 201
    assert (await api.post("/api/v1/study/report", json={"word_id": "6650f1c2e8f1b2c3d4e5f6a7", "reason": "typo"}, headers=h)).status_code == 404
    assert (await api.post("/api/v1/study/answer", json={"word_id": tiger, "correct": True})).status_code == 401
