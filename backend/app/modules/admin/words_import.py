"""Nhập từ vựng hàng loạt từ file CSV / JSON / XLSX (dùng lại parse_rows của phần import câu hỏi)."""
import re

LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}
POS = {"noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "interjection", "determiner", "phrase", "other"}
ALIASES = {"vi": "translation_vi", "meaning": "translation_vi", "meaning_vi": "translation_vi", "pos": "part_of_speech", "ipa": "phonetic",
           "example_en": "example", "definition_en": "definition", "topics": "topic"}
TEMPLATE = ("word,phonetic,part_of_speech,definition,definition_vi,translation_vi,example,example_vi,level,topic,emoji,image_url\n"
            "umbrella,/ʌmˈbrelə/,noun,a tool that protects you from rain,dụng cụ che mưa,cái ô,Take an umbrella today.,Hôm nay hãy mang theo ô.,A1,Weather & Nature,☂️,\n"
            "borrow,/ˈbɒrəʊ/,verb,to take something and give it back later,lấy rồi trả lại sau,mượn,Can I borrow your pen?,Tôi mượn bút của bạn được không?,A2,Common Verbs,🤝,\n")


def _text(r: dict, key: str, limit: int, required: bool = False) -> str:
    v = str(r.get(key, "") or "").strip()
    if required and not v:
        raise ValueError(f"'{key}' is required")
    if len(v) > limit:
        raise ValueError(f"'{key}' is longer than {limit} characters")
    return v


def normalize_word_row(row: dict) -> dict:
    r: dict = {}
    for k, v in row.items():
        if k is None:
            continue
        key = str(k).strip().lower().replace(" ", "_")
        r[ALIASES.get(key, key)] = v
    word = _text(r, "word", 60, True)
    if not re.fullmatch(r"[A-Za-z][A-Za-z '\-]*", word):
        raise ValueError("'word' may only contain letters, spaces, apostrophes and hyphens")
    level = (_text(r, "level", 2) or "A1").upper()
    pos = (_text(r, "part_of_speech", 20) or "noun").lower()
    if level not in LEVELS:
        raise ValueError("'level' must be A1, A2, B1, B2, C1 or C2")
    if pos not in POS:
        raise ValueError(f"'part_of_speech' must be one of: {', '.join(sorted(POS))}")
    phonetic = _text(r, "phonetic", 60)
    if phonetic and not (phonetic.startswith("/") and phonetic.endswith("/")):
        phonetic = f"/{phonetic.strip('/')}/"
    image = _text(r, "image_url", 500)
    if image and not re.match(r"^https?://\S+$", image):
        raise ValueError("'image_url' must start with http:// or https://")
    topics = [t.strip() for t in re.split(r"[;|]", _text(r, "topic", 200)) if t.strip()][:5]
    if any(len(t) > 50 for t in topics):
        raise ValueError("a topic is longer than 50 characters")
    example, example_vi = _text(r, "example", 300), _text(r, "example_vi", 300)
    meaning = {"part_of_speech": pos, "definition": _text(r, "definition", 300, True), "definition_vi": _text(r, "definition_vi", 300),
               "translation_vi": _text(r, "translation_vi", 200, True), "examples": [example] if example else [], "examples_vi": [example_vi] if example_vi else []}
    return {"word": word, "slug": word.lower().replace(" ", "-"), "phonetic": phonetic, "audio_url": "", "level": level, "topics": topics,
            "synonyms": [], "antonyms": [], "collocations": [], "emoji": _text(r, "emoji", 8), "image_url": image, "meanings": [meaning]}


def validate_word_rows(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, errors, seen = [], [], set()
    for i, row in enumerate(rows, start=1):
        try:
            doc = normalize_word_row(row)
            if doc["slug"] in seen:
                raise ValueError("duplicate word in the file")
            seen.add(doc["slug"])
            valid.append(doc)
        except ValueError as exc:
            errors.append({"row": i, "error": str(exc)})
    return valid, errors[:50]
