from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.flashcards.repository import FlashcardRepository
from app.modules.flashcards.schema import AddCardIn, ReviewIn
from app.modules.flashcards.service import FlashcardService
from app.modules.leaderboard.service import XpService

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


def get_service(db=Depends(db_dependency)) -> FlashcardService:
    return FlashcardService(FlashcardRepository(db), XpService(db))


Service = Annotated[FlashcardService, Depends(get_service)]


@router.post("", response_model=ApiResponse, status_code=201)
async def add_card(data: AddCardIn, user: CurrentUser, service: Service):
    await service.add(user["id"], data.word_id)
    return ApiResponse(message="Added to learning list")


@router.get("/due", response_model=ApiResponse)
async def due_cards(user: CurrentUser, service: Service, limit: int = Query(20, ge=1, le=100)):
    return ApiResponse(data=await service.due(user["id"], limit))


@router.post("/review", response_model=ApiResponse)
async def review(data: ReviewIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.review(user["id"], data.word_id, data.rating))


@router.get("/stats", response_model=ApiResponse)
async def stats(user: CurrentUser, service: Service):
    return ApiResponse(data=await service.stats(user["id"]))
