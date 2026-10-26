"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorBox, inputCls } from "@/components/ui";
import { useSend } from "@/hooks/api";
import { looksLikeYouTube } from "@/lib/dictation";
import { useT } from "@/lib/i18n";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORIES = ["Daily life", "Travel", "Work", "Education", "Technology", "Health", "Culture", "Science"];

export function LessonForm({ onCreated, redirect = true }: { onCreated?: () => void; redirect?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState({ url: "", title: "", level: "B1", category: "Daily life", transcript: "" });
  const [tried, setTried] = useState(false);
  const create = useSend<{ id: string; sentence_count: number }, typeof f>("POST", "/video-lessons", ["/video-lessons"]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const problems = {
    url: !looksLikeYouTube(f.url) ? t("Hãy nhập đường dẫn YouTube hợp lệ (youtube.com/watch?v=… hoặc youtu.be/…).") : "",
    title: !f.title.trim() ? t("Hãy nhập tên bài học.") : "",
    transcript: f.transcript.trim().length < 10 ? t("Hãy dán bản chép lời có mốc thời gian hoặc chọn file phụ đề.") : "",
  };
  const invalid = Object.values(problems).some(Boolean);

  function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) { alert(t("File phụ đề tối đa 1MB.")); return; }
    void file.text().then((text) => setF((x) => ({ ...x, transcript: text })));
  }
  const field = (msg: string) => (tried && msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null);

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t("Thêm video YouTube để luyện nghe")}</h2>
      <form className="grid gap-3 sm:grid-cols-2" noValidate onSubmit={(e) => {
        e.preventDefault(); setTried(true);
        if (invalid) return;
        create.mutate(f, { onSuccess: (r) => { onCreated?.(); if (redirect) router.push(`/listening/video/${r.data.id}`); else { setF({ url: "", title: "", level: f.level, category: f.category, transcript: "" }); setTried(false); } } });
      }}>
        <label className="text-sm sm:col-span-2">{t("Đường dẫn YouTube")}
          <input className={inputCls} placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={set("url")} aria-invalid={tried && !!problems.url} />{field(problems.url)}</label>
        <label className="text-sm sm:col-span-2">{t("Tên bài học")}
          <input className={inputCls} maxLength={120} value={f.title} onChange={set("title")} aria-invalid={tried && !!problems.title} />{field(problems.title)}</label>
        <label className="text-sm">{t("Trình độ")}<select className={inputCls} value={f.level} onChange={set("level")}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
        <label className="text-sm">{t("Danh mục")}<input className={inputCls} list="video-categories" maxLength={50} value={f.category} onChange={set("category")} />
          <datalist id="video-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="text-sm sm:col-span-2">{t("Bản chép lời có mốc thời gian")}
          <textarea className={`${inputCls} font-mono text-xs`} rows={8} value={f.transcript} onChange={set("transcript")} aria-invalid={tried && !!problems.transcript}
            placeholder={`0:05 Hello everyone.\n0:09 Today we talk about daily routines.\n\n${t("(hoặc SRT / VTT)")}`} />{field(problems.transcript)}</label>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 sm:col-span-2">
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            {t("Chọn file .srt / .vtt / .txt")}<input type="file" accept=".srt,.vtt,.txt" hidden onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <span>{t("Mẹo: trên YouTube chọn ⋯ → “Hiển thị bản chép lời”, hoặc dùng file phụ đề .srt/.vtt của video.")}</span>
        </div>
        {create.error && <div className="sm:col-span-2"><ErrorBox error={create.error} /></div>}
        <Button type="submit" disabled={create.isPending} className="sm:col-span-2 sm:w-fit">{create.isPending ? t("Đang tạo bài...") : t("Tạo bài luyện nghe")}</Button>
      </form>
    </Card>
  );
}
