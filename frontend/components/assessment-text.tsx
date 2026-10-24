"use client";

import { useT } from "@/lib/i18n";
import type { Assessment } from "@/types";

// Vietnamese text is the key (English in lib/i18n.ts).
const BAND = {
  speaking: {
    excellent: "Bài nói rất tốt: bạn nói tự nhiên, rõ ràng và gần như không mắc lỗi đáng kể.",
    good: "Bài nói tốt: ý được truyền đạt rõ ràng, còn một vài điểm có thể cải thiện.",
    fair: "Bài nói ở mức khá: bạn truyền đạt được ý chính nhưng còn nhiều điểm cần luyện thêm.",
    needs_work: "Bài nói cần cải thiện nhiều: hãy luyện để nói dài hơn, trôi chảy hơn và chính xác hơn.",
  },
  writing: {
    excellent: "Bài viết rất tốt: ý tưởng rõ ràng, liên kết chặt chẽ và gần như không có lỗi đáng kể.",
    good: "Bài viết tốt: bố cục và ý rõ ràng, còn một số lỗi nhỏ cần sửa.",
    fair: "Bài viết ở mức khá: người đọc hiểu được ý chính nhưng cần cải thiện bố cục, liên kết và độ chính xác.",
    needs_work: "Bài viết cần cải thiện nhiều: hãy viết đầy đủ hơn, tổ chức ý rõ ràng hơn và kiểm tra lỗi trước khi nộp.",
  },
} as const;
const CRITERIA: Record<string, string> = {
  fluency: "Độ trôi chảy", pronunciation: "Phát âm", grammar: "Ngữ pháp", vocabulary: "Từ vựng",
  task: "Hoàn thành yêu cầu đề", coherence: "Mạch lạc & liên kết", mechanics: "Chính tả & dấu câu",
};
const TIPS: Record<string, string> = {
  speak_more: "Hãy cố nói dài hơn (ít nhất 30-40 từ) bằng cách thêm lý do và ví dụ.",
  shadowing: "Luyện nhại theo (shadowing) các đoạn nói ngắn để nói liền mạch hơn.",
  record_repeat: "Ghi âm lại, nghe và nhắc lại những từ bị nhận dạng sai.",
  grammar_review: "Ôn lại các lỗi ngữ pháp được gợi ý bên dưới.",
  new_words: "Học thêm từ vựng theo chủ đề và thử dùng chúng khi nói.",
  write_more: "Viết dài hơn để đạt số từ yêu cầu của đề.",
  use_connectors: "Dùng thêm từ nối (however, because, for example…) để liên kết các ý.",
  paragraphs: "Chia bài thành các đoạn: mở bài, thân bài, kết luận.",
  vary_vocab: "Thay các từ lặp lại bằng từ đồng nghĩa hoặc từ chính xác hơn.",
  proofread: "Đọc lại bài và sửa lỗi chính tả, viết hoa, dấu câu trước khi nộp.",
};

/** A short written assessment: overall verdict, strengths, weaknesses and next steps. */
export function AssessmentText({ a, kind }: { a: Assessment; kind: "speaking" | "writing" }) {
  const t = useT();
  const names = (keys: string[]) => keys.map((k) => t(CRITERIA[k] ?? k).toLowerCase()).join(", ");
  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/30">
      <p className="font-semibold">{t("Nhận xét tổng quan")}</p>
      <p>{t(BAND[kind][a.band])}</p>
      {a.strengths.length > 0 && <p className="text-green-800 dark:text-green-300">✓ {t("Điểm mạnh: {list}.", { list: names(a.strengths) })}</p>}
      {a.improve.length > 0 && <p className="text-[#9a2f1b] dark:text-[#ef8a74]">! {t("Cần cải thiện: {list}.", { list: names(a.improve) })}</p>}
      {a.tips.length > 0 && (
        <div><p className="font-medium">{t("Gợi ý luyện tập")}</p>
          <ul className="list-disc space-y-0.5 pl-5">{a.tips.map((x) => <li key={x}>{TIPS[x] ? t(TIPS[x] as string) : x}</li>)}</ul></div>
      )}
    </div>
  );
}
