from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.friends.repository import FriendRepository
from app.modules.friends.service import FriendService
from app.modules.leaderboard.service import XpService

router = APIRouter(prefix="/friends", tags=["friends"])


def get_service(db=Depends(db_dependency)) -> FriendService:
    return FriendService(FriendRepository(db), XpService(db))


Service = Annotated[FriendService, Depends(get_service)]


class RequestIn(BaseModel):
    user_id: str = Field(max_length=64)


@router.get("", response_model=ApiResponse)
async def list_friends(user: CurrentUser, service: Service):
    return ApiResponse(data=await service.friends(user["id"]))


@router.get("/search", response_model=ApiResponse)
async def search(user: CurrentUser, service: Service, q: str = Query(min_length=2, max_length=50)):
    return ApiResponse(data=await service.search(user["id"], q))


@router.get("/requests", response_model=ApiResponse)
async def requests(user: CurrentUser, service: Service):
    return ApiResponse(data=await service.requests(user["id"]))


@router.post("/requests", response_model=ApiResponse, status_code=201)
async def send_request(data: RequestIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.send_request(user["id"], data.user_id), message="Request sent")


@router.post("/requests/{request_id}/accept", response_model=ApiResponse)
async def accept(request_id: str, user: CurrentUser, service: Service):
    await service.respond(user["id"], request_id, True)
    return ApiResponse(message="Accepted")


@router.post("/requests/{request_id}/reject", response_model=ApiResponse)
async def reject(request_id: str, user: CurrentUser, service: Service):
    await service.respond(user["id"], request_id, False)
    return ApiResponse(message="Rejected")


@router.get("/compare/{user_id}", response_model=ApiResponse)
async def compare(user_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.compare(user["id"], user_id))


@router.delete("/{user_id}", response_model=ApiResponse)
async def remove(user_id: str, user: CurrentUser, service: Service):
    await service.remove(user["id"], user_id)
    return ApiResponse(message="Removed")
