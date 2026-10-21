from tests.conftest import signup


async def test_chat_answers_from_grammar_without_llm(api, db):
    await db["grammar_lessons"].insert_one({
        "title": "Present Simple", "slug": "present-simple", "description": "Thì hiện tại đơn",
        "formula": {"affirmative": "S + V(s/es)"}, "examples": [{"en": "She works.", "vi": "x"}]})
    h = await signup(api)
    sid = (await api.post("/api/v1/chat/sessions", json={}, headers=h)).json()["data"]["id"]
    r = await api.post(f"/api/v1/chat/sessions/{sid}/messages", json={"content": "Explain present simple"}, headers=h)
    d = r.json()["data"]
    assert "Present Simple" in d["assistant"]["content"] and d["assistant"]["sources"][0]["id"] == "present-simple"
    msgs = (await api.get(f"/api/v1/chat/sessions/{sid}/messages", headers=h)).json()["data"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]


async def test_chat_is_private(api):
    ha = await signup(api, "a@x.com", "alice")
    hb = await signup(api, "b@x.com", "bobby")
    sid = (await api.post("/api/v1/chat/sessions", json={}, headers=ha)).json()["data"]["id"]
    assert (await api.get(f"/api/v1/chat/sessions/{sid}/messages", headers=hb)).status_code == 404
