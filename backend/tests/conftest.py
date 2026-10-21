import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.dependencies.database import db_dependency
from app.main import app
from app.modules.words.router import get_word_service
from app.modules.words.service import WordService

SAMPLE = {
    "id": "665f1c2e8f1b2c3d4e5f6a7b", "word": "abandon", "slug": "abandon", "level": "B1",
    "topics": ["Daily Life"],
    "meanings": [{"part_of_speech": "verb", "definition": "to leave", "translation_vi": "từ bỏ"}],
}


class FakeRepo:
    async def list(self, *, q, level, topic, part_of_speech, skip, limit):
        items = [dict(SAMPLE)]
        if q and q.lower() not in "abandon":
            items = []
        return items, len(items)

    async def get_by_id(self, word_id):
        return dict(SAMPLE) if word_id == SAMPLE["id"] else None


@pytest.fixture
async def client():
    app.dependency_overrides[get_word_service] = lambda: WordService(FakeRepo())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    return AsyncMongoMockClient()["test_db"]


@pytest.fixture
async def api(db):
    app.dependency_overrides[db_dependency] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def signup(api, email="a@x.com", username="alice", password="password123"):
    await api.post("/api/v1/auth/register", json={"email": email, "username": username, "password": password})
    r = await api.post("/api/v1/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
