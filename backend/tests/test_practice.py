from tests.conftest import signup

ITEM = {"kind": "reading", "slug": "my-family", "title": "My Family", "level": "A1", "topic": "Family", "text": ["Hello."],
        "vocabulary": [], "word_count": 1, "question_count": 2,
        "questions": [{"q": "Q1?", "options": ["a", "b"], "answer": 1}, {"q": "Q2?", "options": ["a", "b"], "answer": 0}]}


async def test_list_and_detail_hide_answers(api, db):
    await db["practice_items"].insert_one(dict(ITEM))
    lst = (await api.get("/api/v1/practice/reading?level=A1")).json()
    assert lst["meta"]["total"] == 1 and "questions" not in lst["data"][0] and "text" not in lst["data"][0]
    detail = (await api.get("/api/v1/practice/reading/my-family")).json()["data"]
    assert all("answer" not in q for q in detail["questions"])
    assert (await api.get("/api/v1/practice/reading/nope")).status_code == 404
    assert (await api.get("/api/v1/practice/writing")).status_code == 422  # unknown kind


async def test_submit_grades_on_server_and_xp_only_for_improvement(api, db):
    await db["practice_items"].insert_one(dict(ITEM))
    h = await signup(api)
    url = "/api/v1/practice/reading/my-family/submit"
    first = (await api.post(url, json={"answers": [1, 1]}, headers=h)).json()["data"]
    assert first["correct"] == 1 and first["xp_awarded"] == 5 and first["results"][1]["answer"] == 0
    again = (await api.post(url, json={"answers": [1, 1]}, headers=h)).json()["data"]
    assert again["xp_awarded"] == 0  # same score again: no XP farming
    better = (await api.post(url, json={"answers": [1, 0]}, headers=h)).json()["data"]
    assert better["correct"] == 2 and better["xp_awarded"] == 5
    prog = (await api.get("/api/v1/practice/reading/progress", headers=h)).json()["data"]
    assert prog["completed"] == 1 and prog["best"]["my-family"]["correct"] == 2
    assert (await api.post(url, json={"answers": [1]}, headers=h)).status_code == 400
    assert (await api.post(url, json={"answers": [1, 0]})).status_code == 401


def test_seed_data_is_valid():
    from scripts.data.listening import LISTENING
    from scripts.data.reading import READING
    items = READING + LISTENING
    assert len({(i["kind"], i["slug"]) for i in items}) == len(items)
    for i in items:
        assert i["level"] in {"A1", "A2", "B1", "B2", "C1", "C2"} and i["question_count"] >= 3
        for q in i["questions"]:
            assert 0 <= q["answer"] < len(q["options"]) and len(set(q["options"])) == len(q["options"])
