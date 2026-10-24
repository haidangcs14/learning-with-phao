import json

from tests.conftest import signup


class FakeLLM:
    def __init__(self):
        self.systems = []

    async def stream(self, messages, system):
        self.systems.append(system)
        for token in ["Hel", "lo ", "there"]:
            yield token

    async def complete(self, messages, system):
        return "Hello there"


class BrokenLLM:
    async def stream(self, messages, system):
        raise RuntimeError("ollama is down")
        yield  # pragma: no cover


async def _events(api, sid, h, **body):
    r = await api.post(f"/api/v1/chat/sessions/{sid}/stream", json={"content": "Explain present simple", **body}, headers=h)
    assert r.headers["content-type"].startswith("application/x-ndjson")
    return r, [json.loads(line) for line in r.text.splitlines() if line]


async def _session(api, h):
    return (await api.post("/api/v1/chat/sessions", json={}, headers=h)).json()["data"]["id"]


async def test_stream_tokens_then_saved_message_with_mode_and_level_in_prompt(api, monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr("app.modules.chatbot.service.get_llm", lambda: fake)
    h = await signup(api)
    sid = await _session(api, h)
    _, ev = await _events(api, sid, h, mode="grammar", level="A2")
    assert [e["text"] for e in ev if e["type"] == "token"] == ["Hel", "lo ", "there"]
    assert ev[-1]["type"] == "done" and ev[-1]["message"]["content"] == "Hello there" and ev[-1]["message"]["ai"] is True
    assert "CEFR A2" in fake.systems[0] and "grammar point" in fake.systems[0]
    saved = (await api.get(f"/api/v1/chat/sessions/{sid}/messages", headers=h)).json()["data"]
    assert [m["role"] for m in saved] == ["user", "assistant"]


async def test_stream_falls_back_to_lessons_when_the_llm_fails_or_is_off(api, db, monkeypatch):
    await db["grammar_lessons"].insert_one({"title": "Present Simple", "slug": "present-simple", "description": "Thì hiện tại đơn",
                                            "formula": {"a": "S + V"}, "examples": [{"en": "She works.", "vi": "x"}]})
    h = await signup(api)
    sid = await _session(api, h)
    _, ev = await _events(api, sid, h)                       # no LLM configured
    assert ev[-1]["type"] == "done" and "Present Simple" in ev[-1]["message"]["content"] and ev[-1]["message"]["ai"] is False
    monkeypatch.setattr("app.modules.chatbot.service.get_llm", lambda: BrokenLLM())
    _, ev2 = await _events(api, sid, h)                      # LLM configured but crashing
    assert ev2[-1]["type"] == "done" and ev2[-1]["message"]["ai"] is False


async def test_stream_errors_are_normal_http_errors_and_bad_modes_rejected(api):
    h = await signup(api)
    r = await api.post("/api/v1/chat/sessions/6650f1c2e8f1b2c3d4e5f6a7/stream", json={"content": "hi"}, headers=h)
    assert r.status_code == 404
    sid = await _session(api, h)
    assert (await api.post(f"/api/v1/chat/sessions/{sid}/stream", json={"content": "hi", "mode": "hack"}, headers=h)).status_code == 422


async def test_health_reports_disabled_without_a_local_model(api):
    h = await signup(api)
    d = (await api.get("/api/v1/chat/health", headers=h)).json()["data"]
    assert d["enabled"] is False and d["reachable"] is False
