import asyncio
import re
from pathlib import Path
from time import time

from pymongo.errors import DuplicateKeyError

from app.common.exceptions import AppException, NotFoundError
from app.core.config import get_settings
from app.modules.users.repository import UserRepository
from app.modules.users.schema import ProfileUpdateIn

MAX_AVATAR = 2 * 1024 * 1024
MIME = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}
_BACKEND_DIR = Path(__file__).resolve().parents[3]


def sniff_image(b: bytes) -> str | None:
    """Real format from the magic bytes: the client's file name / MIME type are never trusted."""
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    return None


def avatar_path(user_id: str, ext: str) -> Path:
    base = Path(get_settings().storage_dir)
    return (base if base.is_absolute() else _BACKEND_DIR / base) / "avatars" / f"{user_id}.{ext}"


def find_avatar(user_id: str) -> tuple[Path, str] | None:
    if not re.fullmatch(r"[0-9a-f]{24}", user_id):
        return None
    for ext, mime in MIME.items():
        path = avatar_path(user_id, ext)
        if path.exists():
            return path, mime
    return None


class ProfileService:
    def __init__(self, users: UserRepository):
        self.users = users

    async def update(self, user: dict, data: ProfileUpdateIn) -> dict:
        fields = data.model_dump(exclude_unset=True)  # the email and the role can never be changed here
        if "full_name" in fields:
            fields["full_name"] = (fields["full_name"] or "").strip()
        if fields.get("username") and fields["username"] != user["username"]:
            if await self.users.get_by_username(fields["username"]):
                raise AppException(409, "USERNAME_TAKEN", "Username already taken")
        else:
            fields.pop("username", None)
        if not fields:
            return user
        try:
            return await self.users.update(user["id"], fields)
        except DuplicateKeyError as exc:
            raise AppException(409, "USERNAME_TAKEN", "Username already taken") from exc

    async def _delete_files(self, user_id: str) -> None:
        for ext in MIME:
            await asyncio.to_thread(avatar_path(user_id, ext).unlink, True)

    async def set_avatar(self, user: dict, content: bytes) -> dict:
        ext = sniff_image(content[:16]) if content else None
        if not content or len(content) > MAX_AVATAR or not ext:
            raise AppException(415, "UNSUPPORTED_IMAGE", "Upload a PNG, JPEG or WebP image up to 2MB")
        await self._delete_files(user["id"])
        path = avatar_path(user["id"], ext)
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, content)
        # ?v= changes on every upload so browsers don't show the old picture from cache
        return await self.users.update(user["id"], {"avatar_url": f"/users/{user['id']}/avatar?v={int(time())}"})

    async def remove_avatar(self, user: dict) -> dict:
        await self._delete_files(user["id"])
        return await self.users.update(user["id"], {"avatar_url": ""})

    @staticmethod
    def avatar_file(user_id: str) -> tuple[Path, str]:
        found = find_avatar(user_id)
        if not found:
            raise NotFoundError("AVATAR_NOT_FOUND", "No avatar")
        return found
