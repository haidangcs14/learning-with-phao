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
    return {"grammar": grammar, "vocabulary": vocab, "corrections": fixes, "comments": comments,
            "summary": str(data.get("summary", ""))[:600]}


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
    """Chatbot provider (the system prompt is built by the chatbot module)."""

    async def complete(self, messages: list[dict], system: str) -> str:
        s = get_settings()
        async with httpx.AsyncClient(timeout=s.ai_timeout) as client:
            r = await client.post(f"{s.ollama_url.rstrip('/')}/api/chat",
                                  json={"model": s.llm_model, "stream": False, "messages": [{"role": "system", "content": system}, *messages]})
            r.raise_for_status()
            return r.json()["message"]["content"].strip()

    def stream(self, messages: list[dict], system: str):
        return stream_chat(system, messages)


# ------------------------------------------------------------------ writing
WRITING_SYSTEM = (
    "You are an English writing examiner for learners (CEFR A1-C1). Mark the text below. "
    'Reply with JSON only: {"task_score": 0-100, "coherence_score": 0-100, "grammar_score": 0-100, "vocabulary_score": 0-100, '
    '"corrections": [{"original": "...", "better": "...", "why": "short reason"}], "comments": ["short tip"], '
    '"summary": "3-4 sentence overall assessment", "improved": "a better version of the text, same ideas, at most 150 words"}. '
    "At most 6 corrections and 3 comments. Be encouraging, concrete and concise."
)


def parse_writing_grade(content: str) -> dict | None:
    try:
        data = json.loads(content)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    scores = {k: _num(data.get(f"{k}_score")) for k in ("task", "coherence", "grammar", "vocabulary")}
    if all(v is None for v in scores.values()):
        return None
    raw = data.get("corrections")
    fixes = [{k: str(c.get(k, ""))[:200] for k in ("original", "better", "why")} for c in (raw[:6] if isinstance(raw, list) else [])
             if isinstance(c, dict) and c.get("original") and c.get("better")]
    comments = [str(x)[:240] for x in data.get("comments", [])[:3]] if isinstance(data.get("comments"), list) else []
    return {"scores": scores, "corrections": fixes, "comments": comments,
            "summary": str(data.get("summary", ""))[:800], "improved": str(data.get("improved", ""))[:1500]}


async def grade_writing_with_llm(task: str, text: str, level: str) -> dict | None:
    s = get_settings()
    body = {"model": s.llm_model, "stream": False, "format": "json", "options": {"temperature": 0.2},
            "messages": [{"role": "system", "content": WRITING_SYSTEM},
                         {"role": "user", "content": f"Level: {level or 'unknown'}\nTask: {task or 'free writing'}\nText:\n{text}"}]}
    try:
        async with httpx.AsyncClient(timeout=s.ai_timeout) as client:
            r = await client.post(f"{s.ollama_url.rstrip('/')}/api/chat", json=body)
            r.raise_for_status()
            return parse_writing_grade(r.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, ValueError):
        logger.warning("Ollama writing grading failed (is Ollama running and the model pulled?)")
        return None


# ------------------------------------------------------------------ chat (streaming)
async def stream_chat(system: str, messages: list[dict]):
    """Yields text chunks from Ollama as they are generated."""
    s = get_settings()
    body = {"model": s.llm_model, "stream": True, "messages": [{"role": "system", "content": system}, *messages]}
    async with httpx.AsyncClient(timeout=httpx.Timeout(s.ai_timeout, connect=5)) as client:
        async with client.stream("POST", f"{s.ollama_url.rstrip('/')}/api/chat", json=body) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except ValueError:
                    continue
                chunk = (data.get("message") or {}).get("content", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    break


async def ollama_status() -> dict:
    s = get_settings()
    out = {"enabled": s.ai_provider == "local" and bool(s.llm_model), "model": s.llm_model or None, "reachable": False, "model_installed": False}
    if not out["enabled"]:
        return out
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{s.ollama_url.rstrip('/')}/api/tags")
            r.raise_for_status()
            names = [m.get("name", "") for m in r.json().get("models", [])]
        out["reachable"] = True
        out["model_installed"] = s.llm_model in names or (":" not in s.llm_model and any(n.split(":")[0] == s.llm_model for n in names))
    except (httpx.HTTPError, ValueError):
        pass
    return out
