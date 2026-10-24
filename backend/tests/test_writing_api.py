from tests.conftest import signup

TEXT = ("Last weekend I went to Da Lat with my friend. We visited a garden and we had lunch in the market. "
        "However, it rained, so we stayed in a cafe. I really enjoyed the trip and I want to go again next year.")


async def _prompt(db):
    r = await db["writing_prompts"].insert_one({"title": "An Email", "level": "A2", "instruction": "Write", "min_words": 20, "max_words": 80,
                                                 "keywords": ["weekend", "friend"], "hints": ["a"], "order": 0})
    return str(r.inserted_id)


async def test_submit_grade_history_detail_delete(api, db):
    pid = await _prompt(db)
    h = await signup(api)
    assert (await api.get("/api/v1/writing/prompts?level=A2")).json()["data"][0]["title"] == "An Email"
    r = await api.post("/api/v1/writing/submissions", json={"prompt_id": pid, "text": TEXT}, headers=h)
    d = r.json()["data"]
    assert r.status_code == 201 and d["evaluation"]["overall"] > 50 and d["xp_awarded"] > 0 and d["title"] == "An Email"
    assert d["evaluation"]["assessment"]["band"] and d["evaluation"]["method"]["scoring"] == "rules"

    lst = (await api.get("/api/v1/writing/submissions", headers=h)).json()["data"]
    assert len(lst) == 1 and "text" not in lst[0] and lst[0]["overall"] == d["overall"]
    assert (await api.get(f"/api/v1/writing/submissions/{d['id']}", headers=h)).json()["data"]["text"].startswith("Last weekend")
    assert (await api.delete(f"/api/v1/writing/submissions/{d['id']}", headers=h)).status_code == 200
    assert (await api.get(f"/api/v1/writing/submissions/{d['id']}", headers=h)).status_code == 404


async def test_too_short_free_writing_and_privacy(api, db):
    ha = await signup(api, "a@x.com", "alice")
    hb = await signup(api, "b@x.com", "bobby")
    assert (await api.post("/api/v1/writing/submissions", json={"text": "Hi there"}, headers=ha)).status_code == 400
    free = await api.post("/api/v1/writing/submissions", json={"text": TEXT}, headers=ha)   # free writing: no prompt
    assert free.status_code == 201 and free.json()["data"]["title"] == ""
    sid = free.json()["data"]["id"]
    assert (await api.get(f"/api/v1/writing/submissions/{sid}", headers=hb)).status_code == 404
    assert (await api.post("/api/v1/writing/submissions", json={"text": TEXT})).status_code == 401
