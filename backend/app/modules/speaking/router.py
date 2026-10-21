from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.common.exceptions import NotFoundError
from app.common.pagination import Pagination
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.leaderboard.service import XpService
from app.modules.speaking.repository import SpeakingRepository
from app.modules.speaking.service import MAX_AUDIO_BYTES, MIME_BY_EXT, SpeakingService, audio_path

router = APIRouter(prefix="/speaking", tags=["speaking"])


def get_service(db=Depends(db_dependency)) -> SpeakingService:
    return SpeakingService(SpeakingRepository(db), XpService(db))


Service = Annotated[SpeakingService, Depends(get_service)]


class SessionIn(BaseModel):
    topic_id: str = Field(max_length=64)


@router.get("/topics", response_model=ApiResponse)
async def topics(service: Service):
    return ApiResponse(data=await service.repo.list_topics())


@router.post("/sessions", response_model=ApiResponse, status_code=201)
async def create_session(data: SessionIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.create_session(user["id"], data.topic_id))


@router.get("/sessions", response_model=ApiResponse)
async def history(user: CurrentUser, service: Service, page: Annotated[Pagination, Depends()],
                  only_submitted: bool = True):
    items, total = await service.repo.history(user["id"], page.skip, page.limit, only_submitted)
    return ApiResponse(data=items, meta=page.meta(total))


@router.post("/sessions/{session_id}/audio", response_model=ApiResponse)
async def upload_audio(session_id: str, user: CurrentUser, service: Service,
                       file: Annotated[UploadFile, File()], transcript: Annotated[str, Form()] = "",
                       duration: Annotated[float, Form()] = 0.0):
    content = await file.read(MAX_AUDIO_BYTES + 1)
    result = await service.submit_audio(user["id"], session_id, content, file.content_type, transcript, duration)
    return ApiResponse(data=result, message="Saved")


@router.get("/sessions/{session_id}/result", response_model=ApiResponse)
async def result(session_id: str, user: CurrentUser, service: Service):
    session = await service.repo.get_session(session_id, user["id"])
    if not session:
        raise NotFoundError("SESSION_NOT_FOUND", "Session not found")
    return ApiResponse(data=session)


@router.get("/sessions/{session_id}/audio")
async def get_audio(session_id: str, user: CurrentUser, service: Service):
    session = await service.repo.get_session(session_id, user["id"])
    if not session or not session.get("audio"):
        raise NotFoundError("AUDIO_NOT_FOUND", "Audio not found")
    ext = session["audio"]["ext"]
    path = audio_path(session["id"], ext)
    if not path.exists():
        raise NotFoundError("AUDIO_NOT_FOUND", "Audio not found")
    return FileResponse(path, media_type=MIME_BY_EXT.get(ext, "application/octet-stream"))


@router.delete("/sessions/{session_id}", response_model=ApiResponse)
async def delete_session(session_id: str, user: CurrentUser, service: Service):
    await service.delete_session(user["id"], session_id)
    return ApiResponse(message="Deleted")
