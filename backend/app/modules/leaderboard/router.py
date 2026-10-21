from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=ApiResponse)
async def leaderboard(period: Literal["daily", "weekly", "monthly", "all"] = "weekly",
                      limit: int = Query(50, ge=1, le=100), db=Depends(db_dependency)):
    return ApiResponse(data=await XpService(db).board(period, limit))


@router.get("/me", response_model=ApiResponse)
async def my_xp(user: CurrentUser, db=Depends(db_dependency)):
    return ApiResponse(data=await XpService(db).summary(user["id"]))
