"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Protected } from "@/components/protected";
import { Button, ErrorBox, Spinner, inputCls } from "@/components/ui";
import { useYouTube } from "@/components/video/use-youtube";
import { LEVEL_COLOR } from "@/components/practice/practice-list";
import { useGet, useSend } from "@/hooks/api";
import { DEFAULT_SETTINGS, MODES, loadSettings, maskedIndexes, mmss, saveSettings, wordsOf, type Mode, type Settings } from "@/lib/dictation";
import { useT } from "@/lib/i18n";
import { usePersistedState } from "@/lib/persist";
import { ApiError } from "@/lib/api";

interface Sentence { no: number; start: number; end: number; text: string }
interface Summary { accuracy: number; correct: number; wrong: number; missing: number; total: number }
interface Checked extends Summary { words: { text: string; status: "correct" | "wrong" | "missing"; typed: string | null }[]; extra: string[]; xp_awarded: number }
interface Lesson { id: string; youtube_id: string; title: string; level: string; category: string; sentences: Sentence[]; mine: boolean; can_edit: boolean;
  progress: { mode: Mode; answers: Record<string, string>; results: Record<string, Summary>; completion: number } }
const PASS = 60;
const MODE_LABEL: Record<Mode, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };
const CELL: Record<string, string> = {
  correct: "border-green-600 bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100",
  wrong: "border-[#b5412a] bg-[#b5412a]/10 text-[#7a2615] dark:text-[#ef8a74]",
  missing: "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
};
const btn = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-indigo-950";
const msg = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));

function Practice({ lesson }: { lesson: Lesson }) {
  const t = useT();
  const yt = useYouTube(lesson.youtube_id);
  const [sentences, setSentences] = useState(lesson.sentences);
  const [current, setCurrent] = useState(() => { const i = lesson.sentences.findIndex((s) => (lesson.progress.results[String(s.no)]?.accuracy ?? 0) < PASS); return i < 0 ? 0 : i; });
  const [mode, setMode] = useState<Mode>(lesson.progress.mode);
  const [answers, setAnswers] = useState(lesson.progress.answers);
  const [results, setResults] = useState(lesson.progress.results);
  const [checked, setChecked] = useState<Record<number, Checked>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hideMedia, setHideMedia] = usePersistedState("video.hideMedia", false);
  const [hideScript, setHideScript] = usePersistedState("video.hideScript", false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState<"settings" | "edit" | "report" | null>(null);
  const [target, setTarget] = useState<Sentence | null>(null);
  const segEnd = useRef<number | null>(null);
  const firstRender = useRef(true);
  const listRef = useRef<HTMLUListElement>(null);

  const sentence = sentences[current] as Sentence;
  const no = String(sentence.no);
  const words = wordsOf(sentence.text);
  const masked = maskedIndexes(lesson.id, sentence.no, mode, words.length, settings.ratio[mode]);
  const full = checked[sentence.no];
  const done = sentences.filter((s) => (results[String(s.no)]?.accuracy ?? 0) >= PASS).length;
  const pct = Math.round((done * 100) / sentences.length);

  const notify = useCallback((ok: boolean, text: string) => { setNotice({ ok, text }); }, []);
  useEffect(() => { setSettings(loadSettings()); }, []);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { listRef.current?.querySelector(`[data-no="${sentence.no}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [sentence.no]);

  // ---- player <-> sentences
  const playSegment = useCallback((i: number) => {
    const s = sentences[i];
    if (!s || !yt.ready) return;
    segEnd.current = s.end;
    yt.seek(s.start);
    yt.play();
  }, [sentences, yt]);
  useEffect(() => { // stop at the end of the sentence (a real check against the player's own clock)
    if (segEnd.current !== null && yt.playing && yt.time >= segEnd.current - 0.05) { segEnd.current = null; if (settings.autoPause) yt.pause(); }
  }, [yt, settings.autoPause]);
  useEffect(() => { // free playback (auto-pause off): follow the video
    if (!yt.playing || segEnd.current !== null) return;
    let idx = 0;
    sentences.forEach((s, i) => { if (yt.time >= s.start) idx = i; });
    if (idx !== current) { setCurrent(idx); setHint(null); }
  }, [yt.time, yt.playing, sentences, current]);

  function go(i: number, autoplay: boolean) {
    const n = Math.min(Math.max(i, 0), sentences.length - 1);
    setCurrent(n); setHint(null);
    if (autoplay) playSegment(n); else if (yt.ready) { segEnd.current = null; yt.seek((sentences[n] as Sentence).start); }
  }
  const resumeOrPlay = () => {
    if (yt.playing) { yt.pause(); return; }
    if (segEnd.current !== null && yt.time >= sentence.start && yt.time < sentence.end - 0.1) yt.play(); else playSegment(current);
  };

  // ---- answers: saved automatically, kept when you move between sentences
  const progress = useSend<unknown, { answers: Record<string, string>; mode: Mode }>("PUT", `/video-lessons/${lesson.id}/progress`);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const id = setTimeout(() => progress.mutate({ answers, mode }), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, mode]);

  const checkReq = useSend<Checked, { no: number; answer: string; mode: Mode }>("POST", `/video-lessons/${lesson.id}/check`, ["/leaderboard"]);
  async function runCheck(): Promise<boolean> {
    const answer = answers[no] ?? "";
    if (!answer.trim()) { notify(false, t("Hãy gõ câu trả lời trước khi kiểm tra.")); return false; }
    try {
      const r = (await checkReq.mutateAsync({ no: sentence.no, answer, mode })).data;
      setChecked((c) => ({ ...c, [sentence.no]: r }));
      setResults((x) => ({ ...x, [no]: { accuracy: r.accuracy, correct: r.correct, wrong: r.wrong, missing: r.missing, total: r.total } }));
      notify(r.accuracy >= PASS, `${r.accuracy}% · ${t("{a}/{b} từ đúng", { a: r.correct, b: r.total })}${r.xp_awarded ? ` · +${r.xp_awarded} XP` : ""}`);
      return true;
    } catch (e) { notify(false, msg(e)); return false; }
  }
  async function next() {
    if (!full && (answers[no] ?? "").trim()) await runCheck(); // keeps the score up to date, and the typed answer stays in place
    go(current + 1, true);
  }

  // ---- edit / report dialogs
  const [form, setForm] = useState({ text: "", start: "", end: "", reason: "wrong_text", note: "" });
  const [formError, setFormError] = useState("");
  const edit = useSend<Sentence, { no: number; text: string; start: number; end: number }>("PATCH", (v) => `/video-lessons/${lesson.id}/sentences/${v.no}`, [], (v) => ({ text: v.text, start: v.start, end: v.end }));
  const report = useSend<unknown, { no: number; reason: string; note: string }>("POST", `/video-lessons/${lesson.id}/reports`, [], (v) => v);
  function open(kind: "edit" | "report", s: Sentence) {
    setTarget(s); setFormError(""); setDialog(kind);
    setForm({ text: s.text, start: String(s.start), end: String(s.end), reason: "wrong_text", note: "" });
  }
  function submitEdit() {
    if (!target) return;
    const start = Number(form.start), end = Number(form.end), text = form.text.trim();
    const i = target.no - 1, prev = sentences[i - 1], nxt = sentences[i + 1];
    if (!text) return setFormError(t("Nội dung câu không được để trống."));
    if (text.length > 500) return setFormError(t("Nội dung câu tối đa 500 ký tự."));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0) return setFormError(t("Thời gian không hợp lệ."));
    if (end <= start) return setFormError(t("Thời gian kết thúc phải sau thời gian bắt đầu."));
    if ((prev && start < prev.start) || (nxt && start >= nxt.start)) return setFormError(t("Thời gian bắt đầu phải nằm giữa câu trước và câu sau."));
    edit.mutate({ no: target.no, text, start, end }, {
      onSuccess: (r) => {
        setSentences((list) => list.map((s) => (s.no === target.no ? r.data : s)));
        setResults((x) => { const { [String(target.no)]: _removed, ...rest } = x; return rest; });
        setChecked((c) => { const { [target.no]: _removed, ...rest } = c; return rest; });
        setDialog(null); notify(true, t("Đã cập nhật câu #{n}.", { n: target.no }));
      },
      onError: (e) => setFormError(msg(e)),
    });
  }
  function submitReport() {
    if (!target) return;
    if (form.reason === "other" && form.note.trim().length < 5) return setFormError(t("Hãy mô tả lỗi (ít nhất 5 ký tự)."));
    report.mutate({ no: target.no, reason: form.reason, note: form.note.trim() }, {
      onSuccess: () => { setDialog(null); notify(true, t("Đã gửi báo lỗi câu #{n}. Cảm ơn bạn!", { n: target.no })); },
      onError: (e) => setFormError(e instanceof ApiError && e.errorCode === "ALREADY_REPORTED" ? t("Bạn đã báo lỗi câu này rồi.") : msg(e)),
    });
  }

  const cols = !hideMedia && !hideScript ? "lg:grid-cols-[1fr_1.5fr_1fr]" : !hideMedia ? "lg:grid-cols-[1fr_1.5fr]" : !hideScript ? "lg:grid-cols-[1.5fr_1fr]" : "lg:grid-cols-1";
  const hintWord = hint !== null ? (words[hint] ?? "") : "";
  const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-slate-500">
          <Link href="/listening/video" className="hover:text-indigo-600">Topics</Link><span aria-hidden="true">›</span>
          <span>{lesson.category}</span><span aria-hidden="true">›</span>
          <b className="truncate text-slate-900 dark:text-slate-100">{lesson.title}</b>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_COLOR[lesson.level] ?? ""}`}>{lesson.level}</span>
        </nav>
        <div className="flex gap-2">
          <button className={btn} aria-pressed={hideMedia} onClick={() => setHideMedia(!hideMedia)}>{hideMedia ? t("Hiện Media") : t("Ẩn Media")}</button>
          <button className={btn} aria-pressed={hideScript} onClick={() => setHideScript(!hideScript)}>{hideScript ? t("Hiện transcript") : t("Ẩn transcript")}</button>
        </div>
      </div>

      {notice && <p role="status" className={`rounded-lg px-3 py-2 text-sm font-medium ${notice.ok ? "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100" : "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100"}`}>{notice.text}</p>}

      <div className={`grid items-start gap-4 ${cols}`}>
        {/* ---------- left: video ---------- */}
        <section className={`min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60 ${hideMedia ? "hidden" : ""}`}>
          <h2 className="text-sm font-bold uppercase tracking-wide">VIDEO</h2>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            <div ref={yt.host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
            {yt.status !== "ready" && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">{yt.status === "loading" ? t("Đang tải trình phát...") : ""}</p>}
          </div>
          {yt.status === "error" && <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-900 dark:bg-red-900 dark:text-red-100">{t(yt.error)}</p>}
          <p className="text-center font-mono text-lg" aria-label={t("Thời gian")}>{mmss(yt.time)} / {mmss(yt.duration)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!yt.ready} onClick={() => playSegment(current)}>{t("BẮT ĐẦU")}</Button>
            <button className={btn} disabled={!yt.ready} onClick={() => go(0, true)}>{t("PHÁT LẠI")}</button>
          </div>
        </section>

        {/* ---------- middle: practice ---------- */}
        <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div role="tablist" aria-label={t("Chế độ")} className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {MODES.map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setHint(null); }}
                className={`rounded-md px-2 py-1.5 text-sm font-semibold transition ${mode === m ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}>
                {MODE_LABEL[m]} <span className="text-xs font-normal opacity-80">{Math.round(settings.ratio[m] * 100)}%</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t("Điều khiển")}>
            <button className={btn} onClick={() => go(current - 1, true)} disabled={!yt.ready || current === 0} aria-label={t("Câu trước")}>⏮</button>
            <button className={btn} onClick={resumeOrPlay} disabled={!yt.ready} aria-label={yt.playing ? t("Tạm dừng") : t("Phát")}>{yt.playing ? "⏸" : "▶"}</button>
            <button className={btn} onClick={() => go(current + 1, true)} disabled={!yt.ready || current === sentences.length - 1} aria-label={t("Câu tiếp theo")}>⏭</button>
            <button className={btn} onClick={() => playSegment(current)} disabled={!yt.ready} aria-label={t("Phát lại đoạn nghe")}>🔁</button>
            <label className="flex items-center gap-1 text-sm">{t("Tốc độ")}
              <select className={sel} value={yt.rate} disabled={!yt.ready} onChange={(e) => yt.setRate(Number(e.target.value))}>{yt.rates.map((r) => <option key={r} value={r}>{r}x</option>)}</select>
            </label>
            <button className={`${btn} ml-auto`} onClick={() => setDialog("settings")} aria-label={t("Cài đặt")}>⚙</button>
          </div>
          <p className="text-sm text-slate-500">{t("Câu {a}/{b}", { a: current + 1, b: sentences.length })} · {mmss(sentence.start)}–{mmss(sentence.end)}</p>

          <textarea value={answers[no] ?? ""} rows={3} spellCheck={false} placeholder={t("Gõ câu trả lời của bạn ở đây...")}
            onChange={(e) => setAnswers((a) => ({ ...a, [no]: e.target.value.slice(0, 1000) }))}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void runCheck(); } }}
            className={`${inputCls} resize-y text-base`} aria-label={t("Câu trả lời")} />

          <div className="flex flex-wrap gap-1.5" aria-label={t("Các từ trong câu")}>
            {words.map((w, i) => {
              const r = full?.words[i];
              const hidden = !r && !revealed.has(sentence.no) && masked.has(i);
              const cls = r ? CELL[r.status] : hidden ? "cursor-pointer border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900";
              return (
                <button key={i} type="button" disabled={!hidden} onClick={() => setHint(hint === i ? null : i)} aria-label={hidden ? t("Từ bị ẩn") : w}
                  className={`min-w-10 rounded-lg border-2 px-2.5 py-1 text-center font-medium disabled:cursor-default ${cls} ${hint === i ? "ring-2 ring-indigo-500" : ""}`}>
                  {hidden ? "*".repeat(Math.max(2, w.length)) : w}
                  {r?.status === "wrong" && r.typed && <span className="block text-[10px] font-normal line-through opacity-70">{r.typed}</span>}
                </button>
              );
            })}
          </div>
          {hint !== null && (settings.hints
            ? <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-950">💡 {t("Gợi ý")}: <b className="font-mono tracking-widest">{hintWord.charAt(0)}{" _".repeat(Math.max(0, hintWord.length - 1))}</b> ({t("{n} chữ cái", { n: hintWord.length })})</p>
            : <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t("Gợi ý đang tắt. Bật trong Cài đặt (⚙).")}</p>)}

          {full ? (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${full.accuracy >= PASS ? "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`}>
              {full.accuracy}% — ✓ {full.correct} · ✗ {full.wrong} · {t("thiếu {n}", { n: full.missing })}{full.extra.length > 0 && ` · ${t("thừa")}: ${full.extra.join(", ")}`}</p>
          ) : results[no] ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{t("Kết quả đã lưu: {n}%. Bấm KIỂM TRA để xem chi tiết.", { n: results[no]?.accuracy ?? 0 })}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={checkReq.isPending} onClick={() => void runCheck()}>{t("KIỂM TRA")}</Button>
            <button className={btn} onClick={() => { setRevealed((r) => new Set(r).add(sentence.no)); setHint(null); }}>{t("HIỆN TẤT CẢ TỪ")}</button>
            <button className={btn} disabled={checkReq.isPending || current === sentences.length - 1} onClick={() => void next()}>{t("TIẾP THEO")}</button>
          </div>
        </section>

        {/* ---------- right: transcript ---------- */}
        <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60 ${hideScript ? "hidden" : ""}`}>
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wide">{t("BẢN CHÉP")}</h2><b className="text-sm">{pct}%</b></div>
          <div className="my-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} /></div>
          <ul ref={listRef} className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {sentences.map((s, i) => {
              const r = results[String(s.no)];
              const active = i === current;
              return (
                <li key={s.no} data-no={s.no} className={`rounded-lg border-2 p-2 text-sm transition ${active ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-200 hover:border-indigo-300 dark:border-slate-700"}`}>
                  <div className="flex items-center gap-2">
                    <button className="flex-1 text-left" onClick={() => { if (yt.playing) go(i, true); else go(i, false); }} aria-current={active ? "true" : undefined}>
                      <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold dark:bg-slate-700">#{s.no}</span>{s.text}
                    </button>
                    {r && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.accuracy >= PASS ? "bg-green-600 text-white" : "bg-amber-500 text-white"}`}>{r.accuracy}%</span>}
                  </div>
                  <div className="mt-1 flex justify-end gap-1">
                    {lesson.can_edit && <button className="rounded px-2 py-0.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => open("edit", s)} aria-label={t("Chỉnh sửa câu {n}", { n: s.no })}>✏️ {t("Sửa")}</button>}
                    <button className="rounded px-2 py-0.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => open("report", s)} aria-label={t("Báo lỗi câu {n}", { n: s.no })}>⚑ {t("Báo lỗi")}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* ---------- dialogs ---------- */}
      <Dialog open={dialog === "settings"} title={t("Cài đặt luyện nghe")} onClose={() => setDialog(null)}>
        <div className="space-y-3 text-sm">
          {MODES.map((m) => (
            <label key={m} className="block">{MODE_LABEL[m]}: <b>{Math.round(settings.ratio[m] * 100)}%</b> {t("số từ bị ẩn")}
              <input type="range" min={0} max={100} step={5} className="w-full" value={Math.round(settings.ratio[m] * 100)}
                onChange={(e) => setSettings((s) => ({ ...s, ratio: { ...s.ratio, [m]: Number(e.target.value) / 100 } }))} /></label>
          ))}
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.hints} onChange={(e) => setSettings({ ...settings, hints: e.target.checked })} />{t("Cho phép gợi ý khi bấm vào từ bị ẩn")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.autoPause} onChange={(e) => setSettings({ ...settings, autoPause: e.target.checked })} />{t("Tự dừng video sau mỗi câu")}</label>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}>{t("Mặc định")}</Button>
            <Button onClick={() => { saveSettings(settings); setDialog(null); notify(true, t("Đã lưu cài đặt.")); }}>{t("Lưu")}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog === "edit"} title={t("Chỉnh sửa câu #{n}", { n: target?.no ?? 0 })} onClose={() => setDialog(null)}>
        <div className="space-y-3 text-sm">
          <label className="block">{t("Nội dung")}<textarea className={inputCls} rows={3} maxLength={500} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label>{t("Bắt đầu (giây)")}<input className={inputCls} type="number" step="0.1" min="0" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            <label>{t("Kết thúc (giây)")}<input className={inputCls} type="number" step="0.1" min="0" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          </div>
          {formError && <p role="alert" className="text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDialog(null)}>{t("Huỷ bỏ")}</Button><Button disabled={edit.isPending} onClick={submitEdit}>{t("Lưu")}</Button></div>
        </div>
      </Dialog>

      <Dialog open={dialog === "report"} title={t("Báo lỗi câu #{n}", { n: target?.no ?? 0 })} onClose={() => setDialog(null)}>
        <div className="space-y-3 text-sm">
          <p className="rounded bg-slate-100 p-2 italic dark:bg-slate-800">“{target?.text}”</p>
          {([["wrong_text", "Sai nội dung (chép lời không đúng)"], ["wrong_time", "Sai thời gian (câu bị lệch so với video)"], ["other", "Lỗi khác"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2"><input type="radio" name="reason" checked={form.reason === k} onChange={() => setForm({ ...form, reason: k })} />{t(label)}</label>
          ))}
          <label className="block">{t("Ghi chú")}{form.reason === "other" ? " *" : ""}<textarea className={inputCls} rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          {formError && <p role="alert" className="text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDialog(null)}>{t("Huỷ bỏ")}</Button><Button disabled={report.isPending} onClick={submitReport}>{t("Gửi báo lỗi")}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}

function Loader() {
  const { id } = useParams<{ id: string }>();
  const q = useGet<Lesson>(`/video-lessons/${id}`);
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  return <Practice key={id} lesson={q.data.data} />;
}

export default function VideoPracticePage() {
  return <Protected><Loader /></Protected>;
}
