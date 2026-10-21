from tests.conftest import signup


async def _me(api, h):
    return (await api.get("/api/v1/auth/me", headers=h)).json()["data"]["id"]


async def test_friend_flow(api):
    ha = await signup(api, "a@x.com", "alice")
    hb = await signup(api, "b@x.com", "bobby")
    bid, aid = await _me(api, hb), await _me(api, ha)

    assert (await api.post("/api/v1/friends/requests", json={"user_id": bid}, headers=ha)).status_code == 201
    assert (await api.post("/api/v1/friends/requests", json={"user_id": bid}, headers=ha)).status_code == 409
    assert (await api.post("/api/v1/friends/requests", json={"user_id": aid}, headers=ha)).status_code == 400

    incoming = (await api.get("/api/v1/friends/requests", headers=hb)).json()["data"]["incoming"]
    rid = incoming[0]["id"]
    # the sender cannot accept their own request
    assert (await api.post(f"/api/v1/friends/requests/{rid}/accept", headers=ha)).status_code == 404
    assert (await api.post(f"/api/v1/friends/requests/{rid}/accept", headers=hb)).status_code == 200

    friends = (await api.get("/api/v1/friends", headers=ha)).json()["data"]
    assert [f["username"] for f in friends] == ["bobby"]
    cmp = await api.get(f"/api/v1/friends/compare/{bid}", headers=ha)
    assert cmp.status_code == 200 and "weekly" in cmp.json()["data"]["me"]


async def test_cannot_compare_with_stranger(api):
    ha = await signup(api, "a@x.com", "alice")
    hb = await signup(api, "b@x.com", "bobby")
    assert (await api.get(f"/api/v1/friends/compare/{await _me(api, hb)}", headers=ha)).status_code == 403
