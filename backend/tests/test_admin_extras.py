import io

from app.common.mongo import utcnow
from tests.conftest import signup

CSV = ("word,phonetic,part_of_speech,definition,definition_vi,translation_vi,example,example_vi,level,topic,emoji,image_url\n"
       "umbrella,/ʌmˈbrelə/,noun,a tool for rain,dụng cụ che mưa,cái ô,Take an umbrella.,Hãy mang ô.,A1,Weather & Nature,☂️,\n"
       "borrow,/ˈbɒrəʊ/,verb,to take and return,lấy rồi trả,mượn,Can I borrow it?,Tôi mượn được không?,A2,Common Verbs,🤝,\n"
       "bad row,,noun,,,,,,A1,,,\n")


async def admin(api, db):
    h = await signup(api, "t@x.com", "teacher")
    await db["users"].update_one({"email": "t@x.com"}, {"$set": {"role": "admin"}})
    return h


async def test_words_import_preview_then_confirm_keeps_teacher_images(api, db):
    h = await admin(api, db)
    await db["words"].insert_one({"word": "umbrella", "slug": "umbrella", "image_url": "https://img.example/u.png", "meanings": [], "topics": [], "level": "A1"})
    files = {"file": ("words.csv", io.BytesIO(CSV.encode()), "text/csv")}
    prev = (await api.post("/api/v1/admin/words/import/preview", files=files, headers=h)).json()["data"]
    assert prev["valid_count"] == 2 and prev["error_count"] == 1 and prev["new_count"] == 1 and prev["update_count"] == 1 and prev["errors"][0]["row"] == 3
    assert await db["words"].count_documents({}) == 1                                   # nothing is written by the preview
    done = (await api.post("/api/v1/admin/words/import/confirm", json={"import_id": prev["import_id"]}, headers=h)).json()["data"]
    assert done == {"inserted": 1, "updated": 1}
    umb = await db["words"].find_one({"slug": "umbrella"})
    assert umb["image_url"] == "https://img.example/u.png" and umb["meanings"][0]["definition_vi"] == "dụng cụ che mưa" and umb["emoji"] == "☂️"
    assert (await api.post("/api/v1/admin/words/import/confirm", json={"import_id": prev["import_id"]}, headers=h)).status_code == 404   # one use only
    assert (await api.post("/api/v1/admin/words/import/preview", files={"file": ("w.exe", b"MZ", "application/octet-stream")}, headers=h)).status_code == 400
    assert "umbrella" in (await api.get("/api/v1/admin/words/import/template", headers=h)).text
    hs = await signup(api, "s@x.com", "student")
    assert (await api.post("/api/v1/admin/words/import/preview", files=files, headers=hs)).status_code == 403


async def test_users_table_shows_everyone_with_xp_and_level(api, db):
    h = await admin(api, db)
    for i in range(3):
        await signup(api, f"u{i}@x.com", f"user{i}")
    uid = str((await db["users"].find_one({"email": "u1@x.com"}))["_id"])
    await db["xp_events"].insert_one({"user_id": uid, "source": "quiz", "amount": 230, "created_at": utcnow()})
    r = await api.get("/api/v1/admin/users?limit=500", headers=h)
    rows = {u["username"]: u for u in r.json()["data"]}
    assert len(rows) == 4 and rows["user1"]["xp"] == 230 and rows["user1"]["level"] == 3 and rows["user0"]["level"] == 1 and "password_hash" not in rows["user1"]
    assert (await api.get("/api/v1/admin/users?limit=501", headers=h)).status_code == 422


async def test_stats_include_chart_series_and_distributions(api, db):
    h = await admin(api, db)
    hs = await signup(api, "s@x.com", "student")
    uid = str((await db["users"].find_one({"email": "s@x.com"}))["_id"])
    await db["xp_events"].insert_one({"user_id": uid, "source": "quiz", "amount": 120, "created_at": utcnow()})
    await db["words"].insert_many([{"slug": "a", "level": "A1", "topics": ["Food & Drink"]}, {"slug": "b", "level": "B1", "topics": ["Food & Drink", "Daily Life"]}])
    d = (await api.get("/api/v1/admin/stats", headers=h)).json()["data"]
    s = d["series"]
    assert len(s["dates"]) == 14 and len(s["new_users"]) == len(s["active_users"]) == len(s["events"]) == 14 and s["events"][-1] == 1 and s["new_users"][-1] == 2
    assert d["xp_by_source"] == [{"label": "quiz", "value": 120}]
    assert {x["label"]: x["value"] for x in d["words_by_level"]} == {"A1": 1, "B1": 1} and d["words_by_topic"][0] == {"label": "Food & Drink", "value": 2}
    assert {x["label"]: x["value"] for x in d["users_by_role"]} == {"user": 1, "admin": 1}
    assert {x["label"]: x["value"] for x in d["users_by_level"]}["Lv.2-3"] == 1 and "daily_active_users" in d
