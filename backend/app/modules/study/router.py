from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.study.repository import StudyRepository
from app.modules.study.service import StudyService

router = APIRouter(prefix="/study", tags=["study"])


def get_service(db=Depends(db_dependency)) -> StudyService:
    return StudyService(StudyRepository(db), XpService(db))


Service = Annotated[StudyService, Depends(get_service)]


class AnswerIn(BaseModel):
    word_id: str = Field(max_length=64)
    correct: bool


class ReportIn(BaseModel):
    word_id: str = Field(max_length=64)
    reason: Literal["wrong_meaning", "wrong_example", "typo", "other"]
    note: str = Field("", max_length=300)


@router.post("/answer", response_model=ApiResponse)
async def answer(data: AnswerIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.answer(user["id"], data.word_id, data.correct))


@router.get("/progress", response_model=ApiResponse)
async def progress(user: CurrentUser, service: Service):
    """{topic: number of words the user has learned}"""
    return ApiResponse(data=await service.repo.learned_by_topic(user["id"]))


@router.get("/learned", response_model=ApiResponse)
async def learned(user: CurrentUser, service: Service, topic: str = Query(max_length=50)):
    return ApiResponse(data=await service.repo.learned_ids(user["id"], topic))


@router.post("/report", response_model=ApiResponse, status_code=201)
async def report(data: ReportIn, user: CurrentUser, service: Service):
    await service.report(user, data.word_id, data.reason, data.note)
    return ApiResponse(message="Reported")
