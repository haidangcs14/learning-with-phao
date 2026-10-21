from datetime import UTC, datetime

from app.modules.flashcards.scheduler import schedule

NOW = datetime(2026, 1, 1, tzinfo=UTC)


def test_again_resets():
    r = schedule({"interval_days": 10, "repetitions": 4, "ease": 2.5}, "again", NOW)
    assert r["repetitions"] == 0 and r["interval_days"] == 0 and r["lapses"] == 1


def test_good_progression():
    c = {"interval_days": 0, "repetitions": 0, "ease": 2.5}
    r1 = schedule(c, "good", NOW)
    r2 = schedule({**c, **r1}, "good", NOW)
    assert r1["interval_days"] == 1 and r2["interval_days"] == 3


def test_easy_increases_ease_and_learned():
    r = schedule({"interval_days": 20, "repetitions": 5, "ease": 2.5}, "easy", NOW)
    assert r["ease"] > 2.5 and r["status"] == "learned"
