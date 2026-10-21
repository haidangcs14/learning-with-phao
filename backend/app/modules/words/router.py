from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import AdminUser
from app.dependencies.database import db_dependency
from app.modules.words.repository import WordRepository
from app.modules.words.schema import WordCreate, WordFilters, WordUpdate
from app.modules.words.service import WordService

router = APIRouter(prefix="/words", tags=["words"])


def get_word_service(db=Depends(db_dependency)) -> WordService:
    return WordService(WordRepository(db))


ServiceDep = Annotated[WordService, Depends(get_word_service)]


@router.get("", response_model=ApiResponse)
async def list_words(
    service: ServiceDep,
    page: Annotated[Pagination, Depends()],
    q: str | None = Query(None, max_length=100),
    level: str | None = Query(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$"),
    topic: str | None = Query(None, max_length=50),
    part_of_speech: str | None = Query(None, max_length=30),
):
    filters = WordFilters(q=q, level=level, topic=topic, part_of_speech=part_of_speech)
    items, meta = await service.list_words(filters, page)
    return ApiResponse(data=items, meta=meta)


@router.get("/{word_id}", response_model=ApiResponse)
async def get_word(word_id: str, service: ServiceDep):
    return ApiResponse(data=await service.get_word(word_id))


@router.post("", response_model=ApiResponse, status_code=201)
async def create_word(data: WordCreate, service: ServiceDep, _: AdminUser):
    return ApiResponse(data=await service.create(data), message="Created")


@router.patch("/{word_id}", response_model=ApiResponse)
async def update_word(word_id: str, data: WordUpdate, service: ServiceDep, _: AdminUser):
    return ApiResponse(data=await service.update(word_id, data))


@router.delete("/{word_id}", response_model=ApiResponse)
async def delete_word(word_id: str, service: ServiceDep, _: AdminUser):
    await service.delete(word_id)
    return ApiResponse(message="Deleted")
