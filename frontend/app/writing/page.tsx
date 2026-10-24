"use client";

import { useEffect, useState } from "react";
import { Protected } from "@/components/protected";
import { WritingEvaluation } from "@/components/writing-evaluation";
import { WritingHistory, type Submission } from "@/components/writing-history";
import { Button, Card, Empty, ErrorBox, Page, Spinner, Tabs } from "@/components/ui";
import { LEVEL_COLOR } from "@/components/practice/practice-list";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Prompt { id: string; title: string; level: string; instruction: string; min_words: number; max_words: number; hints: string[] }
const LEVELS = ["", "A1", "A2", "B1", "B2", "C1"] as const;
const MAX_CHARS = 6000;
const countWords = (s: string) => (s.match(/[A-Za-z']+/g) ?? []).length;

function Editor({ prompt, onBack }: { prompt: Prompt | null; onBack: () => void }) {
  const t = useT();
  const key = `writing_draft_${prompt?.id ?? "free"}`;
  const [text, setText] = useState("");
  const submit = useSend<Submission, { prompt_id: string | null; text: string }>("POST", "/writing/submissions", ["/writing/submissions", "/leaderboard", "/activity"]);
  useEffect(() => { try { setText(localStorage.getItem(key) ?? ""); } catch { /* storage blocked */ } }, [key]);
  useEffect(() => { try { localStorage.setItem(key, text); } catch { /* ignore */ } }, [key, text]); // the draft survives a refresh

  const words = countWords(text);
  const min = prompt?.min_words ?? 0, max = prompt?.max_words ?? 0;
  const tone = !min ? "text-slate-500" : words < min ? "text-amber-600" : max && words > max * 1.25 ? "text-red-600" : "text-green-600";
  const result = submit.data?.data;

  function send() {
    submit.mutate({ prompt_id: prompt?.id ?? null, text }, { onSuccess: () => { try { localStorage.removeItem(key); } catch { /* ignore */ } } });
  }
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-indigo-600">{t("← Chọn đề khác")}</button>
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          {prompt && <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_COLOR[prompt.level] ?? ""}`}>{prompt.level}</span>}
          <h2 className="text-lg font-semibold">{prompt?.title ?? t("Viết tự do")}</h2>
        </div>
        <p className="text-slate-700 dark:text-slate-300">{prompt?.instruction ?? t("Viết về bất kỳ chủ đề nào bạn muốn. AI sẽ chấm và sửa lỗi cho bạn.")}</p>
        {prompt && prompt.hints.length > 0 && <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">{prompt.hints.map((h) => <li key={h}>{h}</li>)}</ul>}
        {prompt && <p className="text-xs text-slate-500">{t("Số từ yêu cầu: {min}-{max}", { min: prompt.min_words, max: prompt.max_words })}</p>}
      </Card>

      {!result ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))} rows={12} spellCheck={false} placeholder={t("Viết bài của bạn ở đây...")}
            className="w-full rounded-xl border border-slate-300 bg-white p-4 text-base leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-medium ${tone}`}>{t("{n} từ", { n: words })}{min ? ` / ${min}-${max}` : ""}</p>
            <Button disabled={words < 5 || submit.isPending} onClick={send}>{submit.isPending ? t("Đang chấm bài...") : t("Nộp bài để AI chấm")}</Button>
          </div>
          {words > 0 && words < 5 && <p className="text-xs text-slate-500">{t("Viết ít nhất 5 từ để được chấm.")}</p>}
          {submit.isPending && <p className="text-sm text-slate-500">{t("Đang phân tích bài viết... Nếu dùng mô hình AI local, bước này có thể mất vài chục giây.")}</p>}
          {submit.error && <ErrorBox error={submit.error} />}
        </div>
      ) : (
        <div className="space-y-4">
          {result.xp_awarded ? <p className="text-sm text-green-600">+{result.xp_awarded} XP</p> : null}
          <WritingEvaluation ev={result.evaluation} />
          <div className="flex gap-2"><Button onClick={() => { submit.reset(); setText(""); }}>{t("Viết lại bài mới")}</Button><Button variant="ghost" onClick={onBack}>{t("Chọn đề khác")}</Button></div>
        </div>
      )}
    </div>
  );
}

function Writing() {
  const t = useT();
  const [level, setLevel] = useState<string>("");
  const [mode, setMode] = useState<"pick" | "write">("pick");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const prompts = useGet<Prompt[]>(`/writing/prompts${level ? `?level=${level}` : ""}`);
  const start = (p: Prompt | null) => { setPrompt(p); setMode("write"); };

  if (mode === "write") return <Editor prompt={prompt} onBack={() => setMode("pick")} />;
  return (
    <div className="space-y-6">
      <p className="text-slate-500 dark:text-slate-400">{t("Chọn một đề viết theo cấp độ hoặc viết tự do. Bài viết được chấm ngay trên máy bạn: nội dung, liên kết, từ vựng, ngữ pháp, chính tả.")}</p>
      <Tabs value={level} onChange={setLevel} options={LEVELS.map((l) => [l, l || t("Tất cả")] as const)} />
      {prompts.isLoading ? <Spinner /> : prompts.error ? <ErrorBox error={prompts.error} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => start(null)} className="rounded-xl border-2 border-dashed border-slate-300 p-4 text-left transition hover:border-indigo-500 dark:border-slate-700">
            <p className="font-semibold">✍️ {t("Viết tự do")}</p><p className="text-sm text-slate-500">{t("Tự chọn chủ đề, không giới hạn số từ.")}</p>
          </button>
          {(prompts.data?.data ?? []).map((p) => (
            <button key={p.id} onClick={() => start(p)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-500 hover:shadow dark:border-slate-800 dark:bg-slate-900/60">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_COLOR[p.level] ?? ""}`}>{p.level}</span>
              <p className="mt-2 font-semibold">{p.title}</p>
              <p className="line-clamp-2 text-sm text-slate-500">{p.instruction}</p>
              <p className="mt-1 text-xs text-slate-400">{t("{n} từ", { n: `${p.min_words}-${p.max_words}` })}</p>
            </button>
          ))}
          {(prompts.data?.data.length ?? 0) === 0 && <Empty>{t("Chưa có đề viết. Hãy chạy seed.")}</Empty>}
        </div>
      )}
      <section><h2 className="mb-2 font-semibold">{t("Lịch sử bài viết")}</h2><WritingHistory /></section>
    </div>
  );
}

export default function WritingPage() {
  const t = useT();
  return <Protected><Page title={t("Luyện viết")}><Writing /></Page></Protected>;
}
