from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.vocab_sets.repository import VocabSetRepository
from app.modules.vocab_sets.schema import AnswerIn, CardIn, CardPatch, GroupIn, PublishIn, ReorderIn, SetIn, SetPatch
from app.modules.vocab_sets.service import VocabSetService

router = APIRouter(prefix="/vocab-sets", tags=["vocab-sets"])


def get_service(db=Depends(db_dependency)) -> VocabSetService:
    return VocabSetService(VocabSetRepository(db), XpService(db))


Service = Annotated[VocabSetService, Depends(get_service)]


# ---- sets
@router.get("", response_model=ApiResponse)
async def list_sets(user: CurrentUser, service: Service, page: Annotated[Pagination, Depends()], scope: str = Query("public", pattern="^(public|mine)$"),
                    q: str | None = Query(None, max_length=80)):
    if scope == "mine":
        return ApiResponse(data=await service.list_mine(user))
    items, total = await service.list_public(q, page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))


@router.post("", response_model=ApiResponse, status_code=201)
async def create_set(data: SetIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.create(user, data))


@router.post("/reorder", response_model=ApiResponse)
async def reorder_sets(data: ReorderIn, user: CurrentUser, service: Service):
    await service.reorder_sets(user, data.ids)
    return ApiResponse(data=await service.list_mine(user))


@router.get("/{set_id}", response_model=ApiResponse)
async def get_set(set_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.detail(set_id, user))


@router.patch("/{set_id}", response_model=ApiResponse)
async def update_set(set_id: str, data: SetPatch, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.update(set_id, user, data))


@router.delete("/{set_id}", response_model=ApiResponse)
async def delete_set(set_id: str, user: CurrentUser, service: Service):
    await service.delete(set_id, user)
    return ApiResponse(message="Deleted")


@router.post("/{set_id}/publish", response_model=ApiResponse)
async def publish(set_id: str, data: PublishIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.publish(set_id, user, data.confirm))


@router.post("/{set_id}/unpublish", response_model=ApiResponse)
async def unpublish(set_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.unpublish(set_id, user))


# ---- groups
@router.post("/{set_id}/groups", response_model=ApiResponse, status_code=201)
async def add_group(set_id: str, data: GroupIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.add_group(set_id, user, data.title))


@router.post("/{set_id}/groups/reorder", response_model=ApiResponse)
async def reorder_groups(set_id: str, data: ReorderIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.reorder_groups(set_id, user, data.ids))


@router.patch("/{set_id}/groups/{group_id}", response_model=ApiResponse)
async def rename_group(set_id: str, group_id: str, data: GroupIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.rename_group(set_id, group_id, user, data.title))


@router.delete("/{set_id}/groups/{group_id}", response_model=ApiResponse)
async def delete_group(set_id: str, group_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.delete_group(set_id, group_id, user))


# ---- cards
@router.get("/{set_id}/cards", response_model=ApiResponse)
async def list_cards(set_id: str, user: CurrentUser, service: Service, group: str | None = Query(None, max_length=40)):
    return ApiResponse(data=await service.cards(set_id, user, group))


@router.post("/{set_id}/groups/{group_id}/cards", response_model=ApiResponse, status_code=201)
async def add_card(set_id: str, group_id: str, data: CardIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.add_card(set_id, group_id, user, data))


@router.post("/{set_id}/groups/{group_id}/cards/reorder", response_model=ApiResponse)
async def reorder_cards(set_id: str, group_id: str, data: ReorderIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.reorder_cards(set_id, group_id, user, data.ids))


@router.patch("/{set_id}/cards/{card_id}", response_model=ApiResponse)
async def update_card(set_id: str, card_id: str, data: CardPatch, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.update_card(set_id, card_id, user, data))


@router.delete("/{set_id}/cards/{card_id}", response_model=ApiResponse)
async def delete_card(set_id: str, card_id: str, user: CurrentUser, service: Service):
    await service.delete_card(set_id, card_id, user)
    return ApiResponse(message="Deleted")


# ---- learning
@router.post("/{set_id}/study/answer", response_model=ApiResponse)
async def study_answer(set_id: str, data: AnswerIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.answer(set_id, user, data.card_id, data.correct))


@router.get("/{set_id}/study/progress", response_model=ApiResponse)
async def study_progress(set_id: str, user: CurrentUser, service: Service):
    """{group_id: number of cards learned}"""
    return ApiResponse(data=await service.progress(set_id, user))


@router.get("/{set_id}/study/learned", response_model=ApiResponse)
async def study_learned(set_id: str, user: CurrentUser, service: Service, group: str = Query(max_length=40)):
    return ApiResponse(data=await service.learned(set_id, user, group))
