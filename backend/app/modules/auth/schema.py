import re

from pydantic import BaseModel, EmailStr, Field, field_validator


def check_password(value: str) -> str:
    """Same rules as the checklist in the UI: >= 8 chars, at least one letter and one digit."""
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one digit")
    return value


class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(pattern=r"^[A-Za-z0-9_]{3,30}$")
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field("", max_length=100)

    _pw = field_validator("password")(check_password)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)
    remember: bool = True  # False => session cookie + short refresh token lifetime


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    _pw = field_validator("new_password")(check_password)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(max_length=2000)
    new_password: str = Field(min_length=8, max_length=128)

    _pw = field_validator("new_password")(check_password)
