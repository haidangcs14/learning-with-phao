from app.core.config import get_settings
from tests.conftest import signup

WEBM = b"\x1a\x45\xdf\xa3" + b"0" * 200


async def _new_session(api, db, h):
    t = await db["speaking_topics"].insert_one({"title": "T", "prompt": "Tell me", "level": "A1", "order": 0})
    return (await api.post("/api/v1/speaking/sessions", json={"topic_id": str(t.inserted_id)}, headers=h)).json()["data"]["id"]


async def test_history_lists_only_submitted_and_delete_removes_file(api, db, tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    h = await signup(api)
    abandoned = await _new_session(api, db, h)   # topic chosen, nothing recorded
    done = await _new_session(api, db, h)
    await api.post(f"/api/v1/speaking/sessions/{done}/audio", headers=h, files={"file": ("a.webm", WEBM, "audio/webm")},
                   data={"transcript": "hello there", "duration": "5"})
    ids = [s["id"] for s in (await api.get("/api/v1/speaking/sessions", headers=h)).json()["data"]]
    assert ids == [done] and abandoned not in ids
    assert abandoned in [s["id"] for s in (await api.get("/api/v1/speaking/sessions?only_submitted=false", headers=h)).json()["data"]]

    assert (tmp_path / "audio" / f"{done}.webm").exists()
    assert (await api.delete(f"/api/v1/speaking/sessions/{done}", headers=h)).status_code == 200
    assert not (tmp_path / "audio" / f"{done}.webm").exists()
    assert (await api.get(f"/api/v1/speaking/sessions/{done}/result", headers=h)).status_code == 404
    get_settings.cache_clear()


async def test_cannot_delete_someone_elses_session(api, db):
    ha = await signup(api, "a@x.com", "alice")
    hb = await signup(api, "b@x.com", "bobby")
    sid = await _new_session(api, db, ha)
    assert (await api.delete(f"/api/v1/speaking/sessions/{sid}", headers=hb)).status_code == 404
