"""Kiểm tra / tải trước AI local:  python -m scripts.warmup_ai   (cần AI_PROVIDER=local trong .env)"""
import httpx

from app.ai.providers import get_stt
from app.core.config import get_settings


def main() -> None:
    s = get_settings()
    print(f"AI_PROVIDER = {s.ai_provider}")
    stt = get_stt()
    if stt:
        print(f"Loading speech-to-text model '{s.stt_model}' (the first run downloads it, ~75-250 MB)...")
        stt._load()  # noqa: SLF001
        print("  OK")
    else:
        print("Speech-to-text is OFF (set AI_PROVIDER=local and run: pip install -r requirements-ai.txt)")
    if s.llm_model:
        try:
            names = [m["name"] for m in httpx.get(f"{s.ollama_url.rstrip('/')}/api/tags", timeout=5).json().get("models", [])]
            print(f"Ollama models: {names}")
            if not any(n.split(":")[0] == s.llm_model.split(":")[0] for n in names):
                print(f"  -> model '{s.llm_model}' not found. Run: ollama pull {s.llm_model}")
        except httpx.HTTPError:
            print(f"Ollama is not reachable at {s.ollama_url}. Start it, or leave LLM_MODEL empty to use rule-based grading only.")
    else:
        print("LLM_MODEL is empty: grammar/vocabulary use rules only (no Ollama needed).")


if __name__ == "__main__":
    main()
