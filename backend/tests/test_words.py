async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


async def test_list_words(client):
    r = await client.get("/api/v1/words")
    body = r.json()
    assert r.status_code == 200 and body["success"] is True
    assert body["data"][0]["word"] == "abandon"
    assert body["meta"] == {"page": 1, "limit": 20, "total": 1, "total_pages": 1}


async def test_search_no_match(client):
    r = await client.get("/api/v1/words", params={"q": "zzz"})
    assert r.json()["data"] == [] and r.json()["meta"]["total"] == 0


async def test_invalid_level_returns_422(client):
    r = await client.get("/api/v1/words", params={"level": "Z9"})
    assert r.status_code == 422 and r.json()["error_code"] == "VALIDATION_ERROR"


async def test_word_not_found(client):
    r = await client.get("/api/v1/words/doesnotexist")
    assert r.status_code == 404 and r.json()["error_code"] == "WORD_NOT_FOUND"


async def test_word_detail(client):
    r = await client.get("/api/v1/words/665f1c2e8f1b2c3d4e5f6a7b")
    assert r.status_code == 200 and r.json()["data"]["slug"] == "abandon"
