# Nguồn: dự án mẫu chatbot-upload-exam (đọc đề .docx/.pdf: câu hỏi trắc nghiệm, điền chỗ trống, passage, listening).
"""
Đọc file đề (.docx / .pdf) -> cấu trúc bài kiểm tra (dict).

Định dạng đề được hỗ trợ (giống file mẫu):
  - Tiêu đề / dòng "LISTENING", "READING"... là phần (section)
  - Dòng hướng dẫn: "Task 1: ...", "Mark the letter ...", "Read the following ..."
  - Câu hỏi đánh số "12. ..." ; đáp án "A. ... B. ..." (cùng dòng hoặc mỗi dòng 1 đáp án)
  - Đoạn văn có chỗ trống "(31) ______" ; bài điền từ "(6) ______"
  - Cuối file: "ĐÁP ÁN" (vd "1. B  2. A ... 6. housing") và (tuỳ chọn) "TRANSCRIPT"

Giữ lại định dạng gạch chân / in đậm dưới dạng <u>..</u> và <b>..</b>.
"""
from __future__ import annotations

import re
import uuid
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Line:
    text: str            # có markup <u>, <b>
    plain: str           # text thuần
    bold: bool = False   # cả dòng in đậm


# ----------------------------------------------------------------- regex
NOISE_RE = re.compile(r"^(?:(?:trang|page)\s*\d+(?:\s*/\s*\d+)?|\d{1,3})$", re.I)
SECTION_WORDS = (
    "LISTENING|LANGUAGE FOCUS|READING|WRITING|SPEAKING|PRONUNCIATION|"
    "VOCABULARY|GRAMMAR|USE OF ENGLISH|PHONETICS"
)
SECTION_RE = re.compile(
    rf"^(?:PART\s+[IVX\d]+\s*[:.\-–]?\s*)?(?:{SECTION_WORDS})(?:\s+AND\s+(?:{SECTION_WORDS}))?$", re.I
)
GENERIC_SECTION_RE = re.compile(r"^[A-Z][A-Z &/\-]{3,40}$")
INSTR_RE = re.compile(
    r"^(?:Task\s*\d+|Part\s+[\dIVX]+|Exercise\s*\d+|Mark the letter|Read the|Listen|Choose|"
    r"Complete|Fill in|Circle|Match|Rearrange|Look at|Underline|Question\s+\d+)",
    re.I,
)
Q_RE = re.compile(r"^((?:<[ub]>)*)\s*(\d{1,3})\s*[.)]((?:</[ub]>)*)(?:\s+|$)(.*)$", re.S)
OPT_MARK = re.compile(r"(?:(?<=\s)|(?<=>)|^)([A-E])[.)]\s+")
BLANK_RE = re.compile(r"\(\s*(\d{1,3})\s*\)\s*(?:_{2,}|\.{3,}|…+)")
KEY_LINE_RE = re.compile(
    r"^(?:ĐÁP\s*ÁN|DAP\s*AN|ANSWER\s*KEYS?|ANSWERS?|KEYS?)\b[\s:：\-–]*(.*)$", re.I
)
TRANSCRIPT_RE = re.compile(
    r"(TRANSCRIPT|AUDIO\s*SCRIPT|TAPE\s*SCRIPT|LỜI\s*THOẠI|NỘI\s*DUNG\s*BÀI\s*NGHE)", re.I
)
LETTERS_RE = re.compile(r"^[A-Ea-e](?:\s*[,/&]\s*[A-Ea-e])*$")


# ----------------------------------------------------------------- helpers
def strip_tags(s: str) -> str:
    return re.sub(r"</?[ub]>", "", s)


def balance(s: str) -> str:
    """Bỏ thẻ <u>/<b> mở/đóng thừa (do cắt chuỗi)."""
    toks = re.split(r"(</?[ub]>)", s)
    out, stack = list(toks), []
    for i, t in enumerate(toks):
        if t in ("<u>", "<b>"):
            stack.append((t[1], i))
        elif t in ("</u>", "</b>"):
            for j in range(len(stack) - 1, -1, -1):
                if stack[j][0] == t[2]:
                    stack.pop(j)
                    break
            else:
                out[i] = ""
    for _, i in stack:
        out[i] = ""
    return "".join(out).strip()


def _wrap(text: str, bold: bool, underline: bool) -> str:
    if not text.strip() or not (bold or underline):
        return text
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    core = text.strip()
    if underline:
        core = f"<u>{core}</u>"
    if bold:
        core = f"<b>{core}</b>"
    return lead + core + trail


def _merge_runs(runs):
    """runs: [(text, bold, underline)] -> gộp run cùng định dạng."""
    runs = [list(r) for r in runs if r[0] != ""]
    for i, r in enumerate(runs):  # khoảng trắng nằm giữa 2 run cùng định dạng -> kế thừa
        if r[0].strip() == "" and 0 < i < len(runs) - 1:
            r[1] = runs[i - 1][1] and runs[i + 1][1]
            r[2] = runs[i - 1][2] and runs[i + 1][2]
    merged = []
    for t, b, u in runs:
        if merged and merged[-1][1] == b and merged[-1][2] == u:
            merged[-1][0] += t
        else:
            merged.append([t, b, u])
    return merged


def _make_line(runs) -> Line | None:
    merged = _merge_runs(runs)
    text = "".join(_wrap(t, b, u) for t, b, u in merged)
    plain = "".join(t for t, _, _ in merged)
    plain = re.sub(r"[ \t\u00a0]+", " ", plain).strip()
    if not plain:
        return None
    text = re.sub(r"[ \t\u00a0]+", " ", text).strip()
    nonspace = [b for t, b, _ in merged if t.strip()]
    return Line(text, plain, bool(nonspace) and all(nonspace))


def _split_runs_by_newline(runs):
    lines, cur = [], []
    for t, b, u in runs:
        parts = t.split("\n")
        for i, part in enumerate(parts):
            if i > 0:
                lines.append(cur)
                cur = []
            cur.append((part, b, u))
    lines.append(cur)
    return lines


# ----------------------------------------------------------------- đọc DOCX
def read_docx(path: str):
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    doc = Document(path)
    warnings: list[str] = []

    def para_runs(p):
        return [(r.text, bool(r.bold), bool(r.font.underline)) for r in p.runs]

    lines: list[Line] = []
    for child in doc.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            for runs in _split_runs_by_newline(para_runs(Paragraph(child, doc))):
                ln = _make_line(runs)
                if ln:
                    lines.append(ln)
        elif tag == "tbl":
            for row in Table(child, doc).rows:
                seen, runs = [], []
                for cell in row.cells:
                    if any(cell._tc is s for s in seen):
                        continue
                    seen.append(cell._tc)
                    for p in cell.paragraphs:
                        runs.extend(para_runs(p))
                        runs.append((" ", False, False))
                    runs.append(("\t", False, False))
                ln = _make_line(runs)
                if ln:
                    lines.append(ln)
    if len(doc.inline_shapes):
        warnings.append(
            f"File có {len(doc.inline_shapes)} hình ảnh — hệ thống chưa hiển thị hình trong đề, "
            "hãy kiểm tra các câu liên quan."
        )
    return lines, warnings


# ----------------------------------------------------------------- đọc PDF
def _underline_segments(page):
    segs = []
    for l in page.lines:
        if abs(l["top"] - l["bottom"]) < 1.5:
            segs.append((l["x0"], l["x1"], (l["top"] + l["bottom"]) / 2))
    for r in page.rects:
        if r["height"] < 2 and r["width"] > 2:
            segs.append((r["x0"], r["x1"], (r["top"] + r["bottom"]) / 2))
    return segs


def _is_underlined(c, segs) -> bool:
    cx = (c["x0"] + c["x1"]) / 2
    return any(x0 - 0.5 <= cx <= x1 + 0.5 and c["bottom"] - 2 <= y <= c["bottom"] + 3 for x0, x1, y in segs)


def read_pdf(path: str):
    import pdfplumber

    lines: list[Line] = []
    warnings: list[str] = []
    total_chars = 0
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            segs = _underline_segments(page)
            chars = [c for c in page.chars if c["text"] != "\n"]
            total_chars += len(chars)
            chars.sort(key=lambda c: (c["top"], c["x0"]))
            clusters, cur, cur_top = [], [], None
            for c in chars:
                if cur and abs(c["top"] - cur_top) > 0.5 * max(c.get("size", 10), 6):
                    clusters.append(cur)
                    cur = []
                if not cur:
                    cur_top = c["top"]
                cur.append(c)
            if cur:
                clusters.append(cur)

            for cl in clusters:
                cl.sort(key=lambda c: c["x0"])
                runs, prev = [], None
                flags = [_is_underlined(c, segs) for c in cl]
                nonspace = [f for c, f in zip(cl, flags) if c["text"].strip()]
                if len(nonspace) > 25 and sum(nonspace) / len(nonspace) > 0.9:
                    flags = [False] * len(cl)  # đường kẻ bảng, không phải gạch chân
                for c, u in zip(cl, flags):
                    if prev is not None and c["text"] != " " and prev["text"] != " ":
                        if c["x0"] - prev["x1"] > max(1.5, 0.25 * c.get("size", 10)):
                            runs.append((" ", False, False))
                    fn = c.get("fontname", "").lower()
                    bold = any(k in fn for k in ("bold", "black", "heavy"))
                    runs.append((c["text"], bold, u))
                    prev = c
                ln = _make_line(runs)
                if ln:
                    lines.append(ln)
    if total_chars < 30:
        raise ValueError("PDF không có lớp chữ (có thể là bản scan). Hãy dùng file docx hoặc PDF xuất từ Word.")
    warnings.append(
        "File PDF: gạch chân/in đậm được nhận diện tự động nên có thể sai. "
        "Nên dùng file .docx để có kết quả chính xác nhất."
    )
    return lines, warnings


# ----------------------------------------------------------------- tách đáp án
def split_options(text: str, expected_first: str = "A"):
    """-> (stem, [option_text], relettered)"""
    marks = [(m.start(), m.end(), m.group(1)) for m in OPT_MARK.finditer(text)]
    if not marks:
        return text, [], False
    ef = ord(expected_first)
    start = next(
        (
            i
            for i, m in enumerate(marks)
            if m[2] == expected_first or (expected_first != "A" and abs(ord(m[2]) - ef) <= 1)
        ),
        None,
    )
    if start is None:
        return text, [], False
    seq = [marks[start]]
    for m in marks[start + 1:]:
        if m[2] >= seq[-1][2]:
            seq.append(m)
    stem = text[: seq[0][0]]
    opts = [
        text[m[1]: seq[i + 1][0] if i + 1 < len(seq) else len(text)].strip() for i, m in enumerate(seq)
    ]
    relet = [m[2] for m in seq] != [chr(ef + i) for i in range(len(seq))]
    return stem.strip(), opts, relet


def parse_key(text: str) -> dict[int, str]:
    text = text.replace("\u00a0", " ")
    parts = re.split(r"(?:(?<=\s)|^)(\d{1,3})\s*[.)\-:]\s*", text)
    key = {}
    for i in range(1, len(parts) - 1, 2):
        val = parts[i + 1].strip().rstrip(".;,")
        if val:
            key[int(parts[i])] = val
    if len(key) < 3:  # đáp án dạng bảng: "1 B 2 A ..."
        for n, v in re.findall(r"(?<!\S)(\d{1,3})\s+([A-E])(?![A-Za-z])", text):
            key[int(n)] = v
    return key


def _key_to_correct(val: str) -> tuple[list[str], bool]:
    """-> (danh sách đáp án chấp nhận, là_chữ_cái)"""
    if LETTERS_RE.match(val):
        return [x.upper() for x in re.split(r"\s*[,/&]\s*", val)], True
    return [v.strip() for v in re.split(r"\s*[/|;]\s*", val) if v.strip()], False


# ----------------------------------------------------------------- parse chính
def parse_lines(lines: list[Line], filename: str = "") -> dict:
    header: list[str] = []
    groups: list[dict] = []
    blanks: dict[str, list[int]] = {}
    cur_group = None
    cur_q = None
    section = ""
    mode = "body"
    key_lines: list[str] = []
    transcript: list[str] = []
    warnings: list[str] = []

    def new_group(instruction=""):
        nonlocal cur_group
        cur_group = {
            "id": uuid.uuid4().hex[:8],
            "section": section,
            "kind": "normal",
            "instruction": instruction,
            "passage": [],
            "questions": [],
        }
        groups.append(cur_group)
        blanks[cur_group["id"]] = []

    def make_question(no: int, rest: str) -> dict:
        stem, opts, relet = split_options(rest)
        if relet:
            warnings.append(f"Câu {no}: ký hiệu đáp án không theo thứ tự A-B-C-D, hệ thống đã đánh lại.")
        return {
            "no": no,
            "type": "mc",
            "prompt": balance(stem),
            "options": [{"key": chr(65 + i), "text": balance(t)} for i, t in enumerate(opts)],
            "correct": [],
            "explanation": "",
            "inline": False,
        }

    for L in lines:
        p = L.plain
        if NOISE_RE.match(p) or (re.search(r"thuvienhoclieu", p, re.I) and len(p) < 60):
            continue

        # --- transcript / đáp án
        if TRANSCRIPT_RE.search(p) and len(p) < 60 and not Q_RE.match(L.text):
            mode, cur_q = "transcript", None
            continue
        km = KEY_LINE_RE.match(p)
        if km and not Q_RE.match(L.text) and (km.group(1) == "" or km.group(1)[0].isdigit()):
            mode, cur_q = "key", None
            if km.group(1):
                key_lines.append(km.group(1))
            continue
        if mode == "key":
            key_lines.append(p)
            continue
        if mode == "transcript":
            transcript.append(p)
            continue

        # --- phần (section)
        if SECTION_RE.match(p.rstrip(":")) or (L.bold and GENERIC_SECTION_RE.match(p)):
            section, cur_group, cur_q = p.rstrip(":").strip(), None, None
            continue

        # --- hướng dẫn
        if INSTR_RE.match(p) and not Q_RE.match(L.text):
            cur_q = None
            if cur_group and not cur_group["questions"] and not cur_group["passage"]:
                cur_group["instruction"] = (cur_group["instruction"] + " " + p).strip()
            else:
                new_group(p)
            continue

        # --- câu hỏi mới
        qm = Q_RE.match(L.text)
        if qm:
            if cur_group is None:
                new_group()
            cur_q = make_question(int(qm.group(2)), qm.group(4))
            cur_group["questions"].append(cur_q)
            continue

        # --- dòng tiếp theo của câu hỏi hiện tại
        if cur_q is not None:
            expected = chr(65 + len(cur_q["options"]))
            stem, opts, relet = split_options(L.text, expected)
            if opts:
                if stem:
                    cur_q["prompt"] = balance((cur_q["prompt"] + " " + stem).strip())
                for t in opts:
                    cur_q["options"].append({"key": chr(65 + len(cur_q["options"])), "text": balance(t)})
                continue
            if not cur_q["options"]:
                cur_q["prompt"] = balance((cur_q["prompt"] + " " + L.text).strip())
                continue
            if p[:1].islower():  # đáp án dài bị xuống dòng
                cur_q["options"][-1]["text"] = balance(cur_q["options"][-1]["text"] + " " + L.text)
                continue
            cur_q = None  # hết câu hỏi -> rơi xuống xử lý như đoạn văn

        # --- đoạn văn / tiêu đề đề thi
        if cur_group is None:
            if not section and not groups:
                header.append(p)
                continue
            new_group()
        text = p if L.bold else L.text
        for m in BLANK_RE.finditer(text):
            blanks[cur_group["id"]].append(int(m.group(1)))
        text = BLANK_RE.sub(lambda m: "{{%s}}" % m.group(1), text)
        cur_group["passage"].append(text)

    # ---------- hoàn thiện nhóm: ô trống điền từ
    for g in groups:
        have = {q["no"] for q in g["questions"]}
        for n in blanks[g["id"]]:
            if n not in have:
                g["questions"].append(
                    {"no": n, "type": "fill", "prompt": "", "options": [], "correct": [],
                     "explanation": "", "inline": True}
                )
                have.add(n)
        listening = "LISTEN" in g["section"].upper() or re.search(r"\blisten", g["instruction"], re.I)
        g["kind"] = "listening" if listening else "normal"
    groups = [g for g in groups if g["questions"]]

    all_q = [q for g in groups for q in g["questions"]]
    key = parse_key(" ".join(key_lines))
    if not key:
        warnings.append("Không tìm thấy phần ĐÁP ÁN trong file — hãy nhập đáp án đúng ở bước chỉnh sửa.")

    # ---------- số câu bị trùng (vd lỗi đánh số trong đề) -> điền vào chỗ thiếu
    nums = [q["no"] for q in all_q]
    dup = {n for n, c in Counter(nums).items() if c > 1}
    if dup:
        top = max(nums + list(key))
        gaps = sorted(set(range(1, top + 1)) - set(nums))
        last = {n: max(i for i, x in enumerate(nums) if x == n) for n in dup}
        prev = 0
        for i, q in enumerate(all_q):
            n = q["no"]
            if n in dup and i != last[n]:
                cand = next((x for x in gaps if x > prev), None)
                if cand is not None:
                    gaps.remove(cand)
                    q["no"] = cand
                    warnings.append(f"Số câu {n} bị trùng trong đề → đã tự đánh lại thành câu {cand}. Hãy kiểm tra.")
                else:
                    warnings.append(f"Số câu {n} bị trùng trong đề, hãy sửa lại số câu.")
            prev = q["no"]
    for g in groups:
        g["questions"].sort(key=lambda q: q["no"])

    # ---------- gắn đáp án đúng
    for q in all_q:
        val = key.get(q["no"])
        if val is None:
            warnings.append(f"Câu {q['no']}: không có đáp án trong file → sẽ không tính điểm cho đến khi bạn nhập.")
            if q["type"] == "mc" and len(q["options"]) < 2:
                q["type"] = "fill"
            continue
        correct, is_letter = _key_to_correct(val)
        if q["type"] == "fill":
            q["correct"] = correct
        elif len(q["options"]) >= 2:
            if is_letter and all(c in [o["key"] for o in q["options"]] for c in correct):
                q["correct"] = correct
            else:
                warnings.append(f"Câu {q['no']}: đáp án '{val}' không khớp các lựa chọn A-D.")
        else:  # không có lựa chọn
            if is_letter:
                warnings.append(f"Câu {q['no']}: không đọc được các lựa chọn A-D (đáp án là {val}).")
                q["correct"] = correct
            else:
                q["type"], q["correct"] = "fill", correct

    missing = sorted(set(key) - {q["no"] for q in all_q})
    if missing:
        warnings.append(
            "Có trong đáp án nhưng thiếu nội dung câu hỏi trong đề: câu "
            + ", ".join(map(str, missing))
            + ". Các câu này không được tính điểm — bạn có thể thêm thủ công ở bước chỉnh sửa."
        )
    if any(g["kind"] == "listening" for g in groups):
        warnings.append("Đề có phần Listening: hãy tải lên file âm thanh (mp3/wav...) ở bước chỉnh sửa.")

    dm = re.search(r"(\d{2,3})\s*(?:phút|minutes|mins|min)\b", " ".join(header), re.I)
    title = " – ".join(header[:4]).strip() or Path(filename).stem or "Bài kiểm tra"
    return {
        "title": title,
        "duration_minutes": int(dm.group(1)) if dm else 45,
        "total_score": 10,
        "transcript": "\n".join(transcript),
        "groups": groups,
        "warnings": warnings,
    }


def parse_file(path: str, filename: str = "") -> dict:
    ext = Path(filename or path).suffix.lower()
    if ext == ".docx":
        lines, warns = read_docx(path)
    elif ext == ".pdf":
        lines, warns = read_pdf(path)
    else:
        raise ValueError("Chỉ hỗ trợ file .docx hoặc .pdf")
    if not lines:
        raise ValueError("Không đọc được nội dung từ file.")
    exam = parse_lines(lines, filename or path)
    if not exam["groups"]:
        raise ValueError("Không nhận diện được câu hỏi nào. Kiểm tra lại định dạng đề (câu hỏi đánh số 1. 2. 3. ...).")
    exam["warnings"] = warns + exam["warnings"]
    return exam
