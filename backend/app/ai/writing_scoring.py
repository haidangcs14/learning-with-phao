"""Local, explainable writing scores (rules). Pure functions: no network, no model.
Reuses the grammar rules / vocabulary measure written for the speaking module."""
import re
from collections import Counter

from app.ai.scoring import STOP, band_of, clamp, find_issues, score_grammar_rules, score_vocabulary, tokenize

WEIGHTS = {"task": 0.25, "coherence": 0.20, "vocabulary": 0.20, "grammar": 0.25, "mechanics": 0.10}
CONNECTORS = ["because", "so", "however", "therefore", "although", "though", "while", "whereas", "moreover", "furthermore",
              "in addition", "for example", "for instance", "firstly", "secondly", "finally", "first", "then", "after that",
              "next", "in conclusion", "as a result", "on the other hand", "besides", "also", "instead", "unless", "despite",
              "such as", "as well as", "for this reason", "to sum up", "overall", "but", "since"]
SPELLING = {
    "recieve": "receive", "definately": "definitely", "seperate": "separate", "becouse": "because", "beacuse": "because", "freind": "friend",
    "wich": "which", "wensday": "Wednesday", "tommorow": "tomorrow", "tomorow": "tomorrow", "untill": "until", "occured": "occurred",
    "enviroment": "environment", "goverment": "government", "adress": "address", "begining": "beginning", "beleive": "believe",
    "calender": "calendar", "comming": "coming", "diffrent": "different", "excersise": "exercise", "foriegn": "foreign",
    "happend": "happened", "intresting": "interesting", "necesary": "necessary", "oppurtunity": "opportunity", "probaly": "probably",
    "realy": "really", "sucess": "success", "thier": "their", "wierd": "weird", "writting": "writing", "togeather": "together",
    "peice": "piece", "truely": "truly", "arguement": "argument", "embarass": "embarrass", "occassion": "occasion", "accomodation": "accommodation",
}
APOSTROPHE = {"dont": "don't", "cant": "can't", "doesnt": "doesn't", "didnt": "didn't", "wont": "won't", "isnt": "isn't", "arent": "aren't",
              "wasnt": "wasn't", "im": "I'm", "ive": "I've", "youre": "you're", "thats": "that's", "couldnt": "couldn't",
              "shouldnt": "shouldn't", "wouldnt": "wouldn't"}


def _issue(original: str, better: str, why: str) -> dict:
    return {"original": original, "better": better, "why": why}


def find_mechanics(text: str) -> list[dict]:
    """Spelling, capitalisation, punctuation and missing apostrophes."""
    out: list[dict] = []
    for m in re.finditer(r"[A-Za-z']+", text):
        w = m.group(0).lower()
        if w in SPELLING:
            out.append(_issue(m.group(0), SPELLING[w], "Spelling"))
        elif w in APOSTROPHE:
            out.append(_issue(m.group(0), APOSTROPHE[w], "Missing apostrophe"))
    for m in re.finditer(r"(?<![A-Za-z'])i(?![A-Za-z'])", text):
        out.append(_issue("i", "I", "The pronoun “I” is always a capital letter"))
    for m in re.finditer(r"(?:^|[.!?]\s+)([a-z][a-z']*)", text):
        if m.group(1) != "i":  # a lone lowercase "i" is already reported by the pronoun rule
            out.append(_issue(m.group(1), m.group(1)[0].upper() + m.group(1)[1:], "A sentence starts with a capital letter"))
    for m in re.finditer(r"\balot\b", text, re.I):
        out.append(_issue(m.group(0), "a lot", "“A lot” is two words"))
    if text.strip() and text.strip()[-1] not in ".!?\"')":
        out.append(_issue("…" + text.strip()[-12:], text.strip()[-12:] + ".", "End the text with punctuation"))
    return out


def find_writing_grammar(text: str) -> list[dict]:
    out = [_issue(m.group(0), "have", "After should/could/would use “have”, not “of”") for m in re.finditer(r"\b(?:should|could|would)\s+of\b", text, re.I)]
    out += [_issue(m.group(0), "you're welcome", "“You're” = “you are”") for m in re.finditer(r"\byour\s+welcome\b", text, re.I)]
    out += [_issue(m.group(0), "many people", "“People” is countable: use “many”") for m in re.finditer(r"\bmuch\s+people\b", text, re.I)]
    return find_issues(text) + out


def _fb(code: str, **params) -> dict:
    return {"code": code, "params": params}


def analyze_writing(text: str, prompt: dict | None = None) -> dict:
    prompt = prompt or {}
    words = re.findall(r"[A-Za-z']+", text)
    wc = len(words)
    toks = tokenize(text)
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    n_sent = max(len(sentences), 1)
    avg_len = wc / n_sent
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    low = text.lower()
    min_w, max_w = int(prompt.get("min_words") or 0), int(prompt.get("max_words") or 0)

    # --- task achievement: length and coverage of the topic keywords
    if min_w:
        length = 100 * min(1.0, wc / min_w)
        if max_w and wc > max_w * 1.25:
            length = max(50.0, 100 - (wc / max_w - 1.25) * 100)
    else:
        length = clamp(wc / 60 * 100)
    keywords = [k.lower() for k in prompt.get("keywords", [])]
    hits = [k for k in keywords if re.search(rf"\b{re.escape(k)}", low)]
    coverage = len(hits) / len(keywords) * 100 if keywords else None
    task = 0.7 * length + 0.3 * coverage if coverage is not None else length

    # --- coherence: linking words, paragraphs, sentence length
    used = [c for c in CONNECTORS if re.search(rf"\b{re.escape(c)}\b", low)]
    coherence = 35 + 11 * min(len(used), 5)
    if wc >= 80 and len(paragraphs) >= 2:
        coherence += 10
    elif wc >= 120 and len(paragraphs) == 1:
        coherence -= 8
    coherence -= 15 if avg_len < 6 and n_sent >= 3 else 10 if avg_len > 30 else 0

    # --- vocabulary
    content = [w for w in toks if len(w) > 2 and w not in STOP]
    top = Counter(content).most_common(1)
    vocab = score_vocabulary(toks) - (8 if top and top[0][1] >= 6 else 0)

    # --- grammar / mechanics
    gram_issues, mech_issues = find_writing_grammar(text), find_mechanics(text)
    grammar = score_grammar_rules(wc, gram_issues)
    mechanics = round(100 - min(80, len(mech_issues) * 8 + len(mech_issues) / max(wc, 1) * 150))

    scores = {k: round(clamp(v)) for k, v in {"task": task, "coherence": coherence, "vocabulary": vocab, "grammar": grammar, "mechanics": mechanics}.items()}
    total = round(sum(scores[k] * w for k, w in WEIGHTS.items()))
    if wc < 15:
        total = min(total, 40)  # too little text to judge fairly

    fb: list[dict] = []
    if min_w and wc < min_w: fb.append(_fb("too_short", words=wc, min=min_w))
    elif max_w and wc > max_w * 1.25: fb.append(_fb("too_long", words=wc, max=max_w))
    elif min_w: fb.append(_fb("good_length", words=wc))
    if keywords and coverage is not None and coverage < 50: fb.append(_fb("off_topic", words=", ".join(k for k in keywords if k not in hits)))
    if not used and wc >= 30: fb.append(_fb("no_connectors"))
    elif len(used) >= 4: fb.append(_fb("good_connectors", n=len(used)))
    if wc >= 120 and len(paragraphs) == 1: fb.append(_fb("one_paragraph"))
    if avg_len < 6 and n_sent >= 3: fb.append(_fb("short_sentences", avg=round(avg_len, 1)))
    if avg_len > 28: fb.append(_fb("long_sentences", avg=round(avg_len, 1)))
    if top and top[0][1] >= 6: fb.append(_fb("repeated_word", word=top[0][0], n=top[0][1]))
    spelling = [m for m in mech_issues if m["why"] == "Spelling"]
    if spelling: fb.append(_fb("spelling", n=len(spelling)))
    if any(m["original"] == "i" for m in mech_issues): fb.append(_fb("capital_i"))
    if not gram_issues and wc >= 30: fb.append(_fb("good_grammar"))

    strengths = [k for k in WEIGHTS if scores[k] >= 75]
    improve = [k for k in WEIGHTS if scores[k] < 65]
    tips = []
    if min_w and wc < min_w: tips.append("write_more")
    if "coherence" in improve: tips += ["use_connectors", "paragraphs"] if wc >= 80 else ["use_connectors"]
    if "vocabulary" in improve: tips.append("vary_vocab")
    if "grammar" in improve or gram_issues: tips.append("review_grammar")
    if "mechanics" in improve or mech_issues: tips.append("proofread")
    return {
        **scores, "overall": total, "feedback": fb, "corrections": (gram_issues + mech_issues)[:8], "comments": [], "summary": "", "improved": "",
        "assessment": {"band": band_of(total), "strengths": strengths, "improve": improve, "tips": list(dict.fromkeys(tips))[:4]},
        "stats": {"words": wc, "sentences": len(sentences), "paragraphs": len(paragraphs), "avg_sentence_len": round(avg_len, 1),
                  "unique": len(set(toks)), "connectors": used[:8]},
        "method": {"scoring": "rules"},
    }
