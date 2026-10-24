from app.ai.local_llm import parse_writing_grade
from app.ai.writing_scoring import analyze_writing, find_mechanics, find_writing_grammar

GOOD = ("Last weekend I went to Da Lat with my friend. We left early on Saturday because we wanted to see the sunrise.\n\n"
        "First, we visited a flower garden, and then we had lunch in the market. However, it rained in the afternoon, so we stayed in a cafe. "
        "In the evening we walked around the lake. I really enjoyed the trip. What did you do at the weekend?")
BAD = "i dont like alot of homework. my freind recieve many gift and she have a book"
PROMPT = {"min_words": 60, "max_words": 100, "keywords": ["weekend", "went", "friend"], "instruction": "x", "level": "A2"}


def test_good_text_scores_well_and_is_explained():
    r = analyze_writing(GOOD, PROMPT)
    assert r["overall"] >= 70 and r["task"] >= 80 and r["grammar"] >= 90 and r["mechanics"] >= 90
    assert {"good_length"} <= {f["code"] for f in r["feedback"]} and r["stats"]["paragraphs"] == 2
    assert r["assessment"]["band"] in ("good", "excellent")


def test_bad_text_is_flagged_with_concrete_corrections():
    r = analyze_writing(BAD, {"min_words": 60, "max_words": 100})
    originals = {c["original"].lower() for c in r["corrections"]}
    assert {"i", "dont", "alot", "freind", "recieve"} <= originals
    assert [c["original"] for c in r["corrections"]].count("i") == 1  # no duplicate report
    assert r["overall"] <= 50 and r["assessment"]["band"] == "needs_work"
    assert {"too_short", "spelling", "capital_i"} <= {f["code"] for f in r["feedback"]}


def test_mechanics_and_grammar_rules_have_no_false_alarms():
    assert find_mechanics("I don't like it. It's a lot of work, but I'm happy.") == []
    assert [c["better"] for c in find_writing_grammar("You should of gone. Your welcome.")] == ["have", "you're welcome"]


def test_over_long_and_off_topic_feedback():
    long_text = " ".join(["The weather is nice and the park is big."] * 20)
    codes = {f["code"] for f in analyze_writing(long_text, {"min_words": 30, "max_words": 50, "keywords": ["holiday", "visit"]})["feedback"]}
    assert {"too_long", "off_topic"} <= codes


def test_llm_writing_output_is_validated():
    ok = parse_writing_grade('{"task_score": 80, "coherence_score": 120, "grammar_score": "70", "corrections": [{"original": "a", "better": "b"}, 5], "summary": "ok", "improved": "better text"}')
    assert ok["scores"] == {"task": 80, "coherence": 100, "grammar": 70, "vocabulary": None}
    assert ok["corrections"] == [{"original": "a", "better": "b", "why": ""}] and ok["improved"] == "better text"
    assert parse_writing_grade("nope") is None and parse_writing_grade('{"x": 1}') is None
