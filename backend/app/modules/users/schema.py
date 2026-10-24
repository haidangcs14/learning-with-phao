from typing import Literal

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    full_name: str = ""
    avatar_url: str = ""
    role: Literal["user", "admin"] = "user"
    is_active: bool = True


class UserAdminUpdate(BaseModel):
    role: Literal["user", "admin"] | None = None
    is_active: bool | None = None


class ProfileUpdateIn(BaseModel):
    full_name: str | None = Field(None, max_length=100)
    username: str | None = Field(None, pattern=r"^[A-Za-z0-9_]{3,30}$")
