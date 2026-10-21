from datetime import timedelta
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.common.mongo import utcnow
from app.core.config import get_settings
from app.core.security import create_token


class RefreshTokenRepository:
    """Stores refresh-token ids (never the token itself) so they can be rotated and revoked."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.col = db["refresh_tokens"]

    async def issue(self, user_id: str, family: str | None = None, remember: bool = True) -> str:
        days = get_settings().refresh_token_expire_days if remember else 1
        ttl = timedelta(days=days)
        jti, family = uuid4().hex, family or uuid4().hex
        now = utcnow()
        await self.col.insert_one({"jti": jti, "user_id": user_id, "family": family, "remember": remember,
                                   "revoked": False, "created_at": now, "expires_at": now + ttl})
        return create_token(user_id, "refresh", ttl, jti=jti, fam=family, rem=remember)

    async def consume(self, jti: str) -> dict | None:
        """Atomically mark a token as used. A second use of the same token = theft => revoke family."""
        doc = await self.col.find_one_and_update({"jti": jti, "revoked": False}, {"$set": {"revoked": True}})
        if doc is None:
            old = await self.col.find_one({"jti": jti})
            if old:
                await self.revoke_family(old["family"])
        return doc

    async def revoke_family(self, family: str) -> None:
        await self.col.update_many({"family": family}, {"$set": {"revoked": True}})

    async def revoke_user(self, user_id: str) -> None:
        await self.col.update_many({"user_id": user_id}, {"$set": {"revoked": True}})
