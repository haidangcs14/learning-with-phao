from app.ai.local_llm import grade_with_llm
from app.ai.scoring import overall, score_speech
from app.core.config import get_settings


class LocalSpeakingEvaluator:
    """Rule-based scores, optionally refined by a local LLM (Ollama) for grammar and vocabulary."""

    async def evaluate(self, *, prompt: str, transcript: str, duration: float, words: list[dict]) -> dict:
        result = score_speech(prompt, transcript, duration, words)
        model = get_settings().llm_model
        if model and result["stats"]["words"] >= 10:
            graded = await grade_with_llm(prompt, transcript)
            if graded:
                if graded["grammar"] is not None:
                    result["grammar"] = round(0.4 * result["grammar"] + 0.6 * graded["grammar"])
                if graded["vocabulary"] is not None:
                    result["vocabulary"] = round(0.5 * result["vocabulary"] + 0.5 * graded["vocabulary"])
                result["corrections"] = (graded["corrections"] or result["corrections"])[:5]
                result["comments"] = graded["comments"]
                result["method"]["grammar"] = f"rules+llm:{model}"
                result["overall"] = overall(result)
                if result["stats"]["words"] < 10:
                    result["overall"] = min(result["overall"], 45)
        return result
