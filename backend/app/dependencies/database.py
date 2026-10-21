from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db


def db_dependency() -> AsyncIOMotorDatabase:
    return get_db()
