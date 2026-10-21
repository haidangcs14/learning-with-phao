from tests.conftest import signup


async def _login_cookie(api):
    await signup(api)
    r = await api.post("/api/v1/auth/login", json={"email": "a@x.com", "password": "password123"})
    return r.cookies.get("refresh_token")


def _h(token):
    return {"Cookie": f"refresh_token={token}"}


async def test_refresh_rotates_and_detects_reuse(api):
    old = await _login_cookie(api)
    r1 = await api.post("/api/v1/auth/refresh", headers=_h(old))
    assert r1.status_code == 200 and r1.json()["data"]["access_token"]
    new = r1.cookies.get("refresh_token")
    assert new and new != old
    # re-using the rotated token is treated as theft: rejected AND whole family revoked
    assert (await api.post("/api/v1/auth/refresh", headers=_h(old))).status_code == 401
    assert (await api.post("/api/v1/auth/refresh", headers=_h(new))).status_code == 401


async def test_logout_revokes_refresh_token(api):
    tok = await _login_cookie(api)
    await api.post("/api/v1/auth/logout", headers=_h(tok))
    assert (await api.post("/api/v1/auth/refresh", headers=_h(tok))).status_code == 401


async def test_refresh_without_cookie(api):
    assert (await api.post("/api/v1/auth/refresh")).status_code == 401
