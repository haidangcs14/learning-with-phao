from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.writing.repository import WritingRepository
from app.modules.writing.service import MAX_CHARS, WritingService

router = APIRouter(prefix="/writing", tags=["writing"])


class SubmitIn(BaseModel):
    prompt_id: str | None = Field(None, max_length=64)
    text: str = Field(min_length=1, max_length=MAX_CHARS)


def get_service(db=Depends(db_dependency)) -> WritingService:
    return WritingService(WritingRepository(db), XpService(db))


Service = Annotated[WritingService, Depends(get_service)]


@router.get("/prompts", response_model=ApiResponse)
async def prompts(service: Service, level: str | None = Query(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$")):
    return ApiResponse(data=await service.repo.list_prompts(level))


@router.post("/submissions", response_model=ApiResponse, status_code=201)
async def submit(data: SubmitIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.submit(user["id"], data.prompt_id, data.text))


@router.get("/submissions", response_model=ApiResponse)
async def history(user: CurrentUser, service: Service, page: Annotated[Pagination, Depends()]):
    items, total = await service.repo.history(user["id"], page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))


@router.get("/submissions/{sub_id}", response_model=ApiResponse)
async def detail(sub_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.detail(user["id"], sub_id))


@router.delete("/submissions/{sub_id}", response_model=ApiResponse)
async def delete(sub_id: str, user: CurrentUser, service: Service):
    await service.delete(user["id"], sub_id)
    return ApiResponse(message="Deleted")
