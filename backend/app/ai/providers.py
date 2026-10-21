"""Ranh giới giữa nghiệp vụ và nhà cung cấp AI.

AI_PROVIDER=none  -> không dùng AI (mặc định): bài nói chỉ được lưu.
AI_PROVIDER=local -> chạy trên máy của bạn:
    - speech-to-text: faster-whisper   (pip install -r requirements-ai.txt)
    - chấm điểm:      luật + số liệu giọng nói; nếu đặt LLM_MODEL thì thêm Ollama để nhận xét ngữ pháp/từ vựng.
Không có API key nào và không dữ liệu nào rời khỏi máy.
"""
import importlib.util
import logging
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger("app.ai")


class SpeechToText(Protocol):
    async def transcribe(self, audio_path: str, language: str = "en") -> dict:
        """Returns {text, words: [{word, start, end, prob}], duration, engine}."""
        ...


class SpeakingEvaluator(Protocol):
    async def evaluate(self, *, prompt: str, transcript: str, duration: float, words: list[dict]) -> dict: ...


class LLMProvider(Protocol):
    async def complete(self, messages: list[dict], context: list[str]) -> str: ...


_stt = None
_evaluator = None
_llm = None


def _provider() -> str:
    provider = get_settings().ai_provider
    if provider not in ("none", "local"):
        logger.warning("Unknown AI_PROVIDER=%r, AI is disabled", provider)
        return "none"
    return provider


def get_stt() -> SpeechToText | None:
    global _stt
    if _provider() == "none":
        return None
    if _stt is None:
        if importlib.util.find_spec("faster_whisper") is None:
            logger.warning("faster-whisper is not installed (pip install -r requirements-ai.txt): speech-to-text is disabled")
            return None
        from app.ai.whisper_stt import FasterWhisperSTT

        _stt = FasterWhisperSTT()
    return _stt


def get_speaking_evaluator() -> SpeakingEvaluator | None:
    global _evaluator
    if _provider() == "none":
        return None
    if _evaluator is None:
        from app.ai.local_eval import LocalSpeakingEvaluator

        _evaluator = LocalSpeakingEvaluator()
    return _evaluator


def get_llm() -> LLMProvider | None:
    global _llm
    if _provider() == "none" or not get_settings().llm_model:
        return None
    if _llm is None:
        from app.ai.local_llm import OllamaLLM

        _llm = OllamaLLM()
    return _llm
