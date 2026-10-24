from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.common.responses import ApiResponse
from app.dependencies.auth import AdminUser, CurrentUser, require_admin
from app.dependencies.database import db_dependency
from app.modules.exams.repository import ExamRepository
from app.modules.exams.schema import AnswersIn, UpdateExamIn
from app.modules.exams.service import MAX_AUDIO, MAX_EXAM_FILE, ExamService, summary
from app.modules.leaderboard.service import XpService

router = APIRouter(prefix="/exams", tags=["exams"])


def get_service(db=Depends(db_dependency)) -> ExamService:
    return ExamService(ExamRepository(db), XpService(db))


Service = Annotated[ExamService, Depends(get_service)]
Admin = [Depends(require_admin)]


class SubmitIn(BaseModel):
    answers: dict[str, str] | None = None


# ---------- teacher / admin (fixed paths first) ----------
@router.get("/manage", response_model=ApiResponse, dependencies=Admin)
async def manage_list(service: Service):
    return ApiResponse(data=await service.manage_list())


@router.post("/parse", response_model=ApiResponse, status_code=201)
async def parse_upload(admin: AdminUser, service: Service, file: Annotated[UploadFile, File()]):
    content = await file.read(MAX_EXAM_FILE + 1)
    exam = await service.create_from_upload(admin["id"], file.filename or "", content)
    return ApiResponse(data={**summary(exam), "warnings": exam["warnings"]}, message="Parsed")


# ---------- students: attempts ----------
@router.get("/attempts/{attempt_id}", response_model=ApiResponse)
async def get_attempt(attempt_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.get_attempt(user, attempt_id))


@router.put("/attempts/{attempt_id}/answers", response_model=ApiResponse)
async def save_answers(attempt_id: str, data: AnswersIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.save_answers(user, attempt_id, data.answers))


@router.post("/attempts/{attempt_id}/submit", response_model=ApiResponse)
async def submit(attempt_id: str, user: CurrentUser, service: Service, data: SubmitIn | None = None):
    answers = AnswersIn(answers=data.answers).answers if data and data.answers is not None else None
    return ApiResponse(data=await service.submit(user, attempt_id, answers))


@router.get("/attempts/{attempt_id}/result", response_model=ApiResponse)
async def result(attempt_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.result(user, attempt_id))


# ---------- students: exams ----------
@router.get("", response_model=ApiResponse)
async def student_list(user: CurrentUser, service: Service):
    return ApiResponse(data=await service.student_list(user["id"]))


@router.get("/{exam_id}", response_model=ApiResponse)
async def public_exam(exam_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.public(user, exam_id))


@router.get("/{exam_id}/audio")
async def exam_audio(exam_id: str, user: CurrentUser, service: Service):
    path, mime = await service.audio_file(user, exam_id)
    return FileResponse(path, media_type=mime)


@router.post("/{exam_id}/start", response_model=ApiResponse)
async def start(exam_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.start(user, exam_id))


# ---------- teacher / admin ----------
@router.get("/{exam_id}/manage", response_model=ApiResponse, dependencies=Admin)
async def manage_get(exam_id: str, service: Service):
    return ApiResponse(data=await service.manage_get(exam_id))


@router.put("/{exam_id}", response_model=ApiResponse, dependencies=Admin)
async def update(exam_id: str, data: UpdateExamIn, service: Service):
    return ApiResponse(data=await service.update(exam_id, data))


@router.delete("/{exam_id}", response_model=ApiResponse, dependencies=Admin)
async def delete(exam_id: str, service: Service):
    await service.delete(exam_id)
    return ApiResponse(message="Deleted")


@router.post("/{exam_id}/audio", response_model=ApiResponse, dependencies=Admin)
async def upload_audio(exam_id: str, service: Service, file: Annotated[UploadFile, File()]):
    exam = await service.set_audio(exam_id, await file.read(MAX_AUDIO + 1))
    return ApiResponse(data=summary(exam))


@router.delete("/{exam_id}/audio", response_model=ApiResponse, dependencies=Admin)
async def remove_audio(exam_id: str, service: Service):
    await service.remove_audio(exam_id)
    return ApiResponse(message="Deleted")


@router.get("/{exam_id}/attempts", response_model=ApiResponse, dependencies=Admin)
async def attempts(exam_id: str, service: Service):
    return ApiResponse(data=await service.attempts_of(exam_id))
