from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.modules.activity.repository import ActivityRepository


def level(count: int) -> int:
    return 0 if count == 0 else 1 if count <= 2 else 2 if count <= 5 else 3 if count <= 9 else 4


class ActivityService:
    def __init__(self, repo: ActivityRepository):
        self.repo = repo

    async def heatmap(self, user_id: str, days: int, tz_name: str) -> dict:
        try:
            tz = ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, ValueError, KeyError, OSError):
            tz, tz_name = UTC, "UTC"
        today = datetime.now(tz).date()
        start_day = today - timedelta(days=days - 1)
        start_utc = datetime.combine(start_day, time.min, tzinfo=tz).astimezone(UTC)
        per_day = await self.repo.per_day(user_id, start_utc, tz_name)

        out = []
        for i in range(days):
            key = (start_day + timedelta(days=i)).isoformat()
            e = per_day.get(key, {"count": 0, "xp": 0})
            out.append({"date": key, "count": e["count"], "xp": e["xp"], "level": level(e["count"])})

        longest = run = 0
        for d in out:
            run = run + 1 if d["count"] > 0 else 0
            longest = max(longest, run)
        idx = len(out) - 1
        if out[idx]["count"] == 0:  # today not studied yet: the streak is still alive until midnight
            idx -= 1
        current = 0
        while idx >= 0 and out[idx]["count"] > 0:
            current, idx = current + 1, idx - 1
        return {"days": out, "current_streak": current, "longest_streak": longest,
                "active_days": sum(1 for d in out if d["count"] > 0),
                "total": sum(d["count"] for d in out), "timezone": tz_name}
