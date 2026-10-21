from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.common.exceptions import AppException
from app.core.security import decode_token
from app.dependencies.database import db_dependency
from app.modules.users.repository import UserRepository

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db=Depends(db_dependency),
) -> dict:
    payload = decode_token(creds.credentials, "access") if creds else None
    if not payload:
        raise AppException(401, "NOT_AUTHENTICATED", "Not authenticated")
    user = await UserRepository(db).get_by_id(payload["sub"])
    if not user or not user["is_active"]:
        raise AppException(401, "NOT_AUTHENTICATED", "Not authenticated")
    return user


async def require_admin(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    if user["role"] != "admin":  # role is read from DB, never from the client
        raise AppException(403, "FORBIDDEN", "Admin permission required")
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]
AdminUser = Annotated[dict, Depends(require_admin)]
