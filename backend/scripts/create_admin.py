"""Tạo tài khoản admin: python -m scripts.create_admin EMAIL USERNAME PASSWORD"""
import asyncio
import sys

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.core.security import hash_password
from app.modules.users.repository import UserRepository


async def main(email: str, username: str, password: str) -> None:
    s = get_settings()
    repo = UserRepository(AsyncIOMotorClient(s.mongodb_uri)[s.mongodb_db_name])
    if await repo.get_by_email(email):
        print("Email đã tồn tại")
        return
    await repo.create({"email": email, "username": username, "full_name": "Admin",
                       "role": "admin", "password_hash": hash_password(password)})
    print("Đã tạo admin:", email)


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:4]))
