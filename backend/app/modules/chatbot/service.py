import logging
from collections.abc import AsyncIterator

from app.ai.providers import get_llm
from app.common.exceptions import AppException, NotFoundError
from app.modules.chatbot.prompts import build_system_prompt
from app.modules.chatbot.repository import ChatRepository
from app.modules.chatbot.retriever import KeywordRetriever

logger = logging.getLogger("app.chat")
MAX_MESSAGES = 200


def fallback_reply(context: list[dict]) -> str:
    if not context:
        return ("Mình chưa tìm thấy nội dung phù hợp trong kho học liệu. Bạn thử hỏi về một thì, "
                "một từ vựng hoặc một động từ bất quy tắc (ví dụ: \"Present Perfect\", \"abandon\", \"go\"). "
                "Khi mô hình AI được kết nối, mình sẽ trả lời tự do hơn.")
    body = "\n\n".join(f"• {c['text']}" for c in context)
    return f"Mô hình AI chưa được kết nối, đây là nội dung liên quan trong kho học liệu:\n\n{body}"


class ChatService:
    def __init__(self, repo: ChatRepository, retriever: KeywordRetriever):
        self.repo, self.retriever = repo, retriever

    async def create_session(self, user_id: str, title: str) -> dict:
        return await self.repo.create_session(user_id, title or "Cuộc trò chuyện mới")

    async def _own(self, user_id: str, session_id: str) -> dict:
        s = await self.repo.get_session(session_id, user_id)
        if not s:
            raise NotFoundError("CHAT_NOT_FOUND", "Chat session not found")
        return s

    async def messages(self, user_id: str, session_id: str) -> list[dict]:
        await self._own(user_id, session_id)
        return await self.repo.list_messages(session_id)

    async def begin(self, user_id: str, session_id: str, content: str) -> dict:
        """Checks + saves the user's message + gathers context. Raises BEFORE any streaming starts."""
        session = await self._own(user_id, session_id)
        if await self.repo.count_messages(session_id) >= MAX_MESSAGES:
            raise AppException(429, "CHAT_LIMIT", "This conversation is too long, please start a new one")
        history = await self.repo.list_messages(session_id, limit=10)
        user_msg = await self.repo.add_message(session_id, user_id, "user", content)
        context = await self.retriever.search(content)
        first = session["title"] == "Cuộc trò chuyện mới"
        return {"user_id": user_id, "session_id": session_id, "user_msg": user_msg, "context": context, "first_title": content[:40] if first else None,
                "messages": [{"role": m["role"], "content": m["content"]} for m in history] + [{"role": "user", "content": content}]}

    async def _finish(self, ctx: dict, reply: str, used_llm: bool) -> dict:
        sources = [{"type": c["type"], "id": c["id"], "title": c["title"]} for c in ctx["context"]]
        assistant = await self.repo.add_message(ctx["session_id"], ctx["user_id"], "assistant", reply, {"sources": sources, "ai": used_llm})
        await self.repo.touch(ctx["session_id"], ctx["first_title"])
        return assistant

    async def reply_stream(self, ctx: dict, mode: str = "chat", level: str = "B1") -> AsyncIterator[dict]:
        """Events: {"type": "token", "text"} ... {"type": "done", "message"}. Falls back to the lesson-based answer if the LLM is off/failing."""
        llm, parts = get_llm(), []
        if llm:
            try:
                system = build_system_prompt(mode, level, [c["text"] for c in ctx["context"]])
                async for token in llm.stream(ctx["messages"], system):
                    parts.append(token)
                    yield {"type": "token", "text": token}
            except Exception:  # Ollama stopped / model missing / timeout
                logger.warning("LLM stream failed", exc_info=True)
        reply = "".join(parts).strip()
        used_llm = bool(reply)
        if not reply:
            reply = fallback_reply(ctx["context"])
            yield {"type": "token", "text": reply}
        yield {"type": "done", "message": await self._finish(ctx, reply, used_llm)}

    async def send(self, user_id: str, session_id: str, content: str, mode: str = "chat", level: str = "B1") -> dict:
        ctx = await self.begin(user_id, session_id, content)
        assistant = None
        async for event in self.reply_stream(ctx, mode, level):
            if event["type"] == "done":
                assistant = event["message"]
        return {"user": ctx["user_msg"], "assistant": assistant}
