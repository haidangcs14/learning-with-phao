from app.core.config import get_settings
from tests.conftest import signup

WEBM = b"\x1a\x45\xdf\xa3" + b"0" * 200


async def _session(api, db, h):
    t = await db["speaking_topics"].insert_one({"title": "T", "prompt": "Tell me", "level": "A1", "order": 0})
    r = await api.post("/api/v1/speaking/sessions", json={"topic_id": str(t.inserted_id)}, headers=h)
    return r.json()["data"]["id"]


async def test_upload_saves_result_without_ai(api, db, tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    h = await signup(api)
    sid = await _session(api, db, h)
    r = await api.post(f"/api/v1/speaking/sessions/{sid}/audio", headers=h,
                       files={"file": ("a.webm", WEBM, "audio/webm;codecs=opus")},
                       data={"transcript": "I wake up at six every day", "duration": "10"})
    d = r.json()["data"]
    assert r.status_code == 200 and d["ai_status"] == "not_configured" and d["evaluation"] is None
    assert d["metrics"]["word_count"] == 7 and d["xp_awarded"] == 20
    assert (tmp_path / "audio" / f"{sid}.webm").exists()
    assert (await api.get(f"/api/v1/speaking/sessions/{sid}/audio", headers=h)).status_code == 200
    again = await api.post(f"/api/v1/speaking/sessions/{sid}/audio", headers=h,
                           files={"file": ("a.webm", WEBM, "audio/webm")})
    assert again.status_code == 409
    get_settings.cache_clear()


async def test_rejects_non_audio(api, db):
    h = await signup(api)
    sid = await _session(api, db, h)
    r = await api.post(f"/api/v1/speaking/sessions/{sid}/audio", headers=h,
                       files={"file": ("a.webm", b"<html>evil</html>", "audio/webm")})
    assert r.status_code == 415
