from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.chatbot.repository import ChatRepository
from app.modules.chatbot.retriever import KeywordRetriever
from app.modules.chatbot.service import ChatService

router = APIRouter(prefix="/chat", tags=["chatbot"])


def get_service(db=Depends(db_dependency)) -> ChatService:
    return ChatService(ChatRepository(db), KeywordRetriever(db))


Service = Annotated[ChatService, Depends(get_service)]


class SessionIn(BaseModel):
    title: str = Field("", max_length=80)


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


@router.post("/sessions", response_model=ApiResponse, status_code=201)
async def create_session(data: SessionIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.create_session(user["id"], data.title))


@router.get("/sessions", response_model=ApiResponse)
async def list_sessions(user: CurrentUser, service: Service):
    return ApiResponse(data=await service.repo.list_sessions(user["id"]))


@router.get("/sessions/{session_id}/messages", response_model=ApiResponse)
async def messages(session_id: str, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.messages(user["id"], session_id))


@router.post("/sessions/{session_id}/messages", response_model=ApiResponse)
async def send(session_id: str, data: MessageIn, user: CurrentUser, service: Service):
    return ApiResponse(data=await service.send(user["id"], session_id, data.content))
