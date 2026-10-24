from collections import Counter

from scripts.data.all_words import ALL_WORDS
from scripts.data.listening import LISTENING
from scripts.data.listening_more import LISTENING_MORE
from scripts.data.reading import READING
from scripts.data.reading_more import READING_MORE


def test_vocabulary_is_large_unique_and_bilingual():
    assert len(ALL_WORDS) >= 500
    assert not [w for w, n in Counter(x["word"] for x in ALL_WORDS).items() if n > 1]
    assert len({x["topic"] for x in ALL_WORDS}) >= 20
    for x in ALL_WORDS:
        assert x["def_en"] and x["def_vi"] and x["ex_en"] and x["ex_vi"] and x["vi"] and x["emoji"], x["word"]
        assert x["ipa"].startswith("/") and x["ipa"].endswith("/") and x["level"] in {"A1", "A2", "B1", "B2", "C1", "C2"}


def test_reading_and_listening_catalogue_is_valid_and_covers_every_level():
    items = READING + READING_MORE + LISTENING + LISTENING_MORE
    assert len(READING + READING_MORE) >= 20 and len(LISTENING + LISTENING_MORE) >= 16
    assert len({(i["kind"], i["slug"]) for i in items}) == len(items)
    assert {"A1", "A2", "B1", "B2", "C1"} <= {i["level"] for i in READING + READING_MORE} & {i["level"] for i in LISTENING + LISTENING_MORE}
    for i in items:
        for q in i["questions"]:
            assert 0 <= q["answer"] < len(q["options"]) and len(set(q["options"])) == len(q["options"]), (i["title"], q["q"])
