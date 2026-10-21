from tests.conftest import signup

REG = {"email": "a@x.com", "username": "alice", "password": "password123"}


async def test_register_success(api):
    r = await api.post("/api/v1/auth/register", json=REG)
    d = r.json()["data"]
    assert r.status_code == 201 and d["role"] == "user" and "password_hash" not in d


async def test_register_duplicate_email(api):
    await api.post("/api/v1/auth/register", json=REG)
    r = await api.post("/api/v1/auth/register", json={**REG, "username": "bob"})
    assert r.status_code == 409 and r.json()["error_code"] == "EMAIL_TAKEN"


async def test_register_cannot_choose_role(api):
    r = await api.post("/api/v1/auth/register", json={**REG, "role": "admin"})
    assert r.json()["data"]["role"] == "user"


async def test_login_and_me(api):
    h = await signup(api)
    r = await api.get("/api/v1/auth/me", headers=h)
    assert r.status_code == 200 and r.json()["data"]["email"] == "a@x.com"


async def test_login_wrong_password(api):
    await api.post("/api/v1/auth/register", json=REG)
    r = await api.post("/api/v1/auth/login", json={"email": REG["email"], "password": "wrongpass1"})
    assert r.status_code == 401


async def test_me_requires_auth(api):
    assert (await api.get("/api/v1/auth/me")).status_code == 401


async def test_user_cannot_access_admin(api):
    h = await signup(api)
    assert (await api.get("/api/v1/admin/users", headers=h)).status_code == 403
    assert (await api.post("/api/v1/words", json={"word": "x"}, headers=h)).status_code == 403
