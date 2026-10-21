from scripts.data.grammar import GRAMMAR
from scripts.data.tenses import TENSES


def test_twelve_tenses_are_complete():
    assert len(TENSES) == 12
    assert {t["group"] for t in TENSES} == {"present", "past", "future"}
    for t in TENSES:
        assert t["formula"] and t["usage"] and t["signals"] and t["notes"] and t["compare"]
        assert len(t["examples"]) >= 4 and len(t["exercises"]) >= 3
        for e in t["exercises"]:
            assert e["answer"] in e["options"], (t["title"], e["question"])


def test_grammar_has_no_duplicates_and_tenses_come_first():
    slugs = [g["slug"] for g in GRAMMAR]
    assert len(slugs) == len(set(slugs))
    assert slugs[:12] == [t["slug"] for t in TENSES]
    assert all("group" in g for g in GRAMMAR)
