from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.users.repository import UserRepository
from app.modules.users.schema import ProfileUpdateIn, UserOut
from app.modules.users.service import MAX_AVATAR, ProfileService

router = APIRouter(prefix="/users", tags=["users"])


def get_service(db=Depends(db_dependency)) -> ProfileService:
    return ProfileService(UserRepository(db))


Service = Annotated[ProfileService, Depends(get_service)]


@router.patch("/me", response_model=ApiResponse)
async def update_me(data: ProfileUpdateIn, user: CurrentUser, service: Service):
    return ApiResponse(data=UserOut(**await service.update(user, data)))


@router.post("/me/avatar", response_model=ApiResponse)
async def upload_avatar(user: CurrentUser, service: Service, file: Annotated[UploadFile, File()]):
    return ApiResponse(data=UserOut(**await service.set_avatar(user, await file.read(MAX_AVATAR + 1))))


@router.delete("/me/avatar", response_model=ApiResponse)
async def delete_avatar(user: CurrentUser, service: Service):
    return ApiResponse(data=UserOut(**await service.remove_avatar(user)))


@router.get("/{user_id}/avatar")
async def get_avatar(user_id: str, service: Service):
    """Public on purpose: an <img> tag can't send the login token (avatars are not secret)."""
    path, mime = service.avatar_file(user_id)
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "public, max-age=86400"})
