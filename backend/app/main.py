import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.exceptions import register_exception_handlers
from app.core import database
from app.core.config import get_settings
from app.middleware.logging import RequestLoggingMiddleware
from app.modules.activity.router import router as activity_router
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.content.router import content_routers
from app.modules.chatbot.router import router as chat_router
from app.modules.exams.router import router as exams_router
from app.modules.favorites.router import router as favorites_router
from app.modules.flashcards.router import router as flashcards_router
from app.modules.friends.router import router as friends_router
from app.modules.games.router import router as games_router
from app.modules.leaderboard.router import router as leaderboard_router
from app.modules.speaking.router import router as speaking_router
from app.modules.practice.router import router as practice_router
from app.modules.quiz.router import router as quiz_router
from app.modules.words.router import router as words_router
from app.modules.writing.router import router as writing_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await database.connect()
    yield
    await database.disconnect()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Học cùng Phao API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(app)

    @app.get("/health", tags=["system"])
    async def health():
        return {"status": "ok", "env": settings.app_env}

    api_v1 = APIRouter(prefix="/api/v1")
    for r in (auth_router, words_router, favorites_router, flashcards_router, quiz_router,
              games_router, leaderboard_router, admin_router, friends_router, speaking_router,
              chat_router, activity_router, practice_router, writing_router, exams_router, *content_routers):
        api_v1.include_router(r)
    app.include_router(api_v1)
    return app


app = create_app()
