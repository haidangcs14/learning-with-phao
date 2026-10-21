from scripts.data.grammar import GRAMMAR


def test_every_lesson_has_an_english_version_with_matching_shapes():
    for g in GRAMMAR:
        en = g.get("en")
        assert en, g["slug"]
        assert len(en["usage"]) == len(g["usage"]), g["slug"]
        for key in ("notes", "compare", "signals"):
            if key in en:
                assert len(en[key]) == len(g[key]), (g["slug"], key)
        if "explanations" in en:
            assert len(en["explanations"]) == len(g["exercises"]), g["slug"]
