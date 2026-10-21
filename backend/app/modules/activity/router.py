from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.activity.repository import ActivityRepository
from app.modules.activity.service import ActivityService

router = APIRouter(prefix="/activity", tags=["activity"])


def get_service(db=Depends(db_dependency)) -> ActivityService:
    return ActivityService(ActivityRepository(db))


@router.get("/heatmap", response_model=ApiResponse)
async def heatmap(user: CurrentUser, service: Annotated[ActivityService, Depends(get_service)],
                  days: int = Query(365, ge=7, le=400), tz: str = Query("UTC", max_length=64)):
    return ApiResponse(data=await service.heatmap(user["id"], days, tz))
