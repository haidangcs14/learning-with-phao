from tests.conftest import signup

SRT = "1\n00:00:01,000 --> 00:00:03,000\nI get up at six.\n\n2\n00:00:03,500 --> 00:00:06,000\nThen I have breakfast.\n\n3\n00:00:06,500 --> 00:00:09,000\nI go to work by bus.\n"
BODY = {"url": "https://youtu.be/dQw4w9WgXcQ", "title": "My routine", "level": "A2", "category": "Daily life", "transcript": SRT}


async def admin(api, db):
    h = await signup(api, "t@x.com", "teacher")
    await db["users"].update_one({"email": "t@x.com"}, {"$set": {"role": "admin"}})
    return h


async def make(api, h, **over):
    r = await api.post("/api/v1/video-lessons", json={**BODY, **over}, headers=h)
    return r, (r.json()["data"]["id"] if r.status_code == 201 else None)


async def test_create_validates_the_link_and_the_transcript(api):
    h = await signup(api)
    r, lid = await make(api, h)
    assert r.status_code == 201 and r.json()["data"]["sentence_count"] == 3
    assert (await make(api, h, url="https://vimeo.com/1234567"))[0].status_code == 422
    assert (await make(api, h, transcript="no timestamps here at all"))[0].status_code == 422
    assert (await api.post("/api/v1/video-lessons", json=BODY)).status_code == 401


async def test_visibility_private_for_learners_public_for_teachers(api, db):
    ha, hb, ht = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby"), await admin(api, db)
    _, mine = await make(api, ha)
    _, shared = await make(api, ht, title="Teacher lesson")
    titles = lambda r: sorted(x["title"] for x in r.json()["data"])  # noqa: E731
    assert titles(await api.get("/api/v1/video-lessons", headers=ha)) == ["My routine", "Teacher lesson"]
    assert titles(await api.get("/api/v1/video-lessons", headers=hb)) == ["Teacher lesson"]
    assert (await api.get(f"/api/v1/video-lessons/{mine}", headers=hb)).status_code == 404
    assert (await api.get(f"/api/v1/video-lessons/{shared}", headers=hb)).json()["data"]["can_edit"] is False
    assert (await api.get(f"/api/v1/video-lessons/{mine}", headers=ht)).status_code == 200      # teachers see everything


async def test_check_scores_saves_progress_and_awards_xp_once_per_sentence(api, db):
    h = await signup(api)
    _, lid = await make(api, h)
    r = (await api.post(f"/api/v1/video-lessons/{lid}/check", json={"no": 1, "answer": "i get up at six", "mode": "hard"}, headers=h)).json()["data"]
    assert r["accuracy"] == 100 and r["xp_awarded"] > 0 and r["completion"] == 33
    again = (await api.post(f"/api/v1/video-lessons/{lid}/check", json={"no": 1, "answer": "I get up at six.", "mode": "hard"}, headers=h)).json()["data"]
    assert again["xp_awarded"] == 0 and await db["xp_events"].count_documents({"source": "video_listening"}) == 1
    bad = (await api.post(f"/api/v1/video-lessons/{lid}/check", json={"no": 2, "answer": "then breakfast"}, headers=h)).json()["data"]
    assert bad["missing"] == 2 and bad["xp_awarded"] == 0
    await api.put(f"/api/v1/video-lessons/{lid}/progress", json={"answers": {"3": "I go to work"}, "mode": "easy"}, headers=h)
    d = (await api.get(f"/api/v1/video-lessons/{lid}", headers=h)).json()["data"]
    assert d["progress"]["answers"]["3"] == "I go to work" and d["progress"]["results"]["1"]["accuracy"] == 100 and d["progress"]["completion"] == 33
    listing = (await api.get("/api/v1/video-lessons", headers=h)).json()["data"][0]
    assert listing["completion"] == 33 and listing["sentence_count"] == 3 and "sentences" not in listing
    assert (await api.post(f"/api/v1/video-lessons/{lid}/check", json={"no": 9, "answer": "x"}, headers=h)).status_code == 404


async def test_editing_a_sentence_is_validated_and_limited_to_the_owner(api, db):
    ha, hb, ht = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby"), await admin(api, db)
    _, lid = await make(api, ha)
    await api.post(f"/api/v1/video-lessons/{lid}/check", json={"no": 2, "answer": "Then I have breakfast"}, headers=ha)
    url = f"/api/v1/video-lessons/{lid}/sentences/2"
    ok = await api.patch(url, json={"text": " Then I eat breakfast. ", "start": 3.6, "end": 6.1}, headers=ha)
    assert ok.status_code == 200 and ok.json()["data"]["text"] == "Then I eat breakfast."
    assert "2" not in (await api.get(f"/api/v1/video-lessons/{lid}", headers=ha)).json()["data"]["progress"]["results"]   # must be re-checked
    assert (await api.patch(url, json={"text": "", "start": 3.6, "end": 6}, headers=ha)).status_code == 422
    assert (await api.patch(url, json={"text": "x", "start": 5, "end": 4}, headers=ha)).status_code == 422
    assert (await api.patch(url, json={"text": "x", "start": 7, "end": 8}, headers=ha)).status_code == 422             # beyond the next line
    assert (await api.patch(url, json={"text": "x", "start": 1, "end": 3}, headers=ha)).status_code == 422             # before the previous line
    assert (await api.patch(url, json={"text": "x", "start": 3.6, "end": 6}, headers=hb)).status_code == 404           # not even visible
    _, shared = await make(api, ht)
    assert (await api.patch(f"/api/v1/video-lessons/{shared}/sentences/1", json={"text": "x", "start": 1, "end": 2}, headers=hb)).status_code == 403


async def test_reports_have_validation_duplicates_and_an_admin_queue(api, db):
    ha, hb, ht = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby"), await admin(api, db)
    _, lid = await make(api, ht)
    url = f"/api/v1/video-lessons/{lid}/reports"
    assert (await api.post(url, json={"no": 1, "reason": "other", "note": "x"}, headers=ha)).status_code == 422
    assert (await api.post(url, json={"no": 1, "reason": "wrong_text"}, headers=ha)).status_code == 201
    assert (await api.post(url, json={"no": 1, "reason": "wrong_text"}, headers=ha)).status_code == 409
    assert (await api.post(url, json={"no": 1, "reason": "wrong_time"}, headers=hb)).status_code == 201
    assert (await api.get("/api/v1/video-lessons/admin/reports", headers=ha)).status_code == 403
    rows = (await api.get("/api/v1/video-lessons/admin/reports", headers=ht)).json()["data"]
    assert len(rows) == 2 and {r["reporter_name"] for r in rows} == {"alice", "bobby"}
    assert (await api.get("/api/v1/video-lessons/admin/all", headers=ht)).json()["data"][0]["open_reports"] == 2
    assert (await api.post(f"/api/v1/video-lessons/admin/reports/{rows[0]['id']}/resolve", headers=ht)).status_code == 200
    assert len((await api.get("/api/v1/video-lessons/admin/reports", headers=ht)).json()["data"]) == 1


async def test_delete_is_for_the_owner_or_a_teacher(api, db):
    ha, hb, ht = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby"), await admin(api, db)
    _, lid = await make(api, ha)
    assert (await api.delete(f"/api/v1/video-lessons/{lid}", headers=hb)).status_code == 404
    assert (await api.delete(f"/api/v1/video-lessons/{lid}", headers=ha)).status_code == 200
    _, lid2 = await make(api, ha)
    assert (await api.delete(f"/api/v1/video-lessons/{lid2}", headers=ht)).status_code == 200
