from typing import Annotated

from fastapi import APIRouter, Depends

from app.common.exceptions import NotFoundError
from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.favorites.service import FavoriteIn, FavoriteService, TargetType

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.post("", response_model=ApiResponse, status_code=201)
async def add_favorite(data: FavoriteIn, user: CurrentUser, db=Depends(db_dependency)):
    await FavoriteService(db).add(user["id"], data)
    return ApiResponse(message="Added to favorites")


@router.get("", response_model=ApiResponse)
async def list_favorites(user: CurrentUser, page: Annotated[Pagination, Depends()],
                         target_type: TargetType | None = None, db=Depends(db_dependency)):
    items, total = await FavoriteService(db).list(user["id"], target_type, page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))


@router.delete("/{target_id}", response_model=ApiResponse)
async def remove_favorite(target_id: str, user: CurrentUser, target_type: TargetType = "word",
                          db=Depends(db_dependency)):
    if not await FavoriteService(db).remove(user["id"], target_type, target_id):
        raise NotFoundError("FAVORITE_NOT_FOUND", "Favorite not found")
    return ApiResponse(message="Removed")
