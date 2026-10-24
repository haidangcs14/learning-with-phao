from app.ai.local_llm import grade_writing_with_llm
from app.ai.writing_scoring import WEIGHTS, analyze_writing
from app.core.config import get_settings


async def evaluate_writing(text: str, prompt: dict | None = None) -> dict:
    """Rule-based marking always; refined by a local LLM (Ollama) when LLM_MODEL is set."""
    result = analyze_writing(text, prompt)
    model = get_settings().llm_model
    if model and result["stats"]["words"] >= 20:
        graded = await grade_writing_with_llm((prompt or {}).get("instruction", ""), text, (prompt or {}).get("level", ""))
        if graded:
            for key, value in graded["scores"].items():
                if value is not None:
                    result[key] = round(0.4 * result[key] + 0.6 * value)  # rules 40% + LLM 60%
            seen = {c["original"] for c in result["corrections"]}
            result["corrections"] = (graded["corrections"] + [c for c in result["corrections"] if c["original"] not in seen])[:8]
            result.update(comments=graded["comments"], summary=graded["summary"], improved=graded["improved"])
            result["overall"] = round(sum(result[k] * w for k, w in WEIGHTS.items()))
            if result["stats"]["words"] < 15:
                result["overall"] = min(result["overall"], 40)
            result["method"]["llm"] = model
    return result
