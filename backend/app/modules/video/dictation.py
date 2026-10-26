"""Compares what the learner typed with the original sentence (case, punctuation and extra spaces are ignored)."""
import re

TOKEN = re.compile(r"[A-Za-z0-9]+(?:['\-][A-Za-z0-9]+)*")


def _prep(text: str) -> str:
    return text.replace("\u2019", "'").replace("\u2018", "'").replace("\u2010", "-").replace("\u2011", "-")


def tokens(text: str) -> list[str]:
    return TOKEN.findall(_prep(text))


def check_answer(original: str, answer: str) -> dict:
    ref, hyp = tokens(original), tokens(answer)
    r, h = [w.lower() for w in ref], [w.lower() for w in hyp]
    n, m = len(r), len(h)
    sub = lambda a, b: 0.0 if a == b else 1.5  # noqa: E731  a substitution costs a bit less than skip + extra (2.0), but more than 1: exact matches win ties
    cost = [[0.0] * (m + 1) for _ in range(n + 1)]  # weighted edit distance on words
    for i in range(n + 1):
        cost[i][0] = float(i)
    for j in range(m + 1):
        cost[0][j] = float(j)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost[i][j] = min(cost[i - 1][j - 1] + sub(r[i - 1], h[j - 1]), cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    words = [{"text": w, "status": "missing", "typed": None} for w in ref]
    extra: list[str] = []
    i, j = n, m
    while i > 0 or j > 0:  # walk back through the cheapest alignment
        if i > 0 and j > 0 and cost[i][j] == cost[i - 1][j - 1] + sub(r[i - 1], h[j - 1]):
            words[i - 1].update(status="correct" if r[i - 1] == h[j - 1] else "wrong", typed=hyp[j - 1])
            i, j = i - 1, j - 1
        elif i > 0 and cost[i][j] == cost[i - 1][j] + 1:
            i -= 1  # the learner skipped this word: stays "missing"
        else:
            extra.append(hyp[j - 1])
            j -= 1
    correct = sum(w["status"] == "correct" for w in words)
    wrong = sum(w["status"] == "wrong" for w in words)
    return {"words": words, "extra": extra[::-1], "correct": correct, "wrong": wrong, "missing": n - correct - wrong, "total": n,
            "accuracy": round(100 * correct / n) if n else 0}
