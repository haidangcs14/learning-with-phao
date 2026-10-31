import random

import pytest

from app.modules.quiz.generator import build_questions
from tests.conftest import signup


def W(word, vi, pos="noun", definition="a thing", topic="Animals", level="A1"):
    return {"word": word, "phonetic": f"/{word}/", "topics": [topic], "level": level,
            "meanings": [{"part_of_speech": pos, "definition": definition, "translation_vi": vi, "examples": [f"This is a {word}."]}]}


WORDS = [W("dog", "con chó"), W("cat", "con mèo"), W("bird", "con chim"), W("horse", "con ngựa"), W("run", "chạy", "verb"), W("sleep", "ngủ", "verb")]


def test_generated_questions_have_one_right_answer_and_unique_options():
    for kind in ("word_to_meaning", "meaning_to_word", "definition_to_word"):
        qs = build_questions(WORDS, kind, 5, random.Random(1))
        assert len(qs) == 5
        for q in qs:
            assert len(q["options"]) == 4 and len(set(q["options"])) == 4 and q["correct_answer"] in q["options"] and "—" in q["explanation"]
    q = build_questions(WORDS, "word_to_meaning", 6, random.Random(2))[0]
    assert q["question"].startswith("What does “") and all(opt in {w["meanings"][0]["translation_vi"] for w in WORDS} for opt in q["options"])
    with pytest.raises(ValueError):
        build_questions(WORDS[:3], "meaning_to_word", 3)


async def test_generate_then_submit_once_with_server_side_answers(api, db):
    await db["words"].insert_many([dict(w) for w in WORDS])
    h = await signup(api)
    g = (await api.post("/api/v1/quiz/generate", json={"kind": "meaning_to_word", "topic": "Animals", "count": 3}, headers=h)).json()["data"]
    assert len(g["questions"]) == 3 and "correct_answer" not in str(g) and "explanation" not in str(g)
    session = await db["quiz_sessions"].find_one({})
    key = {q["id"]: q["correct_answer"] for q in session["questions"]}
    answers = [{"question_id": q["id"], "answer": key[q["id"]] if i < 2 else "nope"} for i, q in enumerate(g["questions"])]
    r = (await api.post(f"/api/v1/quiz/sessions/{g['session_id']}/submit", json={"answers": answers}, headers=h)).json()["data"]
    assert r["correct"] == 2 and r["total"] == 3 and r["accuracy"] == 67 and r["xp_awarded"] > 0 and r["results"][2]["correct_answer"] == key["q2"]
    assert (await api.post(f"/api/v1/quiz/sessions/{g['session_id']}/submit", json={"answers": answers}, headers=h)).status_code == 404   # only once
    h2 = await signup(api, "o@x.com", "other")
    assert (await api.post(f"/api/v1/quiz/sessions/{g['session_id']}/submit", json={"answers": answers}, headers=h2)).status_code == 404


async def test_generate_needs_enough_words_and_bank_topics_are_listed(api, db):
    h = await signup(api)
    assert (await api.post("/api/v1/quiz/generate", json={"kind": "word_to_meaning", "count": 5}, headers=h)).status_code == 409
    await db["questions"].insert_many([{"question": "q?", "options": ["a", "b"], "correct_answer": "a", "level": "A1", "topic": "Grammar"}] * 2)
    assert (await api.get("/api/v1/quiz/topics", headers=h)).json()["data"] == [{"topic": "Grammar", "count": 2}]
