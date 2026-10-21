from app.core.config import get_settings
from tests.conftest import signup

WEBM = b"\x1a\x45\xdf\xa3" + b"0" * 200


class FakeSTT:
    async def transcribe(self, path, language="en"):
        return {"text": "I like apples and bananas very much", "duration": 6.0, "engine": "fake-whisper",
                "words": [{"word": w, "start": i * 0.5, "end": i * 0.5 + 0.4, "prob": 0.9} for i, w in enumerate("I like apples and bananas very much".split())]}


class FakeEval:
    async def evaluate(self, *, prompt, transcript, duration, words):
        return {"overall": 77, "fluency": 70, "pronunciation": 80, "grammar": 90, "vocabulary": 60, "feedback": [], "corrections": [],
                "comments": [], "stats": {}, "method": {"grammar": "rules"}, "seen_words": len(words)}


async def _session(api, db, h):
    t = await db["speaking_topics"].insert_one({"title": "T", "prompt": "Tell me", "level": "A1", "order": 0, "hints": ["a?", "b?"]})
    return (await api.post("/api/v1/speaking/sessions", json={"topic_id": str(t.inserted_id)}, headers=h)).json()["data"]["id"]


async def test_server_side_transcript_replaces_the_empty_browser_one_and_is_scored(api, db, tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path)); get_settings.cache_clear()
    monkeypatch.setattr("app.modules.speaking.service.get_stt", lambda: FakeSTT())
    monkeypatch.setattr("app.modules.speaking.service.get_speaking_evaluator", lambda: FakeEval())
    h = await signup(api)
    sid = await _session(api, db, h)
    r = await api.post(f"/api/v1/speaking/sessions/{sid}/audio", headers=h, files={"file": ("a.webm", WEBM, "audio/webm")},
                       data={"transcript": "", "duration": "6"})   # the browser heard nothing
    d = r.json()["data"]
    assert d["transcript"] == "I like apples and bananas very much" and d["ai_status"] == "evaluated"
    assert d["evaluation"]["overall"] == 77 and d["evaluation"]["seen_words"] == 7 and d["evaluation"]["method"]["stt"] == "fake-whisper"
    assert d["metrics"]["word_count"] == 7
    get_settings.cache_clear()


async def test_silence_is_reported_as_no_speech(api, db, tmp_path, monkeypatch):
    class Silent:
        async def transcribe(self, path, language="en"):
            return {"text": "", "words": [], "duration": 3.0, "engine": "fake"}
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path)); get_settings.cache_clear()
    monkeypatch.setattr("app.modules.speaking.service.get_stt", lambda: Silent())
    monkeypatch.setattr("app.modules.speaking.service.get_speaking_evaluator", lambda: FakeEval())
    h = await signup(api)
    sid = await _session(api, db, h)
    d = (await api.post(f"/api/v1/speaking/sessions/{sid}/audio", headers=h, files={"file": ("a.webm", WEBM, "audio/webm")})).json()["data"]
    assert d["ai_status"] == "no_speech" and d["evaluation"] is None
    get_settings.cache_clear()


async def test_stt_crash_falls_back_to_browser_transcript(api, db, tmp_path, monkeypatch):
    class Broken:
        async def transcribe(self, path, language="en"):
            raise RuntimeError("model missing")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path)); get_settings.cache_clear()
    monkeypatch.setattr("app.modules.speaking.service.get_stt", lambda: Broken())
    monkeypatch.setattr("app.modules.speaking.service.get_speaking_evaluator", lambda: FakeEval())
    h = await signup(api)
    sid = await _session(api, db, h)
    d = (await api.post(f"/api/v1/speaking/sessions/{sid}/audio", headers=h, files={"file": ("a.webm", WEBM, "audio/webm")},
                        data={"transcript": "hello from the browser", "duration": "5"})).json()["data"]
    assert d["transcript"] == "hello from the browser" and d["ai_status"] == "evaluated" and d["evaluation"]["method"]["stt"] == "browser"
    get_settings.cache_clear()


async def test_topics_expose_hints(api, db):
    await db["speaking_topics"].insert_one({"title": "T", "prompt": "p", "level": "A1", "order": 0, "hints": ["a?", "b?"]})
    assert (await api.get("/api/v1/speaking/topics")).json()["data"][0]["hints"] == ["a?", "b?"]
