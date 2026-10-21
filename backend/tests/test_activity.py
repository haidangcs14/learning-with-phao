from app.common.mongo import utcnow
from app.modules.activity.service import level
from tests.conftest import signup


def test_level_thresholds():
    assert [level(c) for c in (0, 1, 3, 6, 10)] == [0, 1, 2, 3, 4]


async def test_heatmap_shape_and_streak(api, db):
    h = await signup(api)
    uid = (await api.get("/api/v1/auth/me", headers=h)).json()["data"]["id"]
    await db["xp_events"].insert_one({"user_id": uid, "source": "quiz", "amount": 10, "created_at": utcnow()})
    d = (await api.get("/api/v1/activity/heatmap?days=30&tz=UTC", headers=h)).json()["data"]
    assert len(d["days"]) == 30 and d["active_days"] == 1 and d["current_streak"] == 1
