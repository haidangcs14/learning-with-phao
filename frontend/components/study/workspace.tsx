"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { Dialog } from "@/components/dialog";
import { ChoiceCard } from "@/components/study/choice-card";
import { StudyCard } from "@/components/study/study-card";
import { TopicSidebar, type TopicRow } from "@/components/study/topic-sidebar";
import { DEFAULT_STUDY, POS, type StudySettings } from "@/components/study/utils";
import { WordPicture } from "@/components/study/word-picture";
import { Button, ErrorBox, Spinner, inputCls } from "@/components/ui";
import { KeyboardToggle, useVirtualKeyboard } from "@/components/virtual-keyboard";
import { WordActions, useFavoriteIds } from "@/components/word-actions";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { usePersistedState } from "@/lib/persist";
import { speak } from "@/lib/speech";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

export type Mode = "guess" | "favorites" | "flashcard" | "quiz" | "list";
const TABS: [Mode, string][] = [["guess", "Đoán"], ["favorites", "Yêu thích"], ["flashcard", "Thêm vào flashcard"], ["quiz", "Trắc nghiệm"], ["list", "Danh sách"]];
const REASONS = [["wrong_meaning", "Sai nghĩa"], ["wrong_example", "Ví dụ chưa đúng"], ["typo", "Lỗi chính tả"], ["other", "Lỗi khác"]] as const;

/** Where a set of cards comes from: the built-in dictionary words, or a vocabulary set made by a user. */
export interface StudySource {
  key: string; title: string; groups: { key: string; label: string; icon?: string; count: number }[];
  loading?: boolean; error?: unknown;
  progressPath: string; wordsPath: (group: string) => string; learnedPath: (group: string) => string;
  answerPath: string; answerBody: (w: Word, correct: boolean) => Record<string, unknown>;
  parseWords: (raw: unknown) => Word[];
  modes: Mode[]; reportable: boolean; backHref: string; actions?: ReactNode; emptyHint?: ReactNode;
}

function WordRow({ w, isFav, plain }: { w: Word; isFav?: boolean; plain?: boolean }) {
  const lang = useLang((s) => s.lang);
  const t = useT();
  const m = w.meanings[0];
  return (
    <li className="flex items-center gap-3 rounded-card border-2 border-border bg-surface p-3 shadow-raised">
      <WordPicture word={w} size={48} />
      <div className="min-w-0 flex-1">
        {plain ? <b>{w.word}</b> : <Link href={`/vocabulary/${w.id}`} className="font-bold hover:text-primary-text">{w.word}</Link>} <span className="text-xs text-muted-foreground">{w.phonetic}</span>
        {plain && m && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">{t(POS[m.part_of_speech] ?? "Khác")}</span>}
        <p className="text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">{lang === "vi" || !m?.definition ? m?.translation_vi : m.definition}</p>
        {plain && m?.examples[0] && <p className="mt-0.5 text-sm italic leading-snug text-muted-foreground [overflow-wrap:anywhere]">{m.examples[0]}</p>}
      </div>
      {plain ? <button onClick={() => speak(w.word)} aria-label={t("Nghe")} className="rounded-full bg-primary px-2.5 py-1.5 text-primary-foreground hover:bg-primary-hover">🔊</button>
        : <WordActions id={w.id} word={w.word} isFav={!!isFav} />}
    </li>
  );
}

function FavoritesPanel() {
  const t = useT();
  const { favs, ids } = useFavoriteIds();
  if (favs.isLoading) return <Spinner />;
  const list = favs.data?.data.map((f) => f.item).filter((w): w is Word => !!w) ?? [];
  if (list.length === 0) return <p className="rounded-card border-2 border-dashed border-border p-8 text-center text-muted-foreground">{t("Chưa có từ yêu thích. Hãy bấm ♥ ở một từ để lưu lại.")}</p>;
  return <ul className="space-y-2">{list.map((w) => <WordRow key={w.id} w={w} isFav={ids.has(w.id)} />)}</ul>;
}

function FlashcardPanel({ topic, words }: { topic: string; words: Word[] }) {
  const t = useT();
  const { ids } = useFavoriteIds();
  const addAll = useSend<{ added: number }, { topic: string }>("POST", "/flashcards/topic", ["/flashcards"]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-primary-soft p-3">
        <p className="text-sm">{t("Thêm từ vào bộ flashcard để ôn tập theo lịch lặp lại ngắt quãng.")}</p>
        <span className="flex items-center gap-2">
          {addAll.isSuccess && <span className="text-sm text-success-text">✓ {t("Đã thêm {n} từ vào flashcard", { n: addAll.data.data.added })}</span>}
          <Button disabled={addAll.isPending || !topic} onClick={() => addAll.mutate({ topic })}>{t("+ Thêm cả chủ đề vào Flashcard")}</Button>
        </span>
      </div>
      {addAll.error && <ErrorBox error={addAll.error} />}
      <ul className="space-y-2">{words.map((w) => <WordRow key={w.id} w={w} isFav={ids.has(w.id)} />)}</ul>
    </div>
  );
}

export function StudyWorkspace({ source }: { source: StudySource }) {
  const t = useT();
  const progress = useGet<Record<string, number>>(source.progressPath);
  const [saved, setGroup] = usePersistedState(`study.${source.key}.group`, "");
  const [mode, setMode] = usePersistedState<Mode>(`study.mode.${source.modes.includes("favorites") ? "builtin" : "set"}`, "guess");
  const [settings, setSettings] = usePersistedState<StudySettings>("study.settings", DEFAULT_STUDY);
  const [kb, setKb] = useVirtualKeyboard();
  const all = source.groups;
  const active = all.some((x) => x.key === saved) ? saved : all[0]?.key ?? "";
  const activeMode: Mode = source.modes.includes(mode) ? mode : "guess";
  const words = useGet<unknown>(active ? source.wordsPath(active) : null);
  const learnedQ = useGet<string[]>(active ? source.learnedPath(active) : null);
  const stale = words.isPlaceholderData || learnedQ.isPlaceholderData; // the data of the previous group is still shown while the new one loads
  const list = useMemo(() => (words.data && !words.isPlaceholderData ? source.parseWords(words.data.data) : []), [words.data, words.isPlaceholderData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [review, setReview] = useState(false);
  const [finished, setFinished] = useState(false);
  const [dialog, setDialog] = useState<"settings" | "report" | null>(null);
  const [reason, setReason] = useState<string>("wrong_meaning");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const initFor = useRef("");
  const live = useRef({ idx, review, learned, list });
  live.current = { idx, review, learned, list };
  const answer = useSend<{ newly_learned: boolean; xp_awarded: number }, Record<string, unknown>>("POST", source.answerPath, ["/leaderboard", "/study", "/vocab-sets"]);
  const report = useSend<unknown, { word_id: string; reason: string; note: string }>("POST", "/study/report");

  useEffect(() => { // when a group is (re)loaded start at its first card that is not learned yet
    const key = `${source.key}:${active}`;
    if (!active || !words.data || !learnedQ.data || stale || initFor.current === key) return;
    const ids = new Set(learnedQ.data.data), first = list.findIndex((w) => !ids.has(w.id));
    initFor.current = key;
    setLearned(ids); setIdx(first < 0 ? 0 : first); setFinished(first < 0 && list.length > 0); setReview(false);
  }, [active, words.data, learnedQ.data, stale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(id); }, [notice]);

  const word = list[idx];
  async function onAnswer(correct: boolean): Promise<number> {
    if (!word) return 0;
    if (correct) { const next = new Set(live.current.learned).add(word.id); live.current.learned = next; setLearned(next); }
    try { return (await answer.mutateAsync(source.answerBody(word, correct))).data.xp_awarded; } catch { return 0; }
  }
  const next = () => { // a stable function that reads the latest state from the ref
    const { idx: i0, review: rv, learned: ln, list: items } = live.current;
    for (let step = 1; step <= items.length; step++) {
      const i = i0 + step;
      if (rv) { if (i >= items.length) break; setIdx(i); return; }
      const j = i % items.length, w = items[j];
      if (w && !ln.has(w.id)) { setIdx(j); return; }
    }
    setFinished(true);
  };
  const pick = (group: string) => { setGroup(group); setFinished(false); };

  const rows: TopicRow[] = all.map((x) => ({ topic: x.key, label: x.label, icon: x.icon, count: x.count, learned: x.key === active ? learned.size : progress.data?.data[x.key] ?? 0 }));
  const total = all.reduce((s, x) => s + x.count, 0);
  const label = all.find((x) => x.key === active)?.label ?? "";
  const pct = list.length ? (learned.size / list.length) * 100 : 0;
  const playing = activeMode === "guess" || activeMode === "quiz";
  const pill = (on: boolean) => `rounded-btn px-3 py-1.5 text-sm font-semibold transition duration-200 ${on ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-surface"}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div><BackLink href={source.backHref}>{t("← Thư viện bộ từ")}</BackLink></div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="text-balance text-2xl font-bold [overflow-wrap:anywhere] sm:text-3xl">{source.title}</h1>{source.actions && <div className="mt-1.5 flex flex-wrap items-center gap-2">{source.actions}</div>}</div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1 rounded-card bg-surface-secondary p-1" aria-label={t("Chế độ học")}>
            {TABS.filter(([k]) => source.modes.includes(k)).map(([k, name]) => <button key={k} onClick={() => setMode(k)} aria-pressed={activeMode === k} className={pill(activeMode === k)}>{t(name)}</button>)}
          </nav>
          <KeyboardToggle on={kb} onChange={setKb} />
          <button onClick={() => setDialog("settings")} aria-label={t("Cài đặt")} title={t("Cài đặt")} className="flex h-10 w-10 items-center justify-center rounded-btn border-2 border-input bg-surface text-lg hover:border-primary">⚙</button>
        </div>
      </header>

      {source.loading ? <Spinner /> : source.error ? <ErrorBox error={source.error} /> : all.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-border p-8 text-center text-muted-foreground">{source.emptyHint ?? t("Bộ từ này chưa có nhóm nào.")}</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <TopicSidebar topics={rows} active={active} onPick={pick} />
          <section className="min-w-0 space-y-4">
            {playing && (
              <div>
                <div className="flex items-center justify-between gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="min-w-0 truncate">{t("TIẾN ĐỘ")} - {label.toUpperCase()}</span><span className="shrink-0">{learned.size} / {list.length} {t("THẺ")}</span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            {notice && <p role="status" className="rounded-btn bg-success-soft px-3 py-2 text-sm font-medium text-success-text">{notice}</p>}

            {words.isLoading || stale ? <Spinner /> : activeMode === "list" ? (
              list.length === 0 ? <p className="rounded-card border-2 border-dashed border-border p-8 text-center text-muted-foreground">{source.emptyHint ?? t("Nhóm này chưa có thẻ nào.")}</p>
                : <ul className="space-y-2">{list.map((w) => <WordRow key={w.id} w={w} plain />)}</ul>
            ) : playing && list.length === 0 ? (
              <p className="rounded-card border-2 border-dashed border-border p-8 text-center text-muted-foreground">{source.emptyHint ?? t("Nhóm này chưa có thẻ nào.")}</p>
            ) : playing && finished ? (
              <div className="rounded-card border-2 border-border bg-surface p-8 text-center shadow-raised">
                <p className="text-5xl">🏆</p>
                <h2 className="mt-2 text-2xl font-bold">{t("Bạn đã học hết chủ đề này!")}</h2>
                <p className="mt-1 text-muted-foreground">{t("{a}/{b} thẻ đã thuộc", { a: learned.size, b: list.length })}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => { setReview(true); setIdx(0); setFinished(false); }}>{t("Ôn lại từ đầu")}</Button>
                  <Button variant="ghost" onClick={() => { const i = all.findIndex((x) => x.key === active); pick(all[(i + 1) % all.length]?.key ?? active); }}>{t("Chủ đề tiếp theo")}</Button>
                </div>
              </div>
            ) : activeMode === "guess" && word ? (
              <StudyCard key={word.id} word={word} settings={settings} keyboard={kb} onAnswer={onAnswer} onNext={next} onReport={source.reportable ? () => { setDialog("report"); setNote(""); } : undefined} />
            ) : activeMode === "quiz" && word ? (
              <ChoiceCard key={word.id} word={word} pool={list} settings={settings} onAnswer={onAnswer} onNext={next} />
            ) : activeMode === "favorites" ? <FavoritesPanel /> : activeMode === "flashcard" ? <FlashcardPanel topic={active} words={list} /> : null}

            {playing && !finished && list.length > 0 && (
              <p className="text-center text-xs font-medium text-muted-foreground">{t("Nhóm học {a}/{b} • Tổng cộng {c} thẻ trong bộ thẻ", { a: Math.max(1, all.findIndex((x) => x.key === active) + 1), b: all.length, c: total })}</p>
            )}
          </section>
        </div>
      )}

      <Dialog open={dialog === "settings"} title={t("Cài đặt học từ")} onClose={() => setDialog(null)}>
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto} onChange={(e) => setSettings({ ...settings, auto: e.target.checked })} />{t("Tự chuyển sang từ tiếp theo khi trả lời đúng")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.speak} onChange={(e) => setSettings({ ...settings, speak: e.target.checked })} />{t("Đọc từ sau khi trả lời")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={kb} onChange={(e) => setKb(e.target.checked)} />{t("Hiện bàn phím ảo (tiện cho điện thoại)")}</label>
          <div className="flex justify-end"><Button onClick={() => setDialog(null)}>{t("Xong")}</Button></div>
        </div>
      </Dialog>
      <Dialog open={dialog === "report" && !!word} title={t("Báo lỗi từ này")} onClose={() => setDialog(null)}>
        <div className="space-y-3 text-sm">
          <p className="rounded bg-surface-secondary p-2"><b>{word?.word}</b> · {word?.meanings[0]?.translation_vi}</p>
          {REASONS.map(([k, name]) => <label key={k} className="flex items-center gap-2"><input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} />{t(name)}</label>)}
          <textarea className={inputCls} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú (không bắt buộc)")} />
          {report.error && <ErrorBox error={report.error} />}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>{t("Huỷ bỏ")}</Button>
            <Button disabled={report.isPending} onClick={() => word && report.mutate({ word_id: word.id, reason, note }, { onSuccess: () => { setDialog(null); setNotice(t("Đã gửi báo lỗi. Cảm ơn bạn!")); } })}>{t("Gửi báo lỗi")}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
