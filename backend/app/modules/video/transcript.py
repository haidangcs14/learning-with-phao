"""Parses a pasted/uploaded transcript into timed sentences. Supported: SRT, WebVTT, and plain lines like "0:12 Hello" / "[01:02:03] Hello"."""
import re

MAX_SENTENCES, MAX_CHARS = 600, 500
T = r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?"
CUE = re.compile(rf"^\s*({T})\s*-->\s*({T})")
LINE = re.compile(rf"^\s*[\[(]?({T})[\])]?\s*[-–—:]?\s*(\S.*)$")
TAG = re.compile(r"<[^>]+>|\{\\an?\d+\}")


def to_seconds(t: str) -> float:
    parts = t.replace(",", ".").split(":")
    secs = float(parts[-1]) + int(parts[-2]) * 60 + (int(parts[-3]) * 3600 if len(parts) == 3 else 0)
    return round(secs, 2)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", TAG.sub("", text).replace("&nbsp;", " ").replace("&amp;", "&")).strip()


def _cues(lines: list[str]) -> list[tuple[float, float, str]]:
    out: list[list] = []
    for raw in lines:
        m = CUE.match(raw)
        if m:
            out.append([to_seconds(m.group(1)), to_seconds(m.group(2)), []])
        elif out and raw.strip() and not raw.strip().isdigit() and not raw.startswith(("WEBVTT", "NOTE", "STYLE", "Kind:", "Language:")):
            out[-1][2].append(raw.strip())
    return [(a, b, " ".join(t)) for a, b, t in out]


def _timed_lines(lines: list[str]) -> list[tuple[float, float, str]]:
    starts: list[list] = []
    for raw in lines:
        m = LINE.match(raw)
        if m:
            starts.append([to_seconds(m.group(1)), 0.0, [m.group(2)]])
        elif starts and raw.strip():
            starts[-1][2].append(raw.strip())  # a wrapped line belongs to the previous timestamp
    for i, row in enumerate(starts):
        words = len(" ".join(row[2]).split())
        row[1] = starts[i + 1][0] if i + 1 < len(starts) else row[0] + max(2.0, min(8.0, words * 0.45))
    return [(a, b, " ".join(t)) for a, b, t in starts]


def parse_transcript(raw: str) -> list[dict]:
    lines = raw.replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    cues = _cues(lines) if any(CUE.match(x) for x in lines) else _timed_lines(lines)
    items = [(s, e, _clean(t)) for s, e, t in cues]
    items = sorted([i for i in items if i[2]], key=lambda i: i[0])
    if len(items) < 2:
        raise ValueError("The transcript needs at least 2 timed lines (SRT, VTT, or lines like \"0:12 Hello there\")")
    if len(items) > MAX_SENTENCES:
        raise ValueError(f"The transcript has more than {MAX_SENTENCES} lines")
    out = []
    for i, (start, end, text) in enumerate(items):
        if len(text) > MAX_CHARS:
            raise ValueError(f"Line {i + 1} is longer than {MAX_CHARS} characters")
        nxt = items[i + 1][0] if i + 1 < len(items) else None
        if nxt is not None and nxt > start + 0.2:
            end = min(end, nxt)  # overlapping captions: stop where the next one starts
        if end <= start:
            end = start + 1.5
        out.append({"no": i + 1, "start": start, "end": round(end, 2), "text": text})
    return out
