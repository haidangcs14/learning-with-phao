import pytest

from app.modules.video.dictation import check_answer
from app.modules.video.transcript import parse_transcript, to_seconds
from app.modules.video.youtube import parse_youtube_id
from app.modules.admin.words_import import validate_word_rows


def test_youtube_links_in_every_common_shape():
    vid = "dQw4w9WgXcQ"
    for url in (f"https://www.youtube.com/watch?v={vid}&t=10s", f"youtu.be/{vid}?si=x", f"https://m.youtube.com/watch?v={vid}",
                f"https://www.youtube.com/embed/{vid}", f"https://youtube.com/shorts/{vid}", f"https://www.youtube.com/live/{vid}", vid):
        assert parse_youtube_id(url) == vid, url
    for bad in ("", "https://vimeo.com/123456789", "https://www.youtube.com/watch?v=short", "https://evil.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)"):
        assert parse_youtube_id(bad) is None, bad


def test_timestamps():
    assert [to_seconds(x) for x in ("0:12", "01:02", "1:02:03", "00:00:01,500", "00:01.250")] == [12.0, 62.0, 3723.0, 1.5, 1.25]


SRT = """1
00:00:01,000 --> 00:00:03,500
Hello, <i>everyone</i>!

2
00:00:03,600 --> 00:00:07,000
Today we talk about
daily routines.
"""
VTT = """WEBVTT

NOTE a comment

00:01.000 --> 00:02.500 align:start
{\\an8}Good morning.

00:02.600 --> 00:05.000
How are you?
"""


def test_srt_vtt_and_plain_lines_are_parsed():
    srt = parse_transcript(SRT)
    assert [(s["no"], s["start"], s["end"], s["text"]) for s in srt] == [(1, 1.0, 3.5, "Hello, everyone!"), (2, 3.6, 7.0, "Today we talk about daily routines.")]
    vtt = parse_transcript(VTT)
    assert [s["text"] for s in vtt] == ["Good morning.", "How are you?"] and vtt[0]["start"] == 1.0
    plain = parse_transcript("[0:05] I get up at six.\n0:09 - Then I\nhave breakfast.\n1:02 Bye!")
    assert [(s["start"], s["end"], s["text"]) for s in plain][:2] == [(5.0, 9.0, "I get up at six."), (9.0, 62.0, "Then I have breakfast.")]
    assert plain[2]["end"] > plain[2]["start"]


def test_overlapping_captions_stop_where_the_next_starts_and_bad_input_is_rejected():
    s = parse_transcript("00:00:01,000 --> 00:00:09,000\nfirst\n\n00:00:04,000 --> 00:00:06,000\nsecond")
    assert s[0]["end"] == 4.0
    for bad in ("just some text without times", "0:05 only one line", ""):
        with pytest.raises(ValueError):
            parse_transcript(bad)


def test_answer_checking_ignores_case_punctuation_and_spaces():
    r = check_answer("I'd like a cup of coffee, please.", "  i’d LIKE a cup   of coffee please ")
    assert r["accuracy"] == 100 and r["wrong"] == r["missing"] == 0 and r["extra"] == []


def test_answer_checking_finds_wrong_missing_and_extra_words():
    r = check_answer("She goes to school every day.", "she go to the school day")
    status = {w["text"]: w["status"] for w in r["words"]}
    assert status == {"She": "correct", "goes": "wrong", "to": "correct", "school": "correct", "every": "missing", "day": "correct"}
    assert r["words"][1]["typed"] == "go" and r["extra"] == ["the"] and r["correct"] == 4 and r["wrong"] == 1 and r["missing"] == 1 and r["accuracy"] == 67
    empty = check_answer("Hello world", "")
    assert empty["accuracy"] == 0 and empty["missing"] == 2


def test_word_rows_are_validated_with_clear_errors():
    rows = [
        {"Word": "umbrella", "Phonetic": "ʌmˈbrelə", "POS": "noun", "Definition": "a tool for rain", "Meaning": "cái ô", "Level": "a1", "Topic": "Weather & Nature; Daily Life", "emoji": "☂️"},
        {"word": "umbrella", "definition": "dup", "translation_vi": "x"},
        {"word": "bad word!", "definition": "x", "translation_vi": "y"},
        {"word": "ok", "definition": "x", "translation_vi": "y", "level": "Z9"},
        {"word": "fine", "definition": "x"},
        {"word": "pic", "definition": "x", "translation_vi": "y", "image_url": "ftp://x"},
    ]
    valid, errors = validate_word_rows(rows)
    assert len(valid) == 1 and valid[0]["slug"] == "umbrella" and valid[0]["level"] == "A1" and valid[0]["phonetic"] == "/ʌmˈbrelə/"
    assert valid[0]["topics"] == ["Weather & Nature", "Daily Life"] and valid[0]["meanings"][0]["translation_vi"] == "cái ô"
    assert [e["row"] for e in errors] == [2, 3, 4, 5, 6]
