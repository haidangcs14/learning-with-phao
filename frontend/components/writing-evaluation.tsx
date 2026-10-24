"use client";

import { AssessmentText } from "@/components/assessment-text";
import { useT } from "@/lib/i18n";
import type { Assessment } from "@/types";

export interface WritingEval {
  overall: number; task: number; coherence: number; vocabulary: number; grammar: number; mechanics: number;
  feedback: { code: string; params: Record<string, string | number> }[];
  corrections: { original: string; better: string; why: string }[];
  comments: string[]; summary: string; improved: string; assessment: Assessment;
  stats: { words: number; sentences: number; paragraphs: number; avg_sentence_len: number; unique: number; connectors: string[] };
  method: Record<string, string | null>;
}

const FEEDBACK: Record<string, string> = {
  too_short: "Bài viết còn ngắn: {words}/{min} từ yêu cầu.", too_long: "Bài viết hơi dài ({words} từ, giới hạn khoảng {max}).",
  good_length: "Độ dài phù hợp ({words} từ).", off_topic: "Bài chưa bám sát đề: thử đề cập đến {words}.",
  no_connectors: "Chưa dùng từ nối: thêm however, because, for example… để liên kết ý.", good_connectors: "Dùng từ nối tốt ({n} loại).",
  one_paragraph: "Bài dài nhưng chỉ có một đoạn: hãy chia đoạn.", short_sentences: "Câu khá ngắn (trung bình {avg} từ): thử nối các ý thành câu dài hơn.",
  long_sentences: "Câu khá dài (trung bình {avg} từ): thử tách thành các câu ngắn hơn.", repeated_word: "Từ “{word}” lặp lại {n} lần: hãy dùng từ khác.",
  spelling: "Có {n} lỗi chính tả: xem phần sửa lỗi bên dưới.", capital_i: "Đại từ “I” luôn được viết hoa.", good_grammar: "Không phát hiện lỗi ngữ pháp thường gặp. Tốt lắm!",
};
const POSITIVE = new Set(["good_length", "good_connectors", "good_grammar"]);
const BARS: [keyof WritingEval, string][] = [["task", "Hoàn thành yêu cầu đề"], ["coherence", "Mạch lạc & liên kết"], ["vocabulary", "Từ vựng"], ["grammar", "Ngữ pháp"], ["mechanics", "Chính tả & dấu câu"]];

export function WritingEvaluation({ ev }: { ev: WritingEval }) {
  const t = useT();
  const color = (v: number) => (v >= 75 ? "bg-green-500" : v >= 50 ? "bg-amber-500" : "bg-red-500");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/50">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold text-white">{ev.overall}</div>
        <div><p className="text-lg font-semibold">{t("Điểm tổng")} / 100</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("{n} từ", { n: ev.stats.words })} · {t("{n} câu", { n: ev.stats.sentences })} · {t("{n} đoạn", { n: ev.stats.paragraphs })}</p></div>
      </div>
      <AssessmentText a={ev.assessment} kind="writing" />
      <div className="space-y-3">
        {BARS.map(([k, label]) => {
          const v = ev[k] as number;
          return (
            <div key={k}>
              <div className="flex justify-between text-sm"><span>{t(label)}</span><b>{v}</b></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className={`h-full rounded-full transition-all ${color(v)}`} style={{ width: `${v}%` }} /></div>
            </div>
          );
        })}
      </div>
      {ev.feedback.length > 0 && (
        <ul className="space-y-1 text-sm">
          {ev.feedback.map((f, i) => (
            <li key={i} className={`flex gap-2 rounded-lg px-3 py-2 ${POSITIVE.has(f.code) ? "bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}>
              <span aria-hidden="true">{POSITIVE.has(f.code) ? "✓" : "•"}</span><span>{FEEDBACK[f.code] ? t(FEEDBACK[f.code] as string, f.params) : f.code}</span>
            </li>
          ))}
        </ul>
      )}
      {ev.corrections.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">{t("Gợi ý sửa lỗi")}</p>
          <ul className="space-y-2 text-sm">
            {ev.corrections.map((c, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <span className="text-[#b5412a] line-through dark:text-[#ef8a74]">{c.original}</span> → <b className="text-green-700 dark:text-green-400">{c.better}</b>
                {c.why && <span className="block text-xs text-slate-500">{c.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ev.summary && <div><p className="mb-1 text-sm font-semibold">{t("Đánh giá của AI")}</p><p className="text-sm leading-relaxed">{ev.summary}</p></div>}
      {ev.comments.length > 0 && <div><p className="mb-1 text-sm font-semibold">{t("Nhận xét của AI")}</p><ul className="list-disc space-y-1 pl-5 text-sm">{ev.comments.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
      {ev.improved && <div><p className="mb-1 text-sm font-semibold">{t("Phiên bản gợi ý (AI)")}</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{ev.improved}</p></div>}
      <p className="text-xs text-slate-500">{ev.method.llm ? t("Chấm bằng quy tắc và mô hình AI chạy trên máy bạn ({m}).", { m: ev.method.llm }) : t("Chấm tự động bằng quy tắc ngay trên máy bạn. Bật Ollama (LLM_MODEL) để có nhận xét chi tiết hơn.")}</p>
    </div>
  );
}
