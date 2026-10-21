from datetime import datetime, timedelta

RATINGS = ("again", "hard", "good", "easy")


def schedule(card: dict, rating: str, now: datetime) -> dict:
    """Simplified SM-2. Pure function so it is trivial to unit test / swap for FSRS later."""
    ease = card.get("ease", 2.5)
    interval = card.get("interval_days", 0)
    reps = card.get("repetitions", 0)
    lapses = card.get("lapses", 0)

    if rating == "again":
        reps, lapses, interval = 0, lapses + 1, 0
        ease = max(1.3, ease - 0.2)
        due = now + timedelta(minutes=10)
    else:
        if rating == "hard":
            interval = max(1, round(interval * 1.2))
            ease = max(1.3, ease - 0.15)
        elif rating == "good":
            interval = 1 if reps == 0 else 3 if reps == 1 else round(interval * ease)
        else:  # easy
            interval = 4 if reps == 0 else max(4, round(max(interval, 1) * ease * 1.3))
            ease += 0.15
        reps += 1
        due = now + timedelta(days=interval)

    return {
        "ease": round(ease, 2), "interval_days": interval, "repetitions": reps, "lapses": lapses,
        "status": "learned" if interval >= 21 else "learning",
        "next_review_at": due, "last_reviewed_at": now,
    }
