"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

function useLoop(steps: number, ms: number): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % steps), ms);
    return () => clearInterval(id);
  }, [steps, ms]);
  return i;
}

function Shell({ caption, step, steps, children }: { caption: string; step: number; steps: number; children: ReactNode }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 dark:border-indigo-800 dark:bg-indigo-950/30" aria-label={t("Cách chơi")}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">▶ {t("Cách chơi (demo)")}</p>
      <div className="mx-auto max-w-xs">{children}</div>
      <p className="mt-3 min-h-10 text-center text-sm text-slate-700 dark:text-slate-200" aria-live="polite">{caption}</p>
      <div className="mt-1 flex justify-center gap-1">{Array.from({ length: steps }, (_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`} />)}</div>
    </div>
  );
}

const Tap = () => <span className="absolute -bottom-3 -right-2 z-10 animate-bounce text-xl" aria-hidden="true">👆</span>;

/* ---------- memory flip ---------- */
const MEM_CARDS = [{ id: "a1", pair: "A", text: "apple" }, { id: "b1", pair: "B", text: "con chó" }, { id: "a2", pair: "A", text: "quả táo" }, { id: "b2", pair: "B", text: "dog" }];
const MEM_STEPS: { open: string[]; matched: string[]; tap?: string; bad?: boolean; cap: string }[] = [
  { open: ["a1", "b1", "a2", "b2"], matched: [], cap: "1. Các thẻ lật ngửa vài giây để bạn ghi nhớ vị trí." },
  { open: [], matched: [], cap: "2. Sau đó tất cả thẻ úp xuống." },
  { open: ["a1"], matched: [], tap: "a1", cap: "3. Lật một thẻ…" },
  { open: ["a1", "b1"], matched: [], tap: "b1", bad: true, cap: "…rồi lật thẻ thứ hai. Không khớp thì hai thẻ sẽ tự úp lại." },
  { open: [], matched: [], cap: "Nhớ vị trí và thử lại!" },
  { open: ["a1"], matched: [], tap: "a1", cap: "Lật lại thẻ “apple”…" },
  { open: ["a1", "a2"], matched: ["A"], tap: "a2", cap: "Khớp! Cặp từ - nghĩa được giữ lại và hiện màu xanh." },
  { open: ["b1"], matched: ["A"], tap: "b1", cap: "Tiếp tục tìm các cặp còn lại…" },
  { open: [], matched: ["A", "B"], cap: "Tìm hết các cặp để hoàn thành. Ít lượt lật hơn = điểm cao hơn!" },
];

function MemoryDemo() {
  const t = useT();
  const step = useLoop(MEM_STEPS.length, 1500);
  const s = MEM_STEPS[step] ?? MEM_STEPS[0]!;
  return (
    <Shell caption={t(s.cap)} step={step} steps={MEM_STEPS.length}>
      <div className="grid grid-cols-2 gap-2">
        {MEM_CARDS.map((c) => {
          const done = s.matched.includes(c.pair);
          const up = done || s.open.includes(c.id);
          const bad = s.bad && s.open.includes(c.id);
          return (
            <div key={c.id} className="flip-scene relative h-14">
              <div className={`flip-inner h-full w-full ${up ? "is-flipped" : ""}`}>
                <div className="flip-face flex items-center justify-center rounded-lg bg-indigo-600 text-xl font-bold text-white">?</div>
                <div className={`flip-face flip-back flex items-center justify-center rounded-lg border-2 text-sm font-medium transition-colors ${done ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200" : bad ? "animate-shake border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200" : "border-indigo-300 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"}`}>{c.text}</div>
              </div>
              {s.tap === c.id && <Tap />}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ---------- classic matching ---------- */
const EN = [{ id: "A", text: "apple" }, { id: "B", text: "dog" }];
const VI = [{ id: "B", text: "con chó" }, { id: "A", text: "quả táo" }];
const CLS_STEPS: { en?: string; vi?: string; bad?: boolean; matched: string[]; cap: string }[] = [
  { matched: [], cap: "1. Chọn một từ tiếng Anh ở cột bên trái…" },
  { en: "A", matched: [], cap: "…rồi chọn nghĩa tiếng Việt tương ứng ở cột bên phải." },
  { en: "A", vi: "B", bad: true, matched: [], cap: "Chọn sai: hai ô sẽ rung và hiện màu đỏ." },
  { en: "A", matched: [], cap: "Chọn lại từ “apple”…" },
  { en: "A", vi: "A", matched: ["A"], cap: "Đúng! Cặp được ghép hiện màu xanh." },
  { en: "B", matched: ["A"], cap: "Tiếp tục với các từ còn lại…" },
  { matched: ["A", "B"], cap: "Ghép hết các cặp để hoàn thành, càng nhanh và ít sai càng nhiều điểm!" },
];

function ClassicDemo() {
  const t = useT();
  const step = useLoop(CLS_STEPS.length, 1500);
  const s = CLS_STEPS[step] ?? CLS_STEPS[0]!;
  const cell = (id: string, text: string, side: "en" | "vi") => {
    const done = s.matched.includes(id);
    const picked = (side === "en" ? s.en : s.vi) === id;
    const cls = done ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
      : picked && s.bad ? "animate-shake border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200"
      : picked ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 dark:border-slate-700";
    return <div key={`${side}${id}`} className={`relative rounded-lg border-2 p-2 text-center text-sm transition-colors ${cls}`}>{text}{picked && !done && <Tap />}</div>;
  };
  return (
    <Shell caption={t(s.cap)} step={step} steps={CLS_STEPS.length}>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">{EN.map((c) => cell(c.id, c.text, "en"))}</div>
        <div className="grid gap-2">{VI.map((c) => cell(c.id, c.text, "vi"))}</div>
      </div>
    </Shell>
  );
}

/* ---------- fill in the blank ---------- */
const BLANKS = [
  { before: "She", after: "to school every day.", options: ["go", "goes", "going"], answer: "goes" },
  { before: "My birthday is", after: "May.", options: ["in", "on", "at"], answer: "in" },
];
const FILL_STEPS: { q: number; chosen?: string; reveal?: boolean; cap: string }[] = [
  { q: 0, cap: "1. Đọc câu và tìm chỗ trống cần điền." },
  { q: 0, chosen: "go", cap: "2. Chọn một từ: từ đó sẽ rơi vào chỗ trống." },
  { q: 0, chosen: "go", reveal: true, cap: "Sai: từ bạn chọn hiện màu đỏ, đáp án đúng hiện màu xanh." },
  { q: 1, cap: "Sang câu tiếp theo…" },
  { q: 1, chosen: "in", cap: "Chọn từ phù hợp…" },
  { q: 1, chosen: "in", reveal: true, cap: "Đúng! Từ được chọn hiện màu xanh và bạn được cộng điểm." },
];

function FillDemo() {
  const t = useT();
  const step = useLoop(FILL_STEPS.length, 1600);
  const s = FILL_STEPS[step] ?? FILL_STEPS[0]!;
  const q = BLANKS[s.q] ?? BLANKS[0]!;
  const ok = s.reveal ? s.chosen === q.answer : undefined;
  const tone = ok === undefined ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950" : ok ? "border-green-500 bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100" : "border-red-500 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100";
  return (
    <Shell caption={t(s.cap)} step={step} steps={FILL_STEPS.length}>
      <p className="text-center text-base">
        {q.before}{" "}
        <span key={`${s.q}-${s.chosen ?? ""}-${s.reveal ?? ""}`} className={`inline-block min-w-14 rounded-md border-2 px-2 ${s.chosen ? `animate-pop ${tone}` : "border-dashed border-slate-400"}`}>{s.chosen ?? "\u00A0"}</span>{" "}
        {q.after}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {q.options.map((o) => {
          const isAnswer = s.reveal && o === q.answer;
          const wrong = s.reveal && o === s.chosen && o !== q.answer;
          const cls = isAnswer ? "border-green-600 bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100" : wrong ? "animate-shake border-red-600 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100"
            : s.chosen === o ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 dark:border-slate-700";
          return <div key={o} className={`relative rounded-lg border-2 py-1.5 text-center text-sm transition-colors ${cls}`}>{o}{s.chosen === o && !s.reveal && <Tap />}</div>;
        })}
      </div>
    </Shell>
  );
}

export function GameDemo({ kind }: { kind: "memory" | "classic" | "blank" }) {
  return kind === "memory" ? <MemoryDemo /> : kind === "classic" ? <ClassicDemo /> : <FillDemo />;
}
