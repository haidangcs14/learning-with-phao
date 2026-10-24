"""Explainable speaking scores computed locally. Pure functions: easy to test, no model needed.

Inputs: the transcript, the audio duration and (optionally) word timestamps/confidences from the speech recogniser.
Output: scores 0-100 + structured feedback (codes) that the frontend translates."""
import math
import re
from collections import Counter

FILLERS = {"um", "uh", "er", "erm", "uhm", "hmm", "ah"}
STOP = {"the", "and", "that", "this", "with", "for", "are", "was", "were", "have", "has", "had", "you", "your", "but", "not",
        "from", "they", "them", "there", "their", "what", "when", "where", "which", "would", "could", "will", "can", "also",
        "very", "just", "like", "because", "about", "into", "then", "than", "been", "being", "its", "our", "his", "her", "she", "him"}
PAUSE_SECONDS = 0.8
WEIGHTS = {"fluency": 0.30, "pronunciation": 0.25, "grammar": 0.25, "vocabulary": 0.20}


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z']+", text.lower())


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def speech_stats(words: list[dict], transcript: str, duration: float) -> dict:
    toks = tokenize(transcript)
    n = len(toks)
    has_timing = len(words) >= 2
    span, pauses = duration, []
    if has_timing:
        span = max(words[-1]["end"] - words[0]["start"], 0.1)  # first to last word: leading/trailing silence is ignored
        pauses = [g for g in (words[i + 1]["start"] - words[i]["end"] for i in range(len(words) - 1)) if g >= PAUSE_SECONDS]
    content = [w for w in toks if len(w) > 2 and w not in STOP and w not in FILLERS]
    top = Counter(content).most_common(1)
    return {
        "words": n, "unique": len(set(toks)), "has_timing": has_timing, "span": round(span, 1),
        "wpm": round(n / (span / 60)) if span >= 3 and n else None,
        "pauses": len(pauses), "pause_time": round(sum(pauses), 1), "pause_ratio": (sum(pauses) / span) if span else 0.0,
        "fillers": sum(1 for w in toks if w in FILLERS),
        "top_word": top[0] if top and top[0][1] >= 4 else None,
    }


def score_fluency(st: dict) -> int:
    rate = 55.0 if st["wpm"] is None else clamp(100 - abs(st["wpm"] - 125) * 1.1)  # ~125 words/min is a comfortable learner pace
    pause = clamp(100 - st["pause_ratio"] * 200) if st["has_timing"] else 70.0
    return round(clamp(0.5 * rate + 0.5 * pause - 2 * st["fillers"]))


def score_pronunciation(words: list[dict]) -> int | None:
    """Proxy: how confidently the speech recogniser recognised each word (needs word probabilities)."""
    probs = [w["prob"] for w in words if "prob" in w]
    if not probs:
        return None
    return round(clamp((sum(probs) / len(probs) - 0.35) / 0.6 * 100))


def weak_words(words: list[dict], limit: int = 5) -> list[str]:
    seen: dict[str, float] = {}
    for w in words:
        text = re.sub(r"[^a-z']", "", w.get("word", "").lower())
        if len(text) >= 3 and w.get("prob", 1) < 0.6:
            seen[text] = min(seen.get(text, 1), w["prob"])
    return [t for t, _ in sorted(seen.items(), key=lambda kv: kv[1])[:limit]]


def score_vocabulary(toks: list[str]) -> int:
    n = len(toks)
    if n < 5:
        return 30
    div = clamp((len(set(toks)) / math.sqrt(n) - 2.5) / 3.5, 0, 1)   # root type-token ratio: variety of words
    lex = clamp(sum(1 for w in toks if len(w) >= 7) / n / 0.2, 0, 1)  # share of longer, less basic words
    return round(20 + 80 * (0.65 * div + 0.35 * lex))


_THIRD = {"go": "goes", "do": "does", "study": "studies", "watch": "watches", "have": "has"}


def find_issues(text: str) -> list[dict]:
    """A small set of high-precision rules for typical learner mistakes."""
    issues: list[dict] = []

    def add(m: re.Match, better: str, why: str) -> None:
        issues.append({"original": m.group(0), "better": better, "why": why})

    f = re.I
    for m in re.finditer(r"\b(he|she|it)\s+(?:don't|do not)\b", text, f): add(m, f"{m.group(1)} doesn't", "With he/she/it use “doesn't”.")
    for m in re.finditer(r"\b(he|she|it)\s+have\b(?!\s+to)", text, f): add(m, f"{m.group(1)} has", "With he/she/it use “has”.")
    for m in re.finditer(r"\bI\s+(?:is|are)\b", text, f): add(m, "I am", "Use “I am”.")
    for m in re.finditer(r"\b(we|they|you)\s+(is|was)\b", text, f):
        add(m, f"{m.group(1)} {'are' if m.group(2).lower() == 'is' else 'were'}", "Use “are/were” with we/they/you.")
    for m in re.finditer(r"\b(he|she|it)\s+are\b", text, f): add(m, f"{m.group(1)} is", "Use “is” with he/she/it.")
    for m in re.finditer(r"\b(did not|didn't|did)\s+(?:\w*[^e\W]ed|went|saw|ate|took|came|made|got|had|gave|found|was|were)\b", text, f):
        add(m, f"{m.group(1)} + base verb", "After “did” use the base form of the verb.")
    for m in re.finditer(r"\bmore\s+(bigger|taller|better|easier|faster|smaller|older|younger|cheaper|happier|harder|stronger|longer)\b", text, f):
        add(m, m.group(1), "Don't add “more” to a comparative that already ends in -er.")
    for m in re.finditer(r"\bmost\s+(best|biggest|tallest|fastest|oldest|worst)\b", text, f):
        add(m, m.group(1), "Don't add “most” to a superlative that already ends in -est.")
    for m in re.finditer(r"\ba\s+([aeiou]\w*)", text, f):
        if not m.group(1).lower().startswith(("uni", "use", "usu", "eu", "one", "ur")):
            add(m, f"an {m.group(1)}", "Use “an” before a vowel sound.")
    for m in re.finditer(r"\ban\s+([bcdfghjklmnpqrstvwxz]\w*)", text, f):
        if not m.group(1).lower().startswith(("hour", "honest", "honor", "honour", "heir")):
            add(m, f"a {m.group(1)}", "Use “a” before a consonant sound.")
    for m in re.finditer(r"\b(he|she)\s+(go|do|like|want|live|work|study|eat|play|watch|need|love)\b", text, f):
        v = m.group(2).lower()
        add(m, f"{m.group(1)} {_THIRD.get(v, v + 's')}", "With he/she add -s/-es to the verb.")
    for m in re.finditer(r"\bpeople\s+(is|was)\b", text, f):
        add(m, f"people {'are' if m.group(1).lower() == 'is' else 'were'}", "“People” is plural.")
    for m in re.finditer(r"\bI\s+am\s+agree\b", text, f): add(m, "I agree", "“Agree” is a verb: say “I agree”.")
    for m in re.finditer(r"\bI\s+very\s+like\b", text, f): add(m, "I like … very much", "Put “very much” after the object.")
    return issues[:10]


def score_grammar_rules(n_words: int, issues: list[dict]) -> int:
    if n_words < 5:
        return 50
    return round(100 - min(75, len(issues) * 10 + len(issues) / n_words * 200))


def overall(scores: dict) -> int:
    parts = {k: v for k, v in scores.items() if k in WEIGHTS and v is not None}
    total = sum(WEIGHTS[k] for k in parts)
    return round(sum(v * WEIGHTS[k] for k, v in parts.items()) / total) if total else 0


def _fb(code: str, **params) -> dict:
    return {"code": code, "params": params}


def build_feedback(st: dict, scores: dict, issues: list[dict], words: list[dict]) -> list[dict]:
    fb, n = [], st["words"]
    if n < 25:
        fb.append(_fb("speak_longer", words=n))
    if st["wpm"] and n >= 15:
        fb.append(_fb("too_fast", wpm=st["wpm"]) if st["wpm"] > 170 else _fb("too_slow", wpm=st["wpm"]) if st["wpm"] < 80 else _fb("good_pace", wpm=st["wpm"]))
    if st["pauses"] >= 3:
        fb.append(_fb("many_pauses", n=st["pauses"]))
    if st["fillers"] >= 2:
        fb.append(_fb("fillers", n=st["fillers"]))
    weak = weak_words(words)
    if weak and (scores["pronunciation"] or 100) < 85:
        fb.append(_fb("low_clarity", words=", ".join(weak)))
    if st["top_word"]:
        fb.append(_fb("repeat_words", word=st["top_word"][0], n=st["top_word"][1]))
    if scores["vocabulary"] >= 75:
        fb.append(_fb("good_vocab"))
    if not issues and n >= 15:
        fb.append(_fb("good_grammar"))
    return fb


def score_speech(prompt: str, transcript: str, duration: float, words: list[dict]) -> dict:
    toks = tokenize(transcript)
    st = speech_stats(words, transcript, duration)
    issues = find_issues(transcript)
    scores = {"fluency": score_fluency(st), "pronunciation": score_pronunciation(words),
              "grammar": score_grammar_rules(len(toks), issues), "vocabulary": score_vocabulary(toks)}
    total = overall(scores)
    if st["words"] < 10:  # too little speech to judge fairly
        total = min(total, 45)
    return {
        **scores, "overall": total, "feedback": build_feedback(st, scores, issues, words),
        "corrections": issues[:5], "comments": [], "summary": "", "assessment": build_assessment(scores, st, issues),
        "stats": {k: st[k] for k in ("words", "unique", "wpm", "pauses", "pause_time", "fillers")},
        "method": {"pronunciation": "asr-confidence" if scores["pronunciation"] is not None else None, "grammar": "rules"},
    }


# ----------------------------------------------------------------------------- written assessment
def band_of(total: int) -> str:
    return "excellent" if total >= 85 else "good" if total >= 70 else "fair" if total >= 55 else "needs_work"


def build_assessment(scores: dict, st: dict, issues: list[dict]) -> dict:
    """Structured text assessment: the frontend turns these codes into sentences in the user's language."""
    strengths = [k for k in ("fluency", "pronunciation", "grammar", "vocabulary") if (scores.get(k) or 0) >= 75]
    improve = [k for k in ("fluency", "pronunciation", "grammar", "vocabulary") if scores.get(k) is not None and scores[k] < 65]
    tips = []
    if st["words"] < 25:
        tips.append("speak_more")
    if "fluency" in improve:
        tips.append("shadowing")
    if "pronunciation" in improve:
        tips.append("record_repeat")
    if "grammar" in improve or issues:
        tips.append("grammar_review")
    if "vocabulary" in improve:
        tips.append("new_words")
    return {"band": band_of(overall(scores)), "strengths": strengths, "improve": improve, "tips": tips[:4]}
