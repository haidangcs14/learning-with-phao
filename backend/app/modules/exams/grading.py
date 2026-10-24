"""Chấm điểm: mỗi câu có đáp án đúng được điểm bằng nhau, tổng = total_score (mặc định 10)."""
import re
import unicodedata


def _norm(s) -> str:
    s = unicodedata.normalize("NFKC", str(s)).lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip(" .,;:!?\"'“”‘’")


def is_correct(q: dict, user) -> bool:
    if not q.get("correct") or user is None or str(user).strip() == "":
        return False
    accepted = {_norm(c) for c in q["correct"]}
    return _norm(user) in accepted


def all_questions(exam: dict):
    for g in exam["groups"]:
        for q in g["questions"]:
            yield q


def grade(exam: dict, answers: dict) -> dict:
    details = []
    scored = right = answered = 0
    for q in all_questions(exam):
        user = answers.get(str(q["no"]), "")
        has_key = bool(q.get("correct"))
        ok = is_correct(q, user)
        if str(user).strip():
            answered += 1
        if has_key:
            scored += 1
            right += ok
        details.append(
            {"no": q["no"], "type": q["type"], "user": user, "correct": q.get("correct", []),
             "is_correct": ok, "scored": has_key}
        )
    total = float(exam.get("total_score", 10))
    score = round(right / scored * total, 2) if scored else 0.0
    return {
        "score": score,
        "max_score": total,
        "correct_count": right,
        "scored_count": scored,
        "answered_count": answered,
        "total_questions": len(details),
        "details": sorted(details, key=lambda d: d["no"]),
    }
