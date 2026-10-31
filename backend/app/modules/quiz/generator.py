"""Builds multiple-choice questions from vocabulary words (pure functions, easy to test)."""
import random

KINDS = ("word_to_meaning", "meaning_to_word", "definition_to_word")


def _label(w: dict, kind: str) -> str:
    return w["meanings"][0]["translation_vi"] if kind == "word_to_meaning" else w["word"]


def build_questions(words: list[dict], kind: str, count: int, rng: random.Random | None = None) -> list[dict]:
    rng = rng or random.Random()
    usable = [w for w in words if w.get("meanings") and w["meanings"][0].get("translation_vi")]
    if kind == "definition_to_word":
        usable = [w for w in usable if w["meanings"][0].get("definition")]
    if len({_label(w, kind) for w in usable}) < 4:
        raise ValueError("NOT_ENOUGH_WORDS")
    out = []
    for w in rng.sample(usable, min(count, len(usable))):
        m, right = w["meanings"][0], _label(w, kind)
        others = {_label(x, kind): x for x in usable if _label(x, kind) != right}
        same_pos = [k for k, x in others.items() if x["meanings"][0].get("part_of_speech") == m.get("part_of_speech")]
        labels = same_pos if len(same_pos) >= 3 else list(others)  # distractors of the same kind of word look more natural
        options = rng.sample(labels, 3) + [right]
        rng.shuffle(options)
        question = {"word_to_meaning": f"What does “{w['word']}” mean?",
                    "meaning_to_word": f"Which word means “{m['translation_vi']}”?",
                    "definition_to_word": f"Which word matches this definition: “{m['definition']}”?"}[kind]
        example = (m.get("examples") or [""])[0]
        out.append({"question": question, "options": options, "correct_answer": right,
                    "explanation": f"{w['word']} {w.get('phonetic', '')} — {m['translation_vi']}" + (f" · {example}" if example else "")})
    return out
