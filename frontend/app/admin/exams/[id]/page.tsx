"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type { ExamGroup, ExamQuestion } from "@/components/exam/types";
import { Button, Card, ErrorBox, Page, Spinner, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Manage { id: string; title: string; duration_minutes: number; total_score: number; status: "draft" | "published"; transcript: string; warnings: string[]; has_audio?: boolean; audio?: { ext: string; size: number } | null; groups: ExamGroup[] }
interface Row { id: string; username: string; status: string; started_at: string; score: number | null; max_score: number | null }
const area = `${inputCls} font-mono`;

function QuestionEditor({ q, onChange, onDelete }: { q: ExamQuestion; onChange: (p: Partial<ExamQuestion>) => void; onDelete: () => void }) {
  const t = useT();
  const setOpt = (i: number, p: Partial<{ key: string; text: string }>) => onChange({ options: q.options.map((o, k) => (k === i ? { ...o, ...p } : o)) });
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} className={`${inputCls} w-20`} value={q.no} onChange={(e) => onChange({ no: Number(e.target.value) })} aria-label={t("Số câu")} />
        <select className={`${inputCls} w-auto`} value={q.type} onChange={(e) => onChange({ type: e.target.value as "mc" | "fill" })}><option value="mc">{t("Trắc nghiệm")}</option><option value="fill">{t("Điền từ")}</option></select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={q.inline} onChange={(e) => onChange({ inline: e.target.checked })} />{t("Chỗ trống trong đoạn văn")}</label>
        <Button variant="danger" className="ml-auto" onClick={onDelete}>{t("Xoá câu")}</Button>
      </div>
      <textarea rows={2} className={area} placeholder={t("Nội dung câu hỏi")} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      {q.type === "mc" ? (
        <>
          {q.options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inputCls} w-16`} value={o.key} maxLength={4} onChange={(e) => setOpt(i, { key: e.target.value.toUpperCase() })} aria-label={t("Ký hiệu")} />
              <input className={inputCls} value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} aria-label={t("Đáp án")} />
              <Button variant="ghost" onClick={() => onChange({ options: q.options.filter((_, k) => k !== i) })}>✕</Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => onChange({ options: [...q.options, { key: String.fromCharCode(65 + q.options.length), text: "" }] })}>{t("+ Thêm đáp án")}</Button>
            <label className="flex items-center gap-1 text-sm">{t("Đáp án đúng")}
              <select className={`${inputCls} w-auto`} value={q.correct?.[0] ?? ""} onChange={(e) => onChange({ correct: e.target.value ? [e.target.value] : [] })}>
                <option value="">—</option>{q.options.map((o) => <option key={o.key} value={o.key}>{o.key}</option>)}
              </select>
            </label>
          </div>
        </>
      ) : (
        <input className={inputCls} placeholder={t("Các đáp án chấp nhận, cách nhau bằng dấu |")} value={(q.correct ?? []).join(" | ")} onChange={(e) => onChange({ correct: e.target.value.split("|").map((x) => x.trim()) })} />
      )}
      <input className={inputCls} placeholder={t("Giải thích (không bắt buộc)")} value={q.explanation ?? ""} onChange={(e) => onChange({ explanation: e.target.value })} />
    </div>
  );
}

function Editor({ initial }: { initial: Manage }) {
  const t = useT();
  const ask = useConfirm();
  const [d, setD] = useState({ title: initial.title, duration_minutes: initial.duration_minutes, total_score: initial.total_score, transcript: initial.transcript, groups: initial.groups });
  const save = useSend<Manage, { body: Record<string, unknown> }>("PUT", `/exams/${initial.id}`, ["/exams"], (v) => v.body);
  const audio = useSend<unknown, FormData>("POST", `/exams/${initial.id}/audio`, ["/exams"]);
  const rmAudio = useSend<unknown>("DELETE", `/exams/${initial.id}/audio`, ["/exams"]);
  const rows = useGet<Row[]>(`/exams/${initial.id}/attempts`);
  const cur = useGet<Manage>(`/exams/${initial.id}/manage`).data?.data ?? initial;

  const setGroup = (gi: number, p: Partial<ExamGroup>) => setD((x) => ({ ...x, groups: x.groups.map((g, i) => (i === gi ? { ...g, ...p } : g)) }));
  const setQ = (gi: number, qi: number, p: Partial<ExamQuestion>) => setGroup(gi, { questions: d.groups[gi]!.questions.map((q, i) => (i === qi ? { ...q, ...p } : q)) });
  const nextNo = Math.max(0, ...d.groups.flatMap((g) => g.questions.map((q) => q.no))) + 1;

  const body = (status?: "draft" | "published") => ({
    ...d, ...(status ? { status } : {}),
    groups: d.groups.map((g) => ({ ...g, passage: g.passage.filter((p) => p.trim()), questions: g.questions.map((q) => ({ no: q.no, type: q.type, prompt: q.prompt, options: q.type === "mc" ? q.options.filter((o) => o.key) : [], correct: (q.correct ?? []).filter(Boolean), explanation: q.explanation ?? "", inline: q.inline })) })),
  });
  const published = cur.status === "published";

  return (
    <Page title={t("Chỉnh sửa bài kiểm tra")}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/exams" className="text-sm text-indigo-600">{t("← Tất cả bài kiểm tra")}</Link>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${published ? "bg-green-600 text-white" : "bg-slate-300 text-slate-800"}`}>{published ? t("Đã công khai") : t("Bản nháp")}</span>
        <Link href={`/exams/${initial.id}`} className="text-sm text-indigo-600 underline">{t("Xem thử như học sinh")}</Link>
        <span className="ml-auto flex gap-2">
          <Button disabled={save.isPending} onClick={() => save.mutate({ body: body() })}>{t("Lưu")}</Button>
          <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ body: body(published ? "draft" : "published") })}>{published ? t("Gỡ xuống") : t("Lưu và công khai")}</Button>
        </span>
      </div>
      {save.error && <ErrorBox error={save.error} />}
      {save.isSuccess && <p className="text-sm text-green-600">✓ {t("Đã lưu.")}</p>}
      {initial.warnings.length > 0 && <Card className="space-y-1 text-sm"><p className="font-semibold">⚠ {t("Cảnh báo khi đọc đề")}</p><ul className="list-disc pl-5 text-amber-800 dark:text-amber-300">{initial.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Card>}

      <Card className="grid gap-3 sm:grid-cols-3">
        <label className="sm:col-span-3 text-sm">{t("Tiêu đề")}<input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
        <label className="text-sm">{t("Thời gian (phút)")}<input type="number" min={1} className={inputCls} value={d.duration_minutes} onChange={(e) => setD({ ...d, duration_minutes: Number(e.target.value) })} /></label>
        <label className="text-sm">{t("Tổng điểm")}<input type="number" min={1} className={inputCls} value={d.total_score} onChange={(e) => setD({ ...d, total_score: Number(e.target.value) })} /></label>
        <div className="text-sm"><p>{t("File nghe")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {cur.audio ? <span>🎧 {(cur.audio.size / 1048576).toFixed(1)} MB</span> : <span className="text-slate-500">{t("Chưa có")}</span>}
            <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); audio.mutate(fd); } }} />
            {cur.audio && <Button variant="ghost" onClick={() => rmAudio.mutate()}>{t("Xoá âm thanh")}</Button>}
          </div>
          {(audio.error || rmAudio.error) && <ErrorBox error={audio.error ?? rmAudio.error} />}
        </div>
        <label className="sm:col-span-3 text-sm">{t("Bản ghi âm (transcript, hiện cho học sinh sau khi nộp bài)")}<textarea rows={3} className={area} value={d.transcript} onChange={(e) => setD({ ...d, transcript: e.target.value })} /></label>
      </Card>

      {d.groups.map((g, gi) => (
        <Card key={g.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputCls} w-40`} value={g.section} placeholder={t("Phần")} onChange={(e) => setGroup(gi, { section: e.target.value })} />
            <select className={`${inputCls} w-auto`} value={g.kind} onChange={(e) => setGroup(gi, { kind: e.target.value as "normal" | "listening" })}><option value="normal">{t("Thường")}</option><option value="listening">{t("Nghe")}</option></select>
            <Button variant="danger" className="ml-auto" onClick={async () => { if (await ask({ title: t("Xoá nhóm câu hỏi này?"), message: t("Mọi câu hỏi trong nhóm sẽ bị xoá."), confirmLabel: t("Xoá"), danger: true })) setD((x) => ({ ...x, groups: x.groups.filter((_, i) => i !== gi) })); }}>{t("Xoá nhóm")}</Button>
          </div>
          <textarea rows={2} className={area} placeholder={t("Hướng dẫn làm bài")} value={g.instruction} onChange={(e) => setGroup(gi, { instruction: e.target.value })} />
          <textarea rows={4} className={area} placeholder={t("Đoạn văn (cách nhau bằng dòng trống; chỗ trống ghi {{số câu}})")} value={g.passage.join("\n\n")} onChange={(e) => setGroup(gi, { passage: e.target.value.split(/\n{2,}/) })} />
          {g.questions.map((q, qi) => <QuestionEditor key={qi} q={q} onChange={(p) => setQ(gi, qi, p)} onDelete={() => setGroup(gi, { questions: g.questions.filter((_, i) => i !== qi) })} />)}
          <Button variant="ghost" onClick={() => setGroup(gi, { questions: [...g.questions, { no: nextNo, type: "mc", prompt: "", options: ["A", "B", "C", "D"].map((k) => ({ key: k, text: "" })), correct: [], explanation: "", inline: false }] })}>{t("+ Thêm câu hỏi")}</Button>
        </Card>
      ))}
      <Button variant="ghost" onClick={() => setD((x) => ({ ...x, groups: [...x.groups, { id: Math.random().toString(16).slice(2, 10), section: "", kind: "normal", instruction: "", passage: [], questions: [] }] }))}>{t("+ Thêm nhóm câu hỏi")}</Button>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("Kết quả của học sinh")}</h2>
        {rows.isLoading ? <Spinner /> : (rows.data?.data.length ?? 0) === 0 ? <p className="text-sm text-slate-500">{t("Chưa có ai làm bài này.")}</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-2">{t("Học sinh")}</th><th>{t("Trạng thái")}</th><th>{t("Điểm")}</th><th>{t("Bắt đầu")}</th><th></th></tr></thead>
            <tbody>
              {rows.data?.data.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-2">{r.username}</td><td>{r.status === "submitted" ? t("Đã nộp") : t("Đang làm")}</td>
                  <td>{r.score !== null ? `${r.score}/${r.max_score}` : "–"}</td><td>{new Date(r.started_at).toLocaleString()}</td>
                  <td>{r.status === "submitted" && <Link className="text-indigo-600 underline" href={`/exams/result/${r.id}`}>{t("Xem bài")}</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Page>
  );
}

export default function AdminExamEditor() {
  const { id } = useParams<{ id: string }>();
  const q = useGet<Manage>(`/exams/${id}/manage`);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (q.data) setReady(true); }, [q.data]);
  if (q.isLoading || !ready) return q.error ? <div className="p-6"><ErrorBox error={q.error} /></div> : <Spinner />;
  return <Editor initial={q.data!.data} />;
}
