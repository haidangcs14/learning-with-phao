"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { BackLink } from "@/components/back-link";
import { useConfirm } from "@/components/confirm";
import { Protected } from "@/components/protected";
import { Button, Card, Empty, ErrorBox, Page, Pager, Spinner, Tabs, inputCls } from "@/components/ui";
import { LessonForm } from "@/components/video/lesson-form";
import { LEVEL_COLOR } from "@/components/practice/practice-list";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { usePersistedState, useRestoreScroll } from "@/lib/persist";
import { qs } from "@/lib/utils";

interface Row { id: string; youtube_id: string; title: string; level: string; category: string; visibility: string; owner_name: string; sentence_count: number; mine: boolean; completion: number }
const LEVELS = ["", "A1", "A2", "B1", "B2", "C1"] as const;

function VideoList() {
  const t = useT();
  const ask = useConfirm();
  const [level, setLevel] = usePersistedState<string>("video.level", "");
  const [input, setInput] = usePersistedState("video.input", "");
  const [q, setQ] = usePersistedState("video.q", "");
  const [page, setPage] = usePersistedState("video.page", 1);
  const [adding, setAdding] = useState(false);
  const list = useGet<Row[]>(`/video-lessons?${qs({ level, q, page, limit: 12 })}`);
  const del = useSend<unknown, string>("DELETE", (id) => `/video-lessons/${id}`, ["/video-lessons"]);
  const rows = list.data?.data ?? [];
  useRestoreScroll("video-list", !list.isLoading);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink href="/listening">{t("← Tất cả bài nghe")}</BackLink>
        <Button onClick={() => setAdding(!adding)}>{adding ? t("Đóng") : t("+ Thêm video")}</Button>
      </div>
      {adding && <LessonForm />}
      <p className="text-slate-500 dark:text-slate-400">{t("Nghe video YouTube, gõ lại những gì bạn nghe được và nhận điểm theo từng câu. Bài của bạn là riêng tư; bài do giáo viên thêm hiển thị cho mọi người.")}</p>
      <div className="flex flex-wrap gap-2">
        <Tabs value={level} onChange={(v) => { setLevel(v); setPage(1); }} options={LEVELS.map((l) => [l, l || t("Tất cả")] as const)} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
          <input className={`${inputCls} w-48`} placeholder={t("Tìm bài...")} value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" variant="ghost">{t("Tìm")}</Button>
        </form>
      </div>
      {del.error && <ErrorBox error={del.error} />}
      {list.isLoading ? <Spinner /> : list.error ? <ErrorBox error={list.error} /> : rows.length === 0 ? <Empty>{t("Chưa có bài nghe video nào. Hãy thêm video đầu tiên của bạn!")}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="space-y-2 overflow-hidden p-0">
              <Link href={`/listening/video/${r.id}`} className="block">
                <img src={`https://i.ytimg.com/vi/${r.youtube_id}/mqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover" />
              </Link>
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 font-semibold ${LEVEL_COLOR[r.level] ?? ""}`}>{r.level}</span>
                  <span className="text-slate-500">{r.category} · {t("{n} câu", { n: r.sentence_count })}</span>
                  <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 dark:bg-slate-700">{r.mine ? t("Của tôi") : t("Công khai")}</span>
                </div>
                <Link href={`/listening/video/${r.id}`} className="block font-semibold hover:text-indigo-600">{r.title}</Link>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-green-500" style={{ width: `${r.completion}%` }} /></div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t("Hoàn thành {n}%", { n: r.completion })}</span>
                  {r.mine && <button className="text-red-600 hover:underline" onClick={async () => { if (await ask({ title: t("Xoá {name}?", { name: r.title }), message: t("Bài nghe và tiến độ của bạn sẽ bị xoá."), confirmLabel: t("Xoá"), danger: true })) del.mutate(r.id); }}>{t("Xoá")}</button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pager meta={list.data?.meta} onPage={setPage} />
    </div>
  );
}

export default function VideoListPage() {
  const t = useT();
  return <Protected><Page title={t("Luyện nghe qua video")}><VideoList /></Page></Protected>;
}
