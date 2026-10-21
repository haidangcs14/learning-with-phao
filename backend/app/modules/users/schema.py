from typing import Literal

from pydantic import BaseModel


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
