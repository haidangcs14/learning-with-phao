from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser, require_admin
from app.dependencies.database import db_dependency
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_service(db=Depends(db_dependency)) -> NotificationService:
    return NotificationService(db)


Service = Annotated[NotificationService, Depends(get_service)]


class AnnounceIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    body: str = Field("", max_length=300)
    link: str = Field("", max_length=200)

    @field_validator("link")
    @classmethod
    def internal_link_only(cls, v: str) -> str:
        v = v.strip()
        if v and (not v.startswith("/") or v.startswith("//") or "\\" in v):  # a notification may only open a page of this website
            raise ValueError("link must be a path of this website, for example /exams")
        return v


@router.get("", response_model=ApiResponse)
async def list_notifications(user: CurrentUser, service: Service, limit: int = Query(20, ge=1, le=50)):
    return ApiResponse(data=await service.list(user["id"], limit))


@router.post("/read-all", response_model=ApiResponse)
async def read_all(user: CurrentUser, service: Service):
    return ApiResponse(data={"updated": await service.mark_all_read(user["id"])})


@router.post("/announcements", response_model=ApiResponse, status_code=201, dependencies=[Depends(require_admin)])
async def announce(data: AnnounceIn, service: Service):
    return ApiResponse(data={"sent": await service.announce(data.title, data.body, data.link)})


@router.post("/{notification_id}/read", response_model=ApiResponse)
async def read_one(notification_id: str, user: CurrentUser, service: Service):
    await service.mark_read(user["id"], notification_id)
    return ApiResponse(message="Read")


@router.delete("/{notification_id}", response_model=ApiResponse)
async def delete_one(notification_id: str, user: CurrentUser, service: Service):
    await service.delete(user["id"], notification_id)
    return ApiResponse(message="Deleted")
