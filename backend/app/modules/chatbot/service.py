from app.ai.providers import get_llm
from app.common.exceptions import AppException, NotFoundError
from app.modules.chatbot.repository import ChatRepository
from app.modules.chatbot.retriever import KeywordRetriever

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

    async def send(self, user_id: str, session_id: str, content: str) -> dict:
        session = await self._own(user_id, session_id)
        if await self.repo.count_messages(session_id) >= MAX_MESSAGES:
            raise AppException(429, "CHAT_LIMIT", "This conversation is too long, please start a new one")
        history = await self.repo.list_messages(session_id, limit=10)
        user_msg = await self.repo.add_message(session_id, user_id, "user", content)
        context = await self.retriever.search(content)
        llm = get_llm()
        reply = None
        if llm:
            try:
                reply = await llm.complete([{"role": m["role"], "content": m["content"]} for m in history]
                                           + [{"role": "user", "content": content}], [c["text"] for c in context])
            except Exception:  # Ollama stopped/slow: fall back to the lesson-based answer
                llm = None
        if reply is None:
            reply = fallback_reply(context)
        sources = [{"type": c["type"], "id": c["id"], "title": c["title"]} for c in context]
        assistant = await self.repo.add_message(session_id, user_id, "assistant", reply,
                                                {"sources": sources, "ai": bool(llm)})
        first = session["title"] == "Cuộc trò chuyện mới"
        await self.repo.touch(session_id, content[:40] if first else None)
        return {"user": user_msg, "assistant": assistant}
