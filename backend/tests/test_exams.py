import json
from datetime import timedelta

from app.common.mongo import utcnow
from app.core.config import get_settings
from app.modules.exams.file_parser import Line, parse_lines, strip_tags
from tests.conftest import signup

RAW = """READING
Task 1: Mark the letter A, B, C or D to indicate the correct answer.
1. She ___ to school every day.
A. go B. goes C. going D. gone
2. I am interested ___ music.
A. on
B. in
C. at
D. for
ĐÁP ÁN
1. B 2. B
"""
WEBM = b"\x1a\x45\xdf\xa3" + b"0" * 200


def parsed():
    return parse_lines([Line(text=x, plain=strip_tags(x)) for x in RAW.split("\n") if x.strip()], "mini.docx")


async def make_exam(db, status="published"):
    p = parsed()
    r = await db["exams"].insert_one({**{k: p[k] for k in ("title", "duration_minutes", "total_score", "groups", "warnings")}, "transcript": "secret transcript",
                                      "status": status, "question_count": 2, "audio": None, "created_at": utcnow(), "updated_at": utcnow()})
    return str(r.inserted_id)


async def admin(api, db):
    h = await signup(api, "t@x.com", "teacher")
    await db["users"].update_one({"email": "t@x.com"}, {"$set": {"role": "admin"}})
    return h


async def test_students_only_see_published_exams_without_the_answer_key(api, db):
    pub, draft = await make_exam(db), await make_exam(db, "draft")
    h = await signup(api)
    ids = [e["id"] for e in (await api.get("/api/v1/exams", headers=h)).json()["data"]]
    assert ids == [pub]
    exam = (await api.get(f"/api/v1/exams/{pub}", headers=h)).json()["data"]
    text = json.dumps(exam)
    assert '"correct"' not in text and '"explanation"' not in text and "secret transcript" not in text
    assert (await api.get(f"/api/v1/exams/{draft}", headers=h)).status_code == 404
    ha = await admin(api, db)
    assert (await api.get(f"/api/v1/exams/{draft}", headers=ha)).status_code == 200   # teachers can preview drafts


async def test_attempt_flow_resume_autosave_submit_and_result(api, db):
    eid = await make_exam(db)
    h = await signup(api)
    a1 = (await api.post(f"/api/v1/exams/{eid}/start", headers=h)).json()["data"]
    a2 = (await api.post(f"/api/v1/exams/{eid}/start", headers=h)).json()["data"]
    assert a1["id"] == a2["id"] and a1["deadline"] > a1["started_at"]            # resumes instead of starting a second attempt
    aid = a1["id"]
    assert (await api.put(f"/api/v1/exams/attempts/{aid}/answers", json={"answers": {"1": "B"}}, headers=h)).json()["data"]["saved"] == 1
    assert (await api.get(f"/api/v1/exams/attempts/{aid}", headers=h)).json()["data"]["answers"] == {"1": "B"}
    assert (await api.get(f"/api/v1/exams/attempts/{aid}/result", headers=h)).status_code == 409   # not submitted yet

    res = (await api.post(f"/api/v1/exams/attempts/{aid}/submit", json={"answers": {"1": "B", "2": "C"}}, headers=h)).json()["data"]
    assert res["result"]["correct_count"] == 1 and res["result"]["score"] == 5.0 and res["result"]["max_score"] == 10.0
    assert "secret transcript" in json.dumps(res) and '"correct"' in json.dumps(res)        # keys appear only after submitting
    again = (await api.post(f"/api/v1/exams/attempts/{aid}/submit", json={"answers": {"1": "B", "2": "B"}}, headers=h)).json()["data"]
    assert again["result"]["score"] == 5.0                                                  # idempotent
    assert await db["xp_events"].count_documents({"source": "exam"}) == 1

    a3 = (await api.post(f"/api/v1/exams/{eid}/start", headers=h)).json()["data"]          # retake
    await api.post(f"/api/v1/exams/attempts/{a3['id']}/submit", json={"answers": {"1": "B", "2": "B"}}, headers=h)
    assert await db["xp_events"].count_documents({"source": "exam"}) == 1                  # XP only for the first submission


async def test_attempts_are_private_but_teachers_can_review(api, db):
    eid = await make_exam(db)
    ha, hb = await signup(api, "a@x.com", "alice"), await signup(api, "b@x.com", "bobby")
    aid = (await api.post(f"/api/v1/exams/{eid}/start", headers=ha)).json()["data"]["id"]
    await api.post(f"/api/v1/exams/attempts/{aid}/submit", json={}, headers=ha)
    assert (await api.get(f"/api/v1/exams/attempts/{aid}", headers=hb)).status_code == 404
    assert (await api.get(f"/api/v1/exams/attempts/{aid}/result", headers=hb)).status_code == 404
    ht = await admin(api, db)
    assert (await api.get(f"/api/v1/exams/attempts/{aid}/result", headers=ht)).status_code == 200
    rows = (await api.get(f"/api/v1/exams/{eid}/attempts", headers=ht)).json()["data"]
    assert rows[0]["username"] == "alice" and rows[0]["status"] == "submitted"
    assert (await api.get(f"/api/v1/exams/{eid}/attempts", headers=ha)).status_code == 403


async def test_time_is_enforced_by_the_server(api, db):
    eid = await make_exam(db)
    h = await signup(api)
    aid = (await api.post(f"/api/v1/exams/{eid}/start", headers=h)).json()["data"]["id"]
    await api.put(f"/api/v1/exams/attempts/{aid}/answers", json={"answers": {"1": "B", "2": "B"}}, headers=h)
    await db["exam_attempts"].update_one({}, {"$set": {"deadline": utcnow() - timedelta(minutes=5)}})
    view = (await api.get(f"/api/v1/exams/attempts/{aid}", headers=h)).json()["data"]
    assert view["status"] == "submitted"                                                    # auto-submitted with the saved answers
    assert (await api.get(f"/api/v1/exams/attempts/{aid}/result", headers=h)).json()["data"]["result"]["score"] == 10.0
    assert (await api.put(f"/api/v1/exams/attempts/{aid}/answers", json={"answers": {"1": "A"}}, headers=h)).json()["data"]["status"] == "submitted"


async def test_teacher_upload_edit_publish_and_validation(api, db, monkeypatch):
    monkeypatch.setattr("app.modules.exams.service.parse_file", lambda path, filename: parsed())
    ht, hs = await admin(api, db), await signup(api)
    files = {"file": ("exam.docx", b"PK\x03\x04" + b"0" * 50, "application/octet-stream")}
    assert (await api.post("/api/v1/exams/parse", files=files, headers=hs)).status_code == 403
    r = await api.post("/api/v1/exams/parse", files=files, headers=ht)
    eid = r.json()["data"]["id"]
    assert r.status_code == 201 and r.json()["data"]["status"] == "draft" and r.json()["data"]["question_count"] == 2
    assert (await api.post("/api/v1/exams/parse", files={"file": ("x.exe", b"MZ", "application/octet-stream")}, headers=ht)).status_code == 400
    assert (await api.post("/api/v1/exams/parse", files={"file": ("x.docx", b"not a zip", "application/octet-stream")}, headers=ht)).status_code == 400

    full = (await api.get(f"/api/v1/exams/{eid}/manage", headers=ht)).json()["data"]
    groups = full["groups"]
    dup = json.loads(json.dumps(groups)); dup[0]["questions"][1]["no"] = dup[0]["questions"][0]["no"]
    assert (await api.put(f"/api/v1/exams/{eid}", json={"groups": dup}, headers=ht)).status_code == 422
    nokey = json.loads(json.dumps(groups))
    for q in nokey[0]["questions"]:
        q["correct"] = []
    assert (await api.put(f"/api/v1/exams/{eid}", json={"groups": nokey, "status": "published"}, headers=ht)).status_code == 422
    ok = await api.put(f"/api/v1/exams/{eid}", json={"title": "Mini test", "duration_minutes": 20, "total_score": 20, "status": "published"}, headers=ht)
    assert ok.json()["data"]["status"] == "published" and ok.json()["data"]["title"] == "Mini test"
    assert [e["title"] for e in (await api.get("/api/v1/exams", headers=hs)).json()["data"]] == ["Mini test"]
    assert (await api.delete(f"/api/v1/exams/{eid}", headers=ht)).status_code == 200
    assert (await api.get(f"/api/v1/exams/{eid}", headers=hs)).status_code == 404


async def test_audio_upload_and_access_rules(api, db, tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path)); get_settings.cache_clear()
    eid = await make_exam(db, "draft")
    ht, hs = await admin(api, db), await signup(api)
    bad = await api.post(f"/api/v1/exams/{eid}/audio", files={"file": ("a.mp3", b"<html>", "audio/mpeg")}, headers=ht)
    assert bad.status_code == 415
    ok = await api.post(f"/api/v1/exams/{eid}/audio", files={"file": ("a.webm", WEBM, "audio/webm")}, headers=ht)
    assert ok.status_code == 200 and ok.json()["data"]["has_audio"] is True and (tmp_path / "exam_audio" / f"{eid}.webm").exists()
    assert (await api.get(f"/api/v1/exams/{eid}/audio", headers=hs)).status_code == 404    # students can't reach a draft's audio
    await api.put(f"/api/v1/exams/{eid}", json={"status": "published"}, headers=ht)
    assert (await api.get(f"/api/v1/exams/{eid}/audio", headers=hs)).status_code == 200
    await api.delete(f"/api/v1/exams/{eid}", headers=ht)
    assert not (tmp_path / "exam_audio" / f"{eid}.webm").exists()
    get_settings.cache_clear()
