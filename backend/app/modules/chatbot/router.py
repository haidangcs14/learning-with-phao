import json
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.ai.local_llm import ollama_status
from app.common.responses import ApiResponse
from app.dependencies.auth import CurrentUser
from app.dependencies.database import db_dependency
from app.modules.chatbot.prompts import Level, Mode
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
    mode: Mode = "chat"
    level: Level = "B1"


@router.get("/health", response_model=ApiResponse)
async def health(user: CurrentUser):
    """Is the local model (Ollama) reachable? The widget shows a hint when it is not."""
    return ApiResponse(data=await ollama_status())


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
    return ApiResponse(data=await service.send(user["id"], session_id, data.content, data.mode, data.level))


@router.post("/sessions/{session_id}/stream")
async def stream(session_id: str, data: MessageIn, user: CurrentUser, service: Service):
    ctx = await service.begin(user["id"], session_id, data.content)  # 404/429 are raised here, before the stream starts

    async def lines():
        async for event in service.reply_stream(ctx, data.mode, data.level):
            yield json.dumps(jsonable_encoder(event), ensure_ascii=False) + "\n"  # one JSON object per line (NDJSON)

    return StreamingResponse(lines(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
