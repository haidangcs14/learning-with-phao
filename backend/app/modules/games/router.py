from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.games.repository import GameRepository
from app.modules.games.service import GAMES, GameService
from app.modules.leaderboard.service import XpService

router = APIRouter(prefix="/games", tags=["games"])


class SubmitIn(BaseModel):
    session_id: str = Field(max_length=64)
    correct: int = Field(ge=0, le=50)
    wrong: int = Field(0, ge=0, le=500)
    mode: Literal["classic", "memory"] = "classic"
    flips: int = Field(0, ge=0, le=1000)


class AnswerIn(BaseModel):
    session_id: str = Field(max_length=64)
    question_id: str = Field(max_length=64)
    answer: str = Field(max_length=200)


def get_service(db=Depends(db_dependency)) -> GameService:
    return GameService(GameRepository(db), XpService(db))


Service = Annotated[GameService, Depends(get_service)]


@router.get("", response_model=ApiResponse)
async def list_games():
    return ApiResponse(data=GAMES)


@router.post("/{game_id}/start", response_model=ApiResponse)
async def start(game_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.start(user["id"], game_id))


@router.post("/{game_id}/submit", response_model=ApiResponse)
async def submit(game_id: str, data: SubmitIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.submit(
        user["id"], game_id, data.session_id, data.correct, data.wrong, data.mode, data.flips))


@router.post("/{game_id}/answer", response_model=ApiResponse)
async def answer(game_id: str, data: AnswerIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.answer(user["id"], game_id, data.session_id, data.question_id, data.answer))


@router.get("/{game_id}/best", response_model=ApiResponse)
async def best(game_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.best(user["id"], game_id))
