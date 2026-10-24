"use client";

import { AssessmentText } from "@/components/assessment-text";
import { useT } from "@/lib/i18n";
import type { Evaluation } from "@/types";

// Vietnamese text is the key; English lives in lib/i18n.ts. {params} come from the backend feedback codes.
const FEEDBACK: Record<string, string> = {
  speak_longer: "Hãy nói dài hơn: bạn mới nói {words} từ.",
  too_fast: "Bạn nói khá nhanh ({wpm} từ/phút). Hãy chậm lại một chút.",
  too_slow: "Tốc độ nói hơi chậm ({wpm} từ/phút). Hãy cố nói liền mạch hơn.",
  good_pace: "Tốc độ nói tốt ({wpm} từ/phút)!",
  many_pauses: "Bạn dừng hơn 1 giây tới {n} lần. Hãy nghĩ câu tiếp theo trong khi đang nói.",
  fillers: "Bạn dùng từ đệm (um, uh…) {n} lần. Hãy thử im lặng ngắn thay vì dùng từ đệm.",
  low_clarity: "Một số từ khó nhận dạng. Hãy luyện phát âm: {words}.",
  repeat_words: "Hãy đa dạng từ vựng: bạn lặp lại “{word}” {n} lần.",
  good_vocab: "Vốn từ vựng đa dạng, rất tốt!",
  good_grammar: "Không phát hiện lỗi ngữ pháp thường gặp. Tuyệt vời!",
};
const POSITIVE = new Set(["good_pace", "good_vocab", "good_grammar"]);

function Bar({ label, value, note }: { label: string; value: number | null; note?: string }) {
  const t = useT();
  const color = value === null ? "bg-slate-300" : value >= 75 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><b>{value === null ? t("Chưa có") : value}</b></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value ?? 0}%` }} />
      </div>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export function SpeakingEvaluation({ ev, status }: { ev: Evaluation | null; status: string }) {
  const t = useT();
  if (!ev) {
    const msg = status === "no_speech" ? "Không phát hiện giọng nói trong bản ghi. Hãy kiểm tra micro và thử lại."
      : status === "failed" ? "Không thể phân tích bản ghi lúc này (xem log của backend). Bản ghi vẫn được lưu."
      : "Chấm điểm AI chưa được bật. Đặt AI_PROVIDER=local trong backend/.env để bật nhận dạng giọng nói và chấm điểm chạy ngay trên máy bạn.";
    return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t(msg)}</p>;
  }
  const m = ev.method ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/50">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold text-white">{ev.overall}</div>
        <div><p className="text-lg font-semibold">{t("Điểm tổng")} / 100</p>
          {ev.stats?.wpm ? <p className="text-sm text-slate-600 dark:text-slate-300">{t("{n} từ/phút", { n: ev.stats.wpm })} · {t("{n} từ", { n: ev.stats.words ?? 0 })}</p> : null}</div>
      </div>
      {ev.assessment && <AssessmentText a={ev.assessment} kind="speaking" />}
      <div className="space-y-3">
        <Bar label={t("Độ trôi chảy")} value={ev.fluency} />
        <Bar label={t("Phát âm")} value={ev.pronunciation} note={ev.pronunciation !== null ? t("Phát âm được ước lượng từ độ rõ mà bộ nhận dạng giọng nói nghe được, không thay thế được giáo viên.") : undefined} />
        <Bar label={t("Ngữ pháp")} value={ev.grammar} />
        <Bar label={t("Từ vựng")} value={ev.vocabulary} />
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
      {ev.comments.length > 0 && (
        <div><p className="mb-1 text-sm font-semibold">{t("Nhận xét của AI")}</p><ul className="list-disc space-y-1 pl-5 text-sm">{ev.comments.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      )}
      <p className="text-xs text-slate-500">{t("Điểm được tính ngay trên máy của bạn ({stt}; ngữ pháp: {grammar}).", { stt: m.stt ?? "–", grammar: m.grammar ?? "rules" })}</p>
    </div>
  );
}
