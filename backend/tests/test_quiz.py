from tests.conftest import signup


async def _seed(db):
    res = await db["questions"].insert_one({
        "question": "Opposite of big?", "type": "multiple_choice", "level": "A1", "topic": "Vocabulary",
        "options": ["small", "long"], "correct_answer": "small", "explanation": "x"})
    return str(res.inserted_id)


async def test_questions_hide_answers(api, db):
    await _seed(db)
    h = await signup(api)
    items = (await api.get("/api/v1/quiz/questions", headers=h)).json()["data"]
    assert items and "correct_answer" not in items[0] and "explanation" not in items[0]


async def test_submit_graded_and_xp_server_side(api, db):
    qid = await _seed(db)
    h = await signup(api)
    r = await api.post("/api/v1/quiz/submit", headers=h,
                       json={"answers": [{"question_id": qid, "answer": "small"}]})
    d = r.json()["data"]
    assert d["correct"] == 1 and d["xp_awarded"] == 10
    wrong = await api.post("/api/v1/quiz/submit", headers=h,
                           json={"answers": [{"question_id": qid, "answer": "long"}]})
    assert wrong.json()["data"]["correct"] == 0
