"""Gộp 190 từ cũ (words.py + words_vi.py) với 310 từ mới (words_more.py)."""
from scripts.data.words import WORDS
from scripts.data.words_more import MORE
from scripts.data.words_vi import VI_EXTRA


def _old() -> list[dict]:
    out = []
    for w, ipa, pos, def_en, vi, ex_en, level, topic in WORDS:
        def_vi, ex_vi, emoji = VI_EXTRA.get(w, ("", "", ""))
        out.append({"word": w, "ipa": ipa, "pos": pos, "def_en": def_en, "def_vi": def_vi, "vi": vi, "ex_en": ex_en,
                    "ex_vi": ex_vi, "level": level, "topic": topic, "emoji": emoji})
    return out


ALL_WORDS = _old() + MORE
