from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import AdminUser, require_admin
from app.dependencies.database import db_dependency
from app.modules.admin.importer import MAX_BYTES
from app.modules.admin.repository import AdminRepository
from app.modules.admin.service import AdminService
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.users.repository import UserRepository
from app.modules.users.schema import UserAdminUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def get_service(db=Depends(db_dependency)) -> AdminService:
    return AdminService(AdminRepository(db), UserRepository(db), RefreshTokenRepository(db))


Service = Annotated[AdminService, Depends(get_service)]


class ConfirmIn(BaseModel):
    import_id: str = Field(max_length=64)


@router.get("/stats", response_model=ApiResponse)
async def stats(service: Service):
    return ApiResponse(data=await service.repo.stats())


@router.get("/users", response_model=ApiResponse)
async def list_users(service: Service, page: Annotated[Pagination, Depends()],
                     q: str | None = Query(None, max_length=100),
                     role: str | None = Query(None, pattern="^(user|admin)$")):
    items, total = await service.users.list(q=q, role=role, skip=page.skip, limit=page.limit)
    return ApiResponse(data=[UserOut(**u) for u in items], meta=page.meta(total))


@router.patch("/users/{user_id}", response_model=ApiResponse)
async def update_user(user_id: str, data: UserAdminUpdate, admin: AdminUser, service: Service):
    user = await service.update_user(admin["id"], user_id, data.model_dump(exclude_unset=True))
    return ApiResponse(data=UserOut(**user))


@router.delete("/users/{user_id}", response_model=ApiResponse)
async def delete_user(user_id: str, admin: AdminUser, service: Service):
    await service.delete_user(admin["id"], user_id)
    return ApiResponse(message="Deleted")


@router.post("/questions/import/preview", response_model=ApiResponse)
async def import_preview(admin: AdminUser, service: Service, file: Annotated[UploadFile, File()]):
    content = await file.read(MAX_BYTES + 1)
    return ApiResponse(data=await service.import_preview(admin["id"], file.filename or "", file.content_type, content))


@router.post("/questions/import/confirm", response_model=ApiResponse)
async def import_confirm(data: ConfirmIn, admin: AdminUser, service: Service):
    return ApiResponse(data={"inserted": await service.import_confirm(admin["id"], data.import_id)}, message="Imported")


@router.get("/questions", response_model=ApiResponse)
async def list_questions(service: Service, page: Annotated[Pagination, Depends()]):
    items, total = await service.repo.list_questions(page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))


@router.delete("/questions/{question_id}", response_model=ApiResponse)
async def delete_question(question_id: str, service: Service):
    await service.delete_question(question_id)
    return ApiResponse(message="Deleted")
