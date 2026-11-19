"""Creates a notification for one user. A notification never carries translated text: it stores a `type` and `params`
and the frontend renders it in the language the user has chosen."""
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import utcnow

log = logging.getLogger("app.notifications")
TYPES = {"level_up", "friend_request", "friend_accepted", "report_resolved", "announcement"}


async def emit(db: AsyncIOMotorDatabase, user_id: str, type_: str, params: dict | None = None, link: str = "") -> None:
    """Best effort: a failed notification must never break the action that caused it."""
    try:
        await db["notifications"].insert_one({"user_id": user_id, "type": type_, "params": params or {}, "link": link, "read": False, "created_at": utcnow()})
    except Exception:  # noqa: BLE001
        log.warning("could not create notification %s for %s", type_, user_id, exc_info=True)
