from app.ai.local_llm import parse_grade
from app.ai.scoring import find_issues, overall, score_speech, speech_stats, weak_words


def _words(texts, start=0.0, gap=0.2, dur=0.35, prob=0.95):
    out, t = [], start
    for w in texts:
        out.append({"word": w, "start": round(t, 2), "end": round(t + dur, 2), "prob": prob})
        t += dur + gap
    return out


TEXT = ("I usually wake up at six o'clock and then I have breakfast with my family. After that I go to school by bike "
        "because it is healthy and cheap. In the evening I do my homework and watch television before I go to bed.")


def test_good_speech_scores_high_and_is_explainable():
    toks = TEXT.replace(".", "").split()
    r = score_speech("Tell us about your daily routine.", TEXT, 20, _words(toks, gap=0.3))
    assert r["fluency"] >= 60 and r["pronunciation"] >= 85 and r["grammar"] >= 90
    assert 0 < r["overall"] <= 100 and r["stats"]["words"] == len(toks)
    assert any(f["code"] in ("good_pace", "too_fast", "too_slow") for f in r["feedback"])


def test_too_little_speech_is_capped_and_asks_for_more():
    r = score_speech("x", "I like cats.", 4, [])
    assert r["overall"] <= 45 and r["pronunciation"] is None
    assert r["feedback"][0] == {"code": "speak_longer", "params": {"words": 3}}


def test_pauses_and_fillers_lower_fluency_and_are_reported():
    words = _words("i went to the um market and bought some um apples".split(), gap=1.5)
    r = score_speech("x", "i went to the um market and bought some um apples", 30, words)
    codes = {f["code"] for f in r["feedback"]}
    assert {"many_pauses", "fillers"} <= codes and r["fluency"] < 60


def test_unclear_words_are_listed_for_pronunciation_practice():
    words = _words(["thought", "through", "the", "weather"], prob=0.9)
    words[0]["prob"], words[3]["prob"] = 0.3, 0.45
    assert weak_words(words) == ["thought", "weather"]


def test_grammar_rules_catch_typical_mistakes_without_false_alarms():
    bad = find_issues("She don't like apples. He have a book. I am agree. We was happy. I saw a elephant. More taller than me.")
    assert len(bad) >= 6
    ok = find_issues("She doesn't like apples. He has a book. I agree. We were happy. I saw an elephant. I did need help. A university.")
    assert ok == []


def test_overall_renormalises_when_a_score_is_missing():
    assert overall({"fluency": 80, "pronunciation": None, "grammar": 80, "vocabulary": 80}) == 80


def test_speech_stats_without_timestamps_still_works():
    st = speech_stats([], "one two three four five six", 6)
    assert st["wpm"] == 60 and not st["has_timing"]


def test_llm_output_is_validated():
    ok = parse_grade('{"grammar_score": 150, "vocabulary_score": "70", "corrections": [{"original": "a", "better": "b", "why": "c"}, {"x": 1}], "comments": ["tip"]}')
    assert ok == {"grammar": 100, "vocabulary": 70, "corrections": [{"original": "a", "better": "b", "why": "c"}], "comments": ["tip"]}
    assert parse_grade("not json") is None and parse_grade('{"foo": 1}') is None
