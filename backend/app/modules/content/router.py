import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.common.exceptions import NotFoundError
from app.common.mongo import serialize, to_oid
from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.database import db_dependency


def build_content_router(*, prefix: str, tag: str, collection: str, search_field: str,
                         filter_fields: tuple[str, ...], sort: list[tuple[str, int]],
                         key_field: str | None = None) -> APIRouter:
    """Read-only API for curated learning content (list/search/filter/random/detail)."""
    router = APIRouter(prefix=prefix, tags=[tag])

    def build_query(request: Request, q: str | None) -> dict:
        query: dict = {}
        if q:
            query[search_field] = {"$regex": re.escape(q), "$options": "i"}
        for f in filter_fields:  # whitelist; values are plain strings => no operator injection
            if v := request.query_params.get(f):
                query[f] = v[:50]
        return query

    @router.get("", response_model=ApiResponse)
    async def list_items(request: Request, page: Annotated[Pagination, Depends()],
                         q: str | None = Query(None, max_length=100), db=Depends(db_dependency)):
        query = build_query(request, q)
        total = await db[collection].count_documents(query)
        cur = db[collection].find(query).sort(sort).skip(page.skip).limit(page.limit)
        return ApiResponse(data=[serialize(d) async for d in cur], meta=page.meta(total))

    @router.get("/random", response_model=ApiResponse)
    async def random_items(request: Request, n: int = Query(10, ge=1, le=50), db=Depends(db_dependency)):
        pipeline = [{"$match": build_query(request, None)}, {"$sample": {"size": n}}]
        return ApiResponse(data=[serialize(d) async for d in db[collection].aggregate(pipeline)])

    @router.get("/{item_id}", response_model=ApiResponse)
    async def get_item(item_id: str, db=Depends(db_dependency)):
        doc = None
        if key_field:
            doc = await db[collection].find_one({key_field: item_id})
        if doc is None and (oid := to_oid(item_id)):
            doc = await db[collection].find_one({"_id": oid})
        if doc is None:
            raise NotFoundError(f"{tag.upper()}_NOT_FOUND", "Not found")
        return ApiResponse(data=serialize(doc))

    return router


content_routers = [
    build_content_router(prefix="/ipa", tag="ipa", collection="ipa_sounds", search_field="symbol",
                         filter_fields=("type", "category", "voiced"), sort=[("order", 1)]),
    build_content_router(prefix="/grammar", tag="grammar", collection="grammar_lessons",
                         search_field="title", filter_fields=("level",), sort=[("order", 1)],
                         key_field="slug"),
    build_content_router(prefix="/irregular-verbs", tag="irregular-verbs", collection="irregular_verbs",
                         search_field="base", filter_fields=(), sort=[("base", 1)]),
    build_content_router(prefix="/sentences", tag="sentences", collection="sentences",
                         search_field="english", filter_fields=("topic", "level"), sort=[("_id", 1)]),
]
