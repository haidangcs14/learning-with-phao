"""Optional local LLM through Ollama (https://ollama.com). Everything stays on your machine."""
import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("app.ai")

GRADER_SYSTEM = (
    "You are an English speaking examiner for learners. Judge ONLY grammar and vocabulary from the transcript. "
    "The transcript comes from speech recognition, so ignore punctuation and capitalisation. "
    'Reply with JSON only: {"grammar_score": 0-100, "vocabulary_score": 0-100, '
    '"corrections": [{"original": "...", "better": "...", "why": "short reason"}], "comments": ["short tip"]}. '
    "At most 5 corrections and 3 comments. Be encouraging and concise."
)


def _num(v) -> int | None:
    try:
        return round(max(0, min(100, float(v))))
    except (TypeError, ValueError):
        return None


def parse_grade(content: str) -> dict | None:
    """Validate/clean the model output (small models often return messy JSON)."""
    try:
        data = json.loads(content)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    fixes = []
    for c in data.get("corrections", [])[:5] if isinstance(data.get("corrections"), list) else []:
        if isinstance(c, dict) and c.get("original") and c.get("better"):
            fixes.append({k: str(c.get(k, ""))[:200] for k in ("original", "better", "why")})
    comments = [str(x)[:240] for x in data.get("comments", [])[:3]] if isinstance(data.get("comments"), list) else []
    grammar, vocab = _num(data.get("grammar_score")), _num(data.get("vocabulary_score"))
    if grammar is None and vocab is None:
        return None
    return {"grammar": grammar, "vocabulary": vocab, "corrections": fixes, "comments": comments}


async def grade_with_llm(prompt: str, transcript: str) -> dict | None:
    s = get_settings()
    body = {"model": s.llm_model, "stream": False, "format": "json", "options": {"temperature": 0.2},
            "messages": [{"role": "system", "content": GRADER_SYSTEM},
                         {"role": "user", "content": f"Speaking task: {prompt}\nTranscript:\n{transcript}"}]}
    try:
        async with httpx.AsyncClient(timeout=s.ai_timeout) as client:
            r = await client.post(f"{s.ollama_url.rstrip('/')}/api/chat", json=body)
            r.raise_for_status()
            return parse_grade(r.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, ValueError):
        logger.warning("Ollama grading failed (is Ollama running and the model pulled?)")
        return None


class OllamaLLM:
    """Chatbot provider: answers with the retrieved lessons as context."""

    async def complete(self, messages: list[dict], context: list[str]) -> str:
        s = get_settings()
        system = ("You are a friendly English tutor for Vietnamese learners. Answer clearly and briefly. "
                  "Use the context if it helps.\n\nContext:\n" + "\n".join(f"- {c}" for c in context))
        async with httpx.AsyncClient(timeout=s.ai_timeout) as client:
            r = await client.post(f"{s.ollama_url.rstrip('/')}/api/chat",
                                  json={"model": s.llm_model, "stream": False, "messages": [{"role": "system", "content": system}, *messages]})
            r.raise_for_status()
            return r.json()["message"]["content"].strip()
