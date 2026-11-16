"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Protected } from "@/components/protected";
import { ChoiceCard } from "@/components/study/choice-card";
import { StudyCard } from "@/components/study/study-card";
import { TopicSidebar, type TopicRow } from "@/components/study/topic-sidebar";
import { DEFAULT_STUDY, type StudySettings } from "@/components/study/utils";
import { WordPicture } from "@/components/study/word-picture";
import { Button, ErrorBox, Spinner, inputCls } from "@/components/ui";
import { KeyboardToggle, useVirtualKeyboard } from "@/components/virtual-keyboard";
import { WordActions, useFavoriteIds } from "@/components/word-actions";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { usePersistedState } from "@/lib/persist";
import { topicInfo } from "@/lib/topics";
import { qs } from "@/lib/utils";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

type Mode = "guess" | "favorites" | "flashcard" | "quiz";
const TABS: [Mode, string][] = [["guess", "Đoán"], ["favorites", "Yêu thích"], ["flashcard", "Thêm vào flashcard"], ["quiz", "Trắc nghiệm"]];
const REASONS = [["wrong_meaning", "Sai nghĩa"], ["wrong_example", "Ví dụ chưa đúng"], ["typo", "Lỗi chính tả"], ["other", "Lỗi khác"]] as const;

function WordRow({ w, isFav }: { w: Word; isFav: boolean }) {
  const lang = useLang((s) => s.lang);
  const m = w.meanings[0];
  return (
    <li className="flex items-center gap-3 rounded-card border-2 border-border bg-surface p-2.5 shadow-raised">
      <WordPicture word={w} size={48} />
      <div className="min-w-0 flex-1">
        <Link href={`/vocabulary/${w.id}`} className="font-bold hover:text-primary-text">{w.word}</Link> <span className="text-xs text-muted-foreground">{w.phonetic}</span>
        <p className="truncate text-sm text-muted-foreground">{lang === "vi" ? m?.translation_vi : m?.definition}</p>
      </div>
      <WordActions id={w.id} word={w.word} isFav={isFav} />
    </li>
  );
}

function FavoritesPanel() {
  const t = useT();
  const { favs, ids } = useFavoriteIds();
  if (favs.isLoading) return <Spinner />;
  const list = favs.data?.data.map((f) => f.item).filter((w): w is Word => !!w) ?? [];
  if (list.length === 0) return <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">{t("Chưa có từ yêu thích. Hãy bấm ♥ ở một từ để lưu lại.")}</p>;
  return <ul className="space-y-2">{list.map((w) => <WordRow key={w.id} w={w} isFav={ids.has(w.id)} />)}</ul>;
}

function FlashcardPanel({ topic, words }: { topic: string; words: Word[] }) {
  const t = useT();
  const { ids } = useFavoriteIds();
  const addAll = useSend<{ added: number }, { topic: string }>("POST", "/flashcards/topic", ["/flashcards"]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary-soft p-3">
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

function Study() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const topics = useGet<{ topic: string; count: number }[]>("/words/topics");
  const progress = useGet<Record<string, number>>("/study/progress");
  const [saved, setTopic] = usePersistedState("study.topic", "");
  const [mode, setMode] = usePersistedState<Mode>("study.mode", "guess");
  const [settings, setSettings] = usePersistedState<StudySettings>("study.settings", DEFAULT_STUDY);
  const [kb, setKb] = useVirtualKeyboard();
  const all = topics.data?.data ?? [];
  const active = all.some((x) => x.topic === saved) ? saved : all[0]?.topic ?? "";
  const words = useGet<Word[]>(active ? `/words?${qs({ topic: active, limit: 100 })}` : null);
  const learnedQ = useGet<string[]>(active ? `/study/learned?topic=${encodeURIComponent(active)}` : null);
  const list = words.data?.data ?? [];

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
  const answer = useSend<{ newly_learned: boolean; xp_awarded: number }, { word_id: string; correct: boolean }>("POST", "/study/answer", ["/leaderboard", "/study"]);
  const report = useSend<unknown, { word_id: string; reason: string; note: string }>("POST", "/study/report");

  useEffect(() => { // when a topic is (re)loaded start at its first word that is not learned yet
    if (!active || !words.data || !learnedQ.data || initFor.current === active) return;
    const ids = new Set(learnedQ.data.data), items = words.data.data, first = items.findIndex((w) => !ids.has(w.id));
    initFor.current = active;
    setLearned(ids); setIdx(first < 0 ? 0 : first); setFinished(first < 0 && items.length > 0); setReview(false);
  }, [active, words.data, learnedQ.data]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(id); }, [notice]);

  const word = list[idx];
  async function onAnswer(correct: boolean): Promise<number> {
    if (!word) return 0;
    if (correct) { const next = new Set(live.current.learned).add(word.id); live.current.learned = next; setLearned(next); }
    try { return (await answer.mutateAsync({ word_id: word.id, correct })).data.xp_awarded; } catch { return 0; }
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
  const pick = (topic: string) => { setTopic(topic); setFinished(false); };

  const rows: TopicRow[] = all.map((x) => ({ topic: x.topic, count: x.count, learned: x.topic === active ? learned.size : progress.data?.data[x.topic] ?? 0 }));
  const total = all.reduce((s, x) => s + x.count, 0);
  const label = topicInfo(active, lang).label;
  const pct = list.length ? (learned.size / list.length) * 100 : 0;
  const pill = (on: boolean) => `rounded-btn px-3 py-1.5 text-sm font-semibold transition duration-200 ${on ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-surface"}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("{n} từ vựng thông dụng", { n: total })}</h1>
        <div className="flex items-center gap-2">
          <nav className="flex flex-wrap gap-1 rounded-2xl bg-surface-secondary p-1" aria-label={t("Chế độ học")}>
            {TABS.map(([k, name]) => <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={pill(mode === k)}>{t(name)}</button>)}
          </nav>
          <KeyboardToggle on={kb} onChange={setKb} />
          <button onClick={() => setDialog("settings")} aria-label={t("Cài đặt")} title={t("Cài đặt")} className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-border bg-surface text-lg hover:border-primary">⚙</button>
        </div>
      </header>

      {topics.isLoading ? <Spinner /> : topics.error ? <ErrorBox error={topics.error} /> : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <TopicSidebar topics={rows} active={active} onPick={pick} />
          <section className="min-w-0 space-y-4">
            {(mode === "guess" || mode === "quiz") && (
              <div>
                <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <span>{t("TIẾN ĐỘ")} - {label.toUpperCase()}</span><span>{learned.size} / {list.length} {t("THẺ")}</span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            {notice && <p role="status" className="rounded-btn bg-success-soft px-3 py-2 text-sm font-medium text-success-text">{notice}</p>}

            {words.isLoading ? <Spinner /> : (mode === "guess" || mode === "quiz") && finished ? (
              <div className="rounded-card border-2 border-border bg-surface p-8 text-center shadow-raised">
                <p className="text-5xl">🏆</p>
                <h2 className="mt-2 text-2xl font-bold">{t("Bạn đã học hết chủ đề này!")}</h2>
                <p className="mt-1 text-muted-foreground">{t("{a}/{b} thẻ đã thuộc", { a: learned.size, b: list.length })}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => { setReview(true); setIdx(0); setFinished(false); }}>{t("Ôn lại từ đầu")}</Button>
                  <Button variant="ghost" onClick={() => { const i = all.findIndex((x) => x.topic === active); pick(all[(i + 1) % all.length]?.topic ?? active); }}>{t("Chủ đề tiếp theo")}</Button>
                </div>
              </div>
            ) : mode === "guess" && word ? (
              <StudyCard key={word.id} word={word} settings={settings} keyboard={kb} onAnswer={onAnswer} onNext={next} onReport={() => { setDialog("report"); setNote(""); }} />
            ) : mode === "quiz" && word ? (
              <ChoiceCard key={word.id} word={word} pool={list} settings={settings} onAnswer={onAnswer} onNext={next} />
            ) : mode === "favorites" ? <FavoritesPanel /> : mode === "flashcard" ? <FlashcardPanel topic={active} words={list} /> : null}

            {(mode === "guess" || mode === "quiz") && !finished && (
              <p className="text-center text-xs font-medium text-muted-foreground">{t("Nhóm học {a}/{b} • Tổng cộng {c} thẻ trong bộ thẻ", { a: Math.max(1, all.findIndex((x) => x.topic === active) + 1), b: all.length, c: total })}</p>
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

export default function VocabularyPage() {
  return <Protected><Study /></Protected>;
}
