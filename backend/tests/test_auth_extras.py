import re
from urllib.parse import parse_qs, urlparse

import pytest

from app.core.config import get_settings
from tests.conftest import signup


@pytest.fixture
def oauth_env(monkeypatch):
    for k, v in {"GOOGLE_CLIENT_ID": "gid", "GOOGLE_CLIENT_SECRET": "gsecret", "FACEBOOK_CLIENT_ID": "fid", "FACEBOOK_CLIENT_SECRET": "fsecret"}.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def test_weak_password_rejected(api):
    r = await api.post("/api/v1/auth/register", json={"email": "a@x.com", "username": "alice", "password": "abcdefgh"})
    assert r.status_code == 422


async def test_remember_false_uses_session_cookie(api):
    await signup(api)
    r = await api.post("/api/v1/auth/login", json={"email": "a@x.com", "password": "password123", "remember": False})
    assert "refresh_token=" in r.headers["set-cookie"] and "max-age" not in r.headers["set-cookie"].lower()
    r2 = await api.post("/api/v1/auth/login", json={"email": "a@x.com", "password": "password123", "remember": True})
    assert "max-age" in r2.headers["set-cookie"].lower()


async def test_forgot_and_reset_password(api, monkeypatch):
    await signup(api)
    sent = {}
    monkeypatch.setattr("app.modules.auth.router.send_email", lambda to, subject, body: sent.update(to=to, body=body))
    ok = await api.post("/api/v1/auth/forgot-password", json={"email": "a@x.com"})
    unknown = await api.post("/api/v1/auth/forgot-password", json={"email": "nobody@x.com"})
    assert ok.json() == unknown.json()  # same answer: the endpoint doesn't reveal which emails exist
    token = re.search(r"token=([\w.\-]+)", sent["body"]).group(1)

    assert (await api.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "short"})).status_code == 422
    assert (await api.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "newpass123"})).status_code == 200
    assert (await api.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "another123"})).status_code == 400  # single use
    login = await api.post("/api/v1/auth/login", json={"email": "a@x.com", "password": "newpass123"})
    assert login.status_code == 200
    assert (await api.post("/api/v1/auth/login", json={"email": "a@x.com", "password": "password123"})).status_code == 401


async def test_oauth_not_configured_redirects_with_error(api):
    r = await api.get("/api/v1/auth/google/login", follow_redirects=False)
    assert r.status_code == 302 and "error=oauth_not_configured" in r.headers["location"]


async def _run_oauth(api, monkeypatch, provider, profile):
    async def fake_profile(_provider, _code):
        return profile
    monkeypatch.setattr("app.modules.auth.router.fetch_profile", fake_profile)
    start = await api.get(f"/api/v1/auth/{provider}/login", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    nonce = start.cookies["oauth_nonce"]
    return await api.get(f"/api/v1/auth/{provider}/callback", params={"code": "abc", "state": state},
                         headers={"Cookie": f"oauth_nonce={nonce}"}, follow_redirects=False)


async def test_google_login_creates_user_and_sets_refresh_cookie(api, db, oauth_env, monkeypatch):
    r = await _run_oauth(api, monkeypatch, "google", {"id": "g-1", "email": "new@x.com", "email_verified": True, "name": "New User", "avatar": ""})
    assert r.status_code == 302 and r.headers["location"].endswith("/oauth/callback") and "refresh_token=" in r.headers["set-cookie"]
    user = await db["users"].find_one({"email": "new@x.com"})
    assert user and user["providers"] == {"google": "g-1"} and "password_hash" not in user and user["role"] == "user"
    # a social-only account cannot sign in with a password
    assert (await api.post("/api/v1/auth/login", json={"email": "new@x.com", "password": "whatever123"})).status_code == 401


async def test_oauth_state_mismatch_is_rejected(api, oauth_env, monkeypatch):
    async def fake_profile(_p, _c):
        return {"id": "1", "email": "a@x.com", "email_verified": True}
    monkeypatch.setattr("app.modules.auth.router.fetch_profile", fake_profile)
    start = await api.get("/api/v1/auth/google/login", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    r = await api.get("/api/v1/auth/google/callback", params={"code": "abc", "state": state},
                      headers={"Cookie": "oauth_nonce=forged"}, follow_redirects=False)
    assert "error=oauth_state" in r.headers["location"]


async def test_facebook_cannot_take_over_existing_email(api, oauth_env, monkeypatch):
    await signup(api, "a@x.com", "alice")
    r = await _run_oauth(api, monkeypatch, "facebook", {"id": "f-1", "email": "a@x.com", "email_verified": False, "name": "X"})
    assert "error=oauth_email_taken" in r.headers["location"]


async def test_google_verified_email_links_existing_account(api, db, oauth_env, monkeypatch):
    await signup(api, "a@x.com", "alice")
    r = await _run_oauth(api, monkeypatch, "google", {"id": "g-9", "email": "a@x.com", "email_verified": True, "name": "A"})
    assert r.headers["location"].endswith("/oauth/callback")
    assert (await db["users"].find_one({"email": "a@x.com"}))["providers"] == {"google": "g-9"}
