from app.common.mongo import utcnow
from app.modules.leaderboard.service import level_of
from tests.conftest import signup

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def test_level_formula_is_100_xp_per_level():
    assert [level_of(x) for x in (0, 99, 100, 250, 9999, 10000)] == [1, 1, 2, 3, 100, 101]


async def _xp(db, uid, amount, source="quiz"):
    await db["xp_events"].insert_one({"user_id": uid, "source": source, "amount": amount, "created_at": utcnow()})


async def _me(api, h):
    return (await api.get("/api/v1/auth/me", headers=h)).json()["data"]["id"]


async def test_summary_reports_level_and_progress(api, db):
    h = await signup(api)
    uid = await _me(api, h)
    await _xp(db, uid, 250)
    d = (await api.get("/api/v1/leaderboard/me", headers=h)).json()["data"]
    assert d["total_xp"] == 250 and d["level"] == 3 and d["xp_into_level"] == 50 and d["xp_for_next"] == 100


async def test_leaderboard_shows_levels_and_hides_admins(api, db):
    hp, ha = await signup(api, "p@x.com", "player"), await signup(api, "a@x.com", "boss")
    await db["users"].update_one({"email": "a@x.com"}, {"$set": {"role": "admin"}})
    await _xp(db, await _me(api, hp), 120)
    await _xp(db, await _me(api, ha), 999)
    rows = (await api.get("/api/v1/leaderboard?period=all")).json()["data"]
    assert [r["username"] for r in rows] == ["player"] and rows[0]["level"] == 2 and rows[0]["rank"] == 1


async def test_update_profile_validates_and_protects_email_and_role(api, db):
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    r = await api.patch("/api/v1/users/me", json={"full_name": "  Alice Nguyen ", "username": "alice_n", "email": "x@x.com", "role": "admin"}, headers=ha)
    d = r.json()["data"]
    assert r.status_code == 200 and d["full_name"] == "Alice Nguyen" and d["username"] == "alice_n" and d["email"] == "a@x.com" and d["role"] == "user"
    assert (await api.patch("/api/v1/users/me", json={"username": "bobby"}, headers=ha)).status_code == 409
    assert (await api.patch("/api/v1/users/me", json={"username": "no spaces"}, headers=ha)).status_code == 422
    assert (await api.patch("/api/v1/users/me", json={"username": "alice_n"}, headers=ha)).status_code == 200   # keeping your own name is fine
    assert (await api.patch("/api/v1/users/me", json={"full_name": "x"})).status_code == 401


async def test_avatar_upload_is_validated_public_and_removable(api, tmp_path, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path)); get_settings.cache_clear()
    h = await signup(api)
    uid = await _me(api, h)
    bad = await api.post("/api/v1/users/me/avatar", files={"file": ("a.png", b"<html>", "image/png")}, headers=h)
    assert bad.status_code == 415
    ok = await api.post("/api/v1/users/me/avatar", files={"file": ("a.png", PNG, "image/png")}, headers=h)
    assert ok.status_code == 200 and ok.json()["data"]["avatar_url"].startswith(f"/users/{uid}/avatar?v=")
    pic = await api.get(f"/api/v1/users/{uid}/avatar")                                  # no login needed for <img>
    assert pic.status_code == 200 and pic.headers["content-type"] == "image/png" and (tmp_path / "avatars" / f"{uid}.png").exists()
    assert (await api.get("/api/v1/users/..%2F..%2Fetc/avatar")).status_code in (404, 422)
    gone = await api.delete("/api/v1/users/me/avatar", headers=h)
    assert gone.json()["data"]["avatar_url"] == "" and (await api.get(f"/api/v1/users/{uid}/avatar")).status_code == 404
    get_settings.cache_clear()
