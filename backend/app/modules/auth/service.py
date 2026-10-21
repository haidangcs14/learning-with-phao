import hashlib
import re
import secrets
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from app.common.exceptions import AppException
from app.core.config import get_settings
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.auth.schema import ChangePasswordIn, LoginIn, RegisterIn
from app.modules.users.repository import UserRepository


def _invalid_refresh() -> AppException:
    return AppException(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token")


def _fingerprint(password_hash: str | None) -> str:
    """Binds a reset token to the current password => the link stops working once the password changes."""
    return hashlib.sha256((password_hash or "").encode()).hexdigest()[:16]


class AuthService:
    def __init__(self, users: UserRepository, tokens: RefreshTokenRepository):
        self.users, self.tokens = users, tokens

    async def register(self, data: RegisterIn) -> dict:
        if await self.users.get_by_email(data.email):
            raise AppException(409, "EMAIL_TAKEN", "Email already registered")
        if await self.users.get_by_username(data.username):
            raise AppException(409, "USERNAME_TAKEN", "Username already taken")
        try:
            # role is ALWAYS "user" here; clients can never choose it
            return await self.users.create({
                "email": data.email, "username": data.username, "full_name": data.full_name,
                "role": "user", "password_hash": hash_password(data.password),
            })
        except DuplicateKeyError as exc:
            raise AppException(409, "USER_EXISTS", "User already exists") from exc

    async def authenticate(self, data: LoginIn) -> dict:
        user = await self.users.get_by_email(data.email)
        # social-only accounts have no password_hash: they can't log in with a password
        if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
            raise AppException(401, "INVALID_CREDENTIALS", "Invalid email or password")
        if not user["is_active"]:
            raise AppException(403, "USER_INACTIVE", "Account is deactivated")
        return user

    @staticmethod
    def _access(user_id: str) -> str:
        minutes = get_settings().access_token_expire_minutes
        return create_token(user_id, "access", timedelta(minutes=minutes))

    async def start_session(self, user_id: str, remember: bool = True) -> tuple[str, str]:
        return self._access(user_id), await self.tokens.issue(user_id, remember=remember)

    async def refresh(self, token: str | None) -> tuple[dict, str, str, bool]:
        payload = decode_token(token, "refresh") if token else None
        if not payload or "jti" not in payload:
            raise _invalid_refresh()
        record = await self.tokens.consume(payload["jti"])  # rotation: old token dies here
        user = await self.users.get_by_id(payload["sub"]) if record else None
        if not user or not user["is_active"]:
            raise _invalid_refresh()
        remember = bool(record.get("remember", True))
        return user, self._access(user["id"]), await self.tokens.issue(user["id"], record["family"], remember), remember

    async def logout(self, token: str | None) -> None:
        payload = decode_token(token, "refresh") if token else None
        if payload and payload.get("fam"):
            await self.tokens.revoke_family(payload["fam"])

    async def change_password(self, user: dict, data: ChangePasswordIn) -> None:
        if not user.get("password_hash") or not verify_password(data.current_password, user["password_hash"]):
            raise AppException(400, "WRONG_PASSWORD", "Current password is incorrect")
        await self.users.update(user["id"], {"password_hash": hash_password(data.new_password)})
        await self.tokens.revoke_user(user["id"])  # sign out every device

    # ---------- forgot / reset password ----------
    async def request_reset(self, email: str) -> str | None:
        """Returns the reset link (or None). The caller must NOT reveal whether the account exists."""
        user = await self.users.get_by_email(email)
        if not user or not user["is_active"]:
            return None
        s = get_settings()
        token = create_token(user["id"], "reset", timedelta(minutes=s.password_reset_minutes),
                             ph=_fingerprint(user.get("password_hash")))
        return f"{s.frontend_url.rstrip('/')}/reset-password?token={token}"

    async def reset_password(self, token: str, new_password: str) -> None:
        payload = decode_token(token, "reset")
        user = await self.users.get_by_id(payload["sub"]) if payload else None
        if not user or not user["is_active"] or payload.get("ph") != _fingerprint(user.get("password_hash")):
            raise AppException(400, "INVALID_RESET_TOKEN", "The reset link is invalid or has expired")
        await self.users.update(user["id"], {"password_hash": hash_password(new_password)})
        await self.tokens.revoke_user(user["id"])

    # ---------- OAuth ----------
    async def _unique_username(self, email: str) -> str:
        base = re.sub(r"[^A-Za-z0-9_]", "", email.split("@")[0])[:20] or "user"
        base = base.ljust(3, "0")
        for _ in range(8):
            candidate = base if _ == 0 else f"{base}{secrets.randbelow(10000):04d}"
            if not await self.users.get_by_username(candidate):
                return candidate
        return f"user{secrets.token_hex(6)}"

    async def oauth_login(self, provider: str, profile: dict) -> dict:
        user = await self.users.get_by_provider(provider, profile["id"])
        if not user:
            email = (profile.get("email") or "").lower()
            if not email:
                raise AppException(400, "OAUTH_NO_EMAIL", "The provider did not return an email address")
            existing = await self.users.get_by_email(email)
            if existing:
                if not profile.get("email_verified"):  # never take over an account via an unverified email
                    raise AppException(409, "OAUTH_EMAIL_TAKEN", "Email already registered")
                user = await self.users.update(existing["id"], {f"providers.{provider}": profile["id"]})
            else:
                user = await self.users.create({
                    "email": email, "username": await self._unique_username(email), "full_name": profile.get("name", ""),
                    "avatar_url": profile.get("avatar", ""), "role": "user", "provider": provider,
                    "providers": {provider: profile["id"]},
                })
        if not user or not user["is_active"]:
            raise AppException(403, "USER_INACTIVE", "Account is deactivated")
        return user
