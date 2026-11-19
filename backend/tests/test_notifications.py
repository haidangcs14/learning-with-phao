from app.modules.leaderboard.service import XpService
from app.modules.video.repository import VideoRepository
from app.modules.video.service import VideoService
from tests.conftest import signup


async def uid(db, email):
    return str((await db["users"].find_one({"email": email}))["_id"])


async def mine(api, h, limit=20):
    return (await api.get(f"/api/v1/notifications?limit={limit}", headers=h)).json()["data"]


async def test_crossing_a_level_creates_one_level_up_notification(api, db):
    h = await signup(api)
    me = await uid(db, "u@x.com")
    xp = XpService(db)
    await xp.award(me, "game", 60)                       # still level 1: nothing to say
    assert (await mine(api, h))["items"] == []
    await xp.award(me, "game", 60)                       # 120 XP: level 2
    d = await mine(api, h)
    assert d["unread"] == 1 and d["items"][0]["type"] == "level_up" and d["items"][0]["params"] == {"level": 2} and d["items"][0]["link"] == "/dashboard"
    await xp.award(me, "game", 10)
    assert (await mine(api, h))["unread"] == 1           # no new level, no new notification


async def test_friend_request_and_acceptance_notify_the_right_person(api, db):
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    await db["users"].update_one({"email": "a@x.com"}, {"$set": {"full_name": "Alice Nguyen"}})
    r = await api.post("/api/v1/friends/requests", json={"user_id": await uid(db, "b@x.com")}, headers=ha)
    assert r.status_code == 201
    n = (await mine(api, hb))["items"][0]
    assert n["type"] == "friend_request" and n["params"]["name"] == "Alice Nguyen" and n["link"] == "/friends"   # full name, not the username
    assert (await mine(api, ha))["items"] == []                                                                 # the sender gets nothing yet
    fid = str((await db["friendships"].find_one({}))["_id"])
    assert (await api.post(f"/api/v1/friends/requests/{fid}/accept", headers=hb)).status_code == 200
    n = (await mine(api, ha))["items"][0]
    assert n["type"] == "friend_accepted" and n["params"]["name"] == "bobby"                                    # no full name: username


async def test_read_read_all_delete_and_isolation(api, db):
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    a = await uid(db, "a@x.com")
    from app.modules.notifications.emit import emit

    for i in range(3):
        await emit(db, a, "announcement", {"title": f"n{i}", "body": ""})
    d = await mine(api, ha)
    assert d["unread"] == 3 and [x["params"]["title"] for x in d["items"]] == ["n2", "n1", "n0"]     # newest first
    first = d["items"][0]["id"]
    assert (await api.post(f"/api/v1/notifications/{first}/read", headers=hb)).status_code == 404    # not bobby's
    assert (await api.delete(f"/api/v1/notifications/{first}", headers=hb)).status_code == 404
    assert (await api.post(f"/api/v1/notifications/{first}/read", headers=ha)).status_code == 200
    assert (await mine(api, ha))["unread"] == 2
    assert (await api.post("/api/v1/notifications/read-all", headers=ha)).json()["data"]["updated"] == 2
    assert (await mine(api, ha))["unread"] == 0
    assert (await api.delete(f"/api/v1/notifications/{first}", headers=ha)).status_code == 200
    assert len((await mine(api, ha, limit=2))["items"]) == 2 and len((await mine(api, ha))["items"]) == 2
    assert (await api.get("/api/v1/notifications")).status_code == 401


async def test_admin_announcement_reaches_learners_only_and_links_stay_internal(api, db):
    ha, hl, hx = await signup(api, "a@x.com", "alice"), await signup(api, "l@x.com", "lena"), await signup(api, "x@x.com", "boss")
    await db["users"].update_one({"email": "x@x.com"}, {"$set": {"role": "admin"}})
    assert (await api.post("/api/v1/notifications/announcements", json={"title": "Hi"}, headers=ha)).status_code == 403
    for bad in ("https://evil.example", "//evil.example", "javascript:alert(1)"):
        assert (await api.post("/api/v1/notifications/announcements", json={"title": "Hi", "link": bad}, headers=hx)).status_code == 422
    r = await api.post("/api/v1/notifications/announcements", json={"title": "New exam", "body": "Try it", "link": "/exams"}, headers=hx)
    assert r.status_code == 201 and r.json()["data"]["sent"] == 2
    for h in (ha, hl):
        n = (await mine(api, h))["items"][0]
        assert n["type"] == "announcement" and n["params"] == {"title": "New exam", "body": "Try it"} and n["link"] == "/exams"
    assert (await mine(api, hx))["items"] == []


async def test_resolving_a_video_report_tells_the_reporter_once(api, db):
    h = await signup(api)
    me = await uid(db, "u@x.com")
    rid = (await db["video_reports"].insert_one({"lesson_id": "abc", "lesson_title": "Daily talk", "no": 1, "reason": "typo", "reporter_id": me, "status": "open"})).inserted_id
    service = VideoService(VideoRepository(db), XpService(db))
    await service.resolve_report(str(rid))
    await service.resolve_report(str(rid))                # resolving again must not notify again
    items = (await mine(api, h))["items"]
    assert len(items) == 1 and items[0]["type"] == "report_resolved" and items[0]["params"] == {"title": "Daily talk"} and items[0]["link"] == "/listening/video/abc"
