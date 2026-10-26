from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser, require_admin
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.video.repository import VideoRepository
from app.modules.video.schema import CheckIn, LessonCreate, ProgressIn, ReportIn, SentenceEdit
from app.modules.video.service import VideoService

router = APIRouter(prefix="/video-lessons", tags=["video-lessons"])


def get_service(db=Depends(db_dependency)) -> VideoService:
    return VideoService(VideoRepository(db), XpService(db))


Service = Annotated[VideoService, Depends(get_service)]
Admin = [Depends(require_admin)]


# ---------- admin (fixed paths first) ----------
@router.get("/admin/all", response_model=ApiResponse, dependencies=Admin)
async def admin_all(service: Service):
    return ApiResponse(data=await service.admin_list())


@router.get("/admin/reports", response_model=ApiResponse, dependencies=Admin)
async def admin_reports(service: Service, status: str = Query("open", pattern="^(open|resolved)$")):
    return ApiResponse(data=await service.repo.list_reports(status))


@router.post("/admin/reports/{report_id}/resolve", response_model=ApiResponse, dependencies=Admin)
async def admin_resolve(report_id: str, service: Service):
    await service.resolve_report(report_id)
    return ApiResponse(message="Resolved")


# ---------- learners ----------
@router.get("", response_model=ApiResponse)
async def list_lessons(user: CurrentUser, service: Service, page: Annotated[Pagination, Depends()],
                       level: str | None = Query(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$"), q: str | None = Query(None, max_length=80)):
    items, total = await service.list(user, level, q, page.skip, page.limit)
    return ApiResponse(data=items, meta=page.meta(total))


@router.post("", response_model=ApiResponse, status_code=201)
async def create_lesson(data: LessonCreate, user: CurrentUser, service: Service):
    lesson = await service.create(user, data)
    return ApiResponse(data={"id": lesson["id"], "title": lesson["title"], "sentence_count": len(lesson["sentences"])})


@router.get("/{lesson_id}", response_model=ApiResponse)
async def get_lesson(lesson_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.get(user, lesson_id))


@router.patch("/{lesson_id}/sentences/{no}", response_model=ApiResponse)
async def edit_sentence(lesson_id: str, no: int, data: SentenceEdit, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.edit_sentence(user, lesson_id, no, data), message="Updated")


@router.post("/{lesson_id}/check", response_model=ApiResponse)
async def check(lesson_id: str, data: CheckIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.check(user, lesson_id, data))


@router.put("/{lesson_id}/progress", response_model=ApiResponse)
async def save_progress(lesson_id: str, data: ProgressIn, user: CurrentUser, service: Service):
    await service.save_progress(user, lesson_id, data)
    return ApiResponse(message="Saved")


@router.post("/{lesson_id}/reports", response_model=ApiResponse, status_code=201)
async def report(lesson_id: str, data: ReportIn, user: CurrentUser, service: Service):
    await service.report(user, lesson_id, data)
    return ApiResponse(message="Reported")


@router.delete("/{lesson_id}", response_model=ApiResponse)
async def delete_lesson(lesson_id: str, user: CurrentUser, service: Service):
    await service.delete(user, lesson_id)
    return ApiResponse(message="Deleted")
