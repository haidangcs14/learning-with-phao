from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None


async def connect() -> None:
    global _client
    s = get_settings()
    _client = AsyncIOMotorClient(s.mongodb_uri)
    db = _client[s.mongodb_db_name]
    idx = [
        ("users", [("email", 1)], {"unique": True}),
        ("users", [("username", 1)], {"unique": True}),
        ("words", [("slug", 1)], {"unique": True}),
        ("words", [("level", 1), ("topics", 1)], {}),
        ("words", [("word", 1)], {}),
        ("favorites", [("user_id", 1), ("target_type", 1), ("target_id", 1)], {"unique": True}),
        ("word_progress", [("user_id", 1), ("word_id", 1)], {"unique": True}),
        ("word_progress", [("user_id", 1), ("next_review_at", 1)], {}),
        ("xp_events", [("user_id", 1), ("created_at", -1)], {}),
        ("xp_events", [("created_at", -1)], {}),
        ("questions", [("level", 1), ("topic", 1)], {}),
        ("quiz_attempts", [("user_id", 1), ("created_at", -1)], {}),
        ("game_results", [("user_id", 1), ("created_at", -1)], {}),
        ("ipa_sounds", [("symbol", 1)], {"unique": True}),
        ("grammar_lessons", [("slug", 1)], {"unique": True}),
        ("irregular_verbs", [("base", 1)], {"unique": True}),
        ("sentences", [("topic", 1), ("level", 1)], {}),
        ("refresh_tokens", [("jti", 1)], {"unique": True}),
        ("refresh_tokens", [("family", 1)], {}),
        ("refresh_tokens", [("expires_at", 1)], {"expireAfterSeconds": 0}),
        ("friendships", [("pair", 1)], {"unique": True}),
        ("friendships", [("receiver_id", 1), ("status", 1)], {}),
        ("friendships", [("requester_id", 1), ("status", 1)], {}),
        ("speaking_topics", [("title", 1)], {"unique": True}),
        ("speaking_sessions", [("user_id", 1), ("created_at", -1)], {}),
        ("chat_sessions", [("user_id", 1), ("updated_at", -1)], {}),
        ("chat_messages", [("session_id", 1), ("created_at", 1)], {}),
        ("practice_items", [("kind", 1), ("slug", 1)], {"unique": True}),
        ("practice_items", [("kind", 1), ("level", 1)], {}),
        ("practice_attempts", [("user_id", 1), ("kind", 1), ("slug", 1)], {}),
        ("writing_prompts", [("level", 1), ("order", 1)], {}),
        ("writing_submissions", [("user_id", 1), ("created_at", -1)], {}),
        ("exams", [("status", 1), ("created_at", -1)], {}),
        ("exam_attempts", [("exam_id", 1), ("user_id", 1), ("status", 1)], {}),
        ("exam_attempts", [("user_id", 1), ("started_at", -1)], {}),
        ("video_lessons", [("visibility", 1), ("owner_id", 1), ("created_at", -1)], {}),
        ("video_progress", [("user_id", 1), ("lesson_id", 1)], {"unique": True}),
        ("video_reports", [("status", 1), ("lesson_id", 1), ("created_at", -1)], {}),
        ("vocab_sets", [("owner_id", 1), ("position", 1)], {}),
        ("vocab_sets", [("status", 1), ("published_at", -1)], {}),
        ("vocab_cards", [("set_id", 1), ("group_id", 1), ("position", 1)], {}),
        ("card_study", [("user_id", 1), ("card_id", 1)], {"unique": True}),
        ("card_study", [("user_id", 1), ("set_id", 1), ("group_id", 1), ("learned", 1)], {}),
        ("notifications", [("user_id", 1), ("created_at", -1)], {}),
        ("notifications", [("created_at", 1)], {"expireAfterSeconds": 60 * 24 * 3600}),  # kept for 60 days
        ("word_study", [("user_id", 1), ("word_id", 1)], {"unique": True}),
        ("word_study", [("user_id", 1), ("topic", 1), ("learned", 1)], {}),
        ("import_previews", [("created_at", 1)], {"expireAfterSeconds": 1800}),
    ]
    for col, keys, opts in idx:
        await db[col].create_index(keys, **opts)


async def disconnect() -> None:
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    assert _client is not None, "Database not connected"
    return _client[get_settings().mongodb_db_name]
