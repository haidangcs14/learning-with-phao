from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.quiz.repository import QuizRepository
from app.modules.quiz.schema import SubmitIn
from app.modules.quiz.service import QuizService

router = APIRouter(prefix="/quiz", tags=["quiz"])


def get_service(db=Depends(db_dependency)) -> QuizService:
    return QuizService(QuizRepository(db), XpService(db))


Service = Annotated[QuizService, Depends(get_service)]


@router.get("/questions", response_model=ApiResponse)
async def get_questions(user: CurrentUser, service: Service,
                        level: str | None = Query(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$"),
                        topic: str | None = Query(None, max_length=50), limit: int = Query(10, ge=1, le=50)):
    return ApiResponse(data=await service.questions(level, topic, limit))


@router.post("/submit", response_model=ApiResponse)
async def submit(data: SubmitIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.submit(user["id"], data))


@router.get("/history", response_model=ApiResponse)
async def history(user: CurrentUser, service: Service, page: Annotated[Pagination, Depends()]):
    items, total = await service.repo.history(user["id"], page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))
