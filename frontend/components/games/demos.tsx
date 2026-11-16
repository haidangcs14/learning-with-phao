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
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary-soft/60 p-4" aria-label={t("Cách chơi")}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-text">▶ {t("Cách chơi (demo)")}</p>
      <div className="mx-auto max-w-xs">{children}</div>
      <p className="mt-3 min-h-10 text-center text-sm text-foreground" aria-live="polite">{caption}</p>
      <div className="mt-1 flex justify-center gap-1">{Array.from({ length: steps }, (_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-primary" : "bg-border"}`} />)}</div>
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
                <div className="flip-face flex items-center justify-center rounded-btn bg-primary text-xl font-bold text-primary-foreground">?</div>
                <div className={`flip-face flip-back flex items-center justify-center rounded-btn border-2 text-sm font-medium transition-colors ${done ? "border-success bg-success-soft text-success-text" : bad ? "animate-shake border-error bg-error-soft text-error-text" : "border-primary/40 bg-surface text-foreground"}`}>{c.text}</div>
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
    const cls = done ? "border-success bg-success-soft text-success-text"
      : picked && s.bad ? "animate-shake border-error bg-error-soft text-error-text"
      : picked ? "border-primary bg-primary-soft" : "border-border";
    return <div key={`${side}${id}`} className={`relative rounded-btn border-2 p-2 text-center text-sm transition-colors ${cls}`}>{text}{picked && !done && <Tap />}</div>;
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
  const tone = ok === undefined ? "border-primary bg-primary-soft" : ok ? "border-success bg-success-soft text-success-text" : "border-error bg-error-soft text-error-text";
  return (
    <Shell caption={t(s.cap)} step={step} steps={FILL_STEPS.length}>
      <p className="text-center text-base">
        {q.before}{" "}
        <span key={`${s.q}-${s.chosen ?? ""}-${s.reveal ?? ""}`} className={`inline-block min-w-14 rounded-md border-2 px-2 ${s.chosen ? `animate-pop ${tone}` : "border-dashed border-border"}`}>{s.chosen ?? "\u00A0"}</span>{" "}
        {q.after}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {q.options.map((o) => {
          const isAnswer = s.reveal && o === q.answer;
          const wrong = s.reveal && o === s.chosen && o !== q.answer;
          const cls = isAnswer ? "border-success bg-success-soft text-success-text" : wrong ? "animate-shake border-error bg-error-soft text-error-text"
            : s.chosen === o ? "border-primary bg-primary-soft" : "border-border";
          return <div key={o} className={`relative rounded-btn border-2 py-1.5 text-center text-sm transition-colors ${cls}`}>{o}{s.chosen === o && !s.reveal && <Tap />}</div>;
        })}
      </div>
    </Shell>
  );
}

/* ---------- word bridge ---------- */
const BR_WORDS = ["I", "eat", "an", "apple"];
const BR_PLANKS = ["apple", "I", "an", "eat"];
const BR_STEPS: { filled: number; bad?: string; hearts: number; green?: boolean; cap: string; tap?: string }[] = [
  { filled: 0, hearts: 5, cap: "1. Đọc nghĩa tiếng Việt của câu: các ô trống là số từ cần xếp." },
  { filled: 1, hearts: 5, tap: "I", cap: "2. Bấm đúng từ: từ vào ô, một nhịp cầu hiện ra và chú chim nhảy lên." },
  { filled: 1, hearts: 4, bad: "apple", tap: "apple", cap: "Bấm sai từ: ván gỗ đỏ lên và rung, mất 1 tim, từ không vào ô." },
  { filled: 2, hearts: 4, tap: "eat", cap: "Bấm tiếp từ đúng để dựng cầu…" },
  { filled: 4, hearts: 4, cap: "…đến khi điền đủ các ô, rồi bấm Kiểm tra (hoặc Enter)." },
  { filled: 4, hearts: 4, green: true, cap: "Cả cầu chuyển xanh, câu được đọc và chim sang bờ bên kia. Câu tiếp theo sẽ tự bắt đầu!" },
];

function BridgeDemo() {
  const t = useT();
  const step = useLoop(BR_STEPS.length, 1700);
  const s = BR_STEPS[step] ?? BR_STEPS[0]!;
  return (
    <Shell caption={t(s.cap)} step={step} steps={BR_STEPS.length}>
      <p className="text-center text-xs text-muted-foreground">❤️ {"❤️".repeat(Math.max(0, s.hearts - 1))}{"🤍".repeat(5 - s.hearts)}</p>
      <p className="mb-2 text-center text-sm italic text-primary-text">“{t("Tôi ăn một quả táo.")}”</p>
      <div className="flex justify-center gap-1.5">
        {BR_WORDS.map((w, i) => <span key={i} className={`flex h-9 min-w-10 items-center justify-center rounded-btn border-2 px-1.5 text-sm font-semibold transition-all duration-300 ${i < s.filled ? (s.green ? "border-success bg-success-soft text-success-text" : "border-primary bg-primary-soft text-foreground") : "border-dashed border-border"}`}>{i < s.filled ? w : ""}</span>)}
      </div>
      <div className="relative mt-3 flex h-12 items-end justify-center gap-1 rounded-btn bg-secondary-soft px-2 pb-1">
        {BR_WORDS.map((_, i) => <span key={i} className={`h-2.5 w-10 rounded-sm transition-all duration-300 ${i < s.filled ? (s.green ? "bg-success" : "bg-accent") : "scale-y-0 bg-accent"}`} />)}
        <span className="absolute bottom-3 text-xl transition-all duration-500" style={{ left: s.green ? "88%" : `${8 + (s.filled / BR_WORDS.length) * 72}%` }}>🐦</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {BR_PLANKS.map((w) => {
          const used = BR_WORDS.slice(0, s.filled).includes(w) && !(w === "apple" && s.filled < 4);
          return <span key={w} className={`relative rounded-md border-b-4 px-3 py-1.5 text-sm font-bold transition ${s.bad === w ? "animate-shake border-error bg-error text-error-foreground" : "border-[#7c4a1d] bg-[#c98a4b] text-[#3b200b]"} ${used ? "opacity-0" : ""}`}>{w}{s.tap === w && <Tap />}</span>;
        })}
      </div>
    </Shell>
  );
}

/* ---------- vocabulary rain ---------- */
const RAIN_STEPS: { y: number; typed: number; boom?: boolean; miss?: boolean; hearts: number; cap: string }[] = [
  { y: 6, typed: 0, hearts: 3, cap: "1. Từ rơi xuống như mưa, kèm nghĩa tiếng Việt và các ô chữ." },
  { y: 30, typed: 1, hearts: 3, cap: "2. Gõ đúng từng chữ cái: mỗi chữ đúng sẽ làm sáng một ô." },
  { y: 48, typed: 2, hearts: 3, cap: "Tiếp tục gõ trước khi từ chạm đất…" },
  { y: 56, typed: 3, boom: true, hearts: 3, cap: "3. Gõ xong: từ tan thành tia sáng, được cộng điểm và đọc lên. Gõ liên tiếp đúng sẽ có combo!" },
  { y: 70, typed: 0, miss: true, hearts: 2, cap: "4. Để từ chạm đất: mất 1 mạng và hiện đáp án đúng để bạn ghi nhớ." },
];

function RainDemo() {
  const t = useT();
  const step = useLoop(RAIN_STEPS.length, 1800);
  const s = RAIN_STEPS[step] ?? RAIN_STEPS[0]!;
  const word = s.miss ? "dog" : "cat";
  return (
    <Shell caption={t(s.cap)} step={step} steps={RAIN_STEPS.length}>
      <div className="relative h-40 overflow-hidden rounded-xl bg-gradient-to-b from-[#050d2b] to-[#143a7b] text-white">
        <div className="absolute inset-x-0 top-1 flex justify-between px-2 text-[11px] font-bold"><span>⭐ {s.boom ? 10 : 0}</span><span>{"❤️".repeat(s.hearts)}{"🖤".repeat(3 - s.hearts)}</span></div>
        <div className="absolute inset-x-0 bottom-0 h-5 bg-[#0b2a5b]" />
        <span className="absolute bottom-4 left-3 text-2xl" aria-hidden="true">{s.miss ? "😟" : s.boom ? "😄" : "🙂"}</span>
        {!s.boom && (
          <div className="absolute left-1/2 w-32 -translate-x-1/2 rounded-xl border-2 border-secondary/70 bg-white/15 p-1.5 text-center transition-all duration-700" style={{ top: `${s.y}%` }}>
            <p className="text-xs font-semibold">{s.miss ? t("con chó") : t("con mèo")}</p>
            <div className="mt-1 flex justify-center gap-1">{word.split("").map((c, i) => <span key={i} className={`flex h-6 w-6 items-center justify-center rounded text-sm font-bold ${i < s.typed ? "bg-accent text-accent-foreground" : "border border-surface/60 bg-slate-900/50"}`}>{i < s.typed ? c.toUpperCase() : ""}</span>)}</div>
          </div>
        )}
        {s.boom && <span className="absolute left-1/2 top-[45%] -translate-x-1/2 text-3xl" aria-hidden="true">✨ <b className="text-base text-yellow-300">+10</b></span>}
        {s.miss && <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-btn bg-slate-900/90 px-3 py-1 text-sm font-bold text-yellow-300">dog</span>}
      </div>
    </Shell>
  );
}

/* ---------- word guess (wordle) ---------- */
const WG_ROWS: { word: string; colors: string[] }[] = [
  { word: "PAPER", colors: ["y", "y", "g", "y", "x"] },
  { word: "AMPLE", colors: ["g", "x", "g", "g", "g"] },
  { word: "APPLE", colors: ["g", "g", "g", "g", "g"] },
];
const WG_STEPS: { rows: number; typed: number; caption: string }[] = [
  { rows: 0, typed: 0, caption: "1. Đọc nghĩa (quả táo) và để ý số chữ cái: 5 chữ." },
  { rows: 0, typed: 1, caption: "2. Gõ một từ đúng độ dài rồi nhấn Enter." },
  { rows: 1, typed: 0, caption: "Xanh = đúng chữ đúng chỗ · Vàng = đúng chữ sai chỗ · Xám = không có trong từ." },
  { rows: 2, typed: 0, caption: "Mỗi lượt thu hẹp đáp án dần…" },
  { rows: 3, typed: 0, caption: "3. Giải được trong sáu lượt! Thua thì mất 1 mạng và được xem đáp án. Giải liên tiếp để tăng chuỗi 🔥" },
];
const WG_COLOR: Record<string, string> = { g: "#16a34a", y: "#eab308", x: "#6b7280" };

function GuessDemo() {
  const t = useT();
  const step = useLoop(WG_STEPS.length, 2000);
  const s = WG_STEPS[step] ?? WG_STEPS[0]!;
  return (
    <Shell caption={t(s.caption)} step={step} steps={WG_STEPS.length}>
      <p className="mb-2 text-center text-sm font-semibold">🍎 {t("quả táo")} · <span className="text-muted-foreground">{t("{n} chữ cái", { n: 5 })}</span></p>
      <div className="space-y-1.5">
        {[0, 1, 2].map((r) => {
          const row = WG_ROWS[r] as (typeof WG_ROWS)[number];
          const shown = r < s.rows, typing = r === s.rows && s.typed > 0;
          return (
            <div key={`${r}-${s.rows}`} className="flex justify-center gap-1.5">
              {row.word.split("").map((c, i) => (
                <span key={i} className={`flex h-10 w-10 items-center justify-center rounded-md border-2 text-lg font-bold ${shown ? "tile-reveal text-white" : "border-border"}`}
                  style={shown ? ({ "--tile-bg": WG_COLOR[row.colors[i] as string], "--tile-from": "transparent", "--tile-from-border": "#94a3b8", animationDelay: `${i * 120}ms` } as React.CSSProperties) : undefined}>
                  {shown || (typing && i < s.typed) ? c : ""}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function GameDemo({ kind }: { kind: "memory" | "classic" | "blank" | "bridge" | "rain" | "guess" }) {
  return kind === "memory" ? <MemoryDemo /> : kind === "classic" ? <ClassicDemo /> : kind === "blank" ? <FillDemo /> : kind === "bridge" ? <BridgeDemo /> : kind === "rain" ? <RainDemo /> : <GuessDemo />;
}
