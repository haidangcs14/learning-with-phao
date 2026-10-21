from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.practice.repository import PracticeRepository
from app.modules.practice.service import PracticeService

router = APIRouter(prefix="/practice", tags=["practice"])
Kind = Literal["reading", "listening"]


class SubmitIn(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=30)


def get_service(db=Depends(db_dependency)) -> PracticeService:
    return PracticeService(PracticeRepository(db), XpService(db))


Service = Annotated[PracticeService, Depends(get_service)]


@router.get("/{kind}", response_model=ApiResponse)
async def list_items(kind: Kind, service: Service, page: Annotated[Pagination, Depends()],
                     level: str | None = Query(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$"),
                     topic: str | None = Query(None, max_length=50), q: str | None = Query(None, max_length=100)):
    items, total = await service.repo.list(kind, level, topic, q, page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))


@router.get("/{kind}/progress", response_model=ApiResponse)
async def progress(kind: Kind, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.progress(user["id"], kind))


@router.get("/{kind}/{slug}", response_model=ApiResponse)
async def detail(kind: Kind, slug: str, service: Service):
    return ApiResponse(data=await service.detail(kind, slug))


@router.post("/{kind}/{slug}/submit", response_model=ApiResponse)
async def submit(kind: Kind, slug: str, data: SubmitIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.submit(user["id"], kind, slug, data.answers))
