"use client";

import { useState } from "react";
import { GameDemo } from "@/components/games/demos";
import { Button, Card, ErrorBox } from "@/components/ui";
import { useLang } from "@/store/lang-store";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Q { id: string; sentence: string; options: string[] }
interface Answer {
  correct: boolean; correct_answer: string; vi: string; finished: boolean;
  total?: number; total_correct?: number; score?: number; duration?: number; xp_awarded?: number; is_record?: boolean;
}

export function FillBlank() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const best = useGet<{ default: { score: number } | null }>("/games/fill_blank/best");
  const start = useSend<{ session_id: string; questions: Q[] }>("POST", "/games/fill_blank/start");
  const answer = useSend<Answer, { session_id: string; question_id: string; answer: string }>("POST", "/games/fill_blank/answer", ["/leaderboard", "/games", "/activity"]);
  const [session, setSession] = useState<string | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [res, setRes] = useState<Answer | null>(null);
  const [summary, setSummary] = useState<Answer | null>(null);

  function begin() {
    start.mutate(undefined, {
      onSuccess: (r) => { setSession(r.data.session_id); setQs(r.data.questions); setIdx(0); setChosen(null); setRes(null); setSummary(null); },
    });
  }
  function pick(q: Q, option: string) {
    if (chosen || !session || answer.isPending) return;
    setChosen(option); // the word drops into the blank immediately; colour comes once the server confirms
    answer.mutate({ session_id: session, question_id: q.id, answer: option }, {
      onSuccess: (r) => setRes(r.data),
      onError: () => setChosen(null),
    });
  }
  function next() {
    if (res?.finished) { setSummary(res); setSession(null); return; }
    setIdx((i) => i + 1); setChosen(null); setRes(null);
  }

  const q = qs[idx];
  const bestScore = best.data?.data.default?.score;
  const tone = (ok: boolean | undefined) => ok === undefined ? "border-primary bg-primary-soft text-primary-text"
    : ok ? "border-success bg-success-soft text-success-text" : "border-error bg-error-soft text-error-text";

  if (!session || !q) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("Chọn từ đúng để điền vào chỗ trống. Đáp án đúng hiện màu xanh, sai hiện màu đỏ.")}</p>
        <GameDemo kind="blank" />
        <p className="rounded-btn bg-accent-soft px-3 py-2 text-sm text-accent-text">
          🏆 {bestScore ? t("Điểm cao nhất: {score}", { score: bestScore }) : t("Chưa có điểm cao nhất. Hãy chơi ngay!")}
        </p>
        {summary && (
          <div className="animate-pop rounded-xl border border-success p-4">
            <p className="text-lg font-semibold">{summary.is_record ? t("🎉 Kỷ lục mới!") : t("Hoàn thành!")}</p>
            <p>{t("Đúng {c}/{n} · Điểm {score} · {sec}s · +{xp} XP", { c: summary.total_correct ?? 0, n: summary.total ?? 0, score: summary.score ?? 0, sec: summary.duration ?? 0, xp: summary.xp_awarded ?? 0 })}</p>
          </div>
        )}
        <Button onClick={begin} disabled={start.isPending}>{summary ? t("Chơi lại") : t("Bắt đầu")}</Button>
        {start.error && <ErrorBox error={start.error} />}
      </div>
    );
  }

  const [before = "", after = ""] = q.sentence.split("____");
  const ok = res?.correct;
  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("Câu {i} / {n}", { i: idx + 1, n: qs.length })}</span>
        <span className="h-2 w-32 overflow-hidden rounded-full bg-border"><span className="block h-full bg-primary transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} /></span>
      </div>
      <p className="text-xl leading-loose sm:text-2xl">
        {before}
        <span key={chosen ?? "blank"} className={`mx-1 inline-block min-w-24 rounded-btn border-2 px-3 py-0.5 text-center align-middle ${chosen ? `animate-pop ${tone(ok)}` : "border-dashed border-border"}`}>
          {chosen ?? "\u00A0"}
        </span>
        {after}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o) => {
          const isChosen = chosen === o;
          const isAnswer = res && o === res.correct_answer;
          const cls = !res ? (isChosen ? tone(undefined) : "border-border hover:border-primary")
            : isAnswer ? tone(true) : isChosen ? `animate-shake ${tone(false)}` : "border-border opacity-50";
          return (
            <button key={o} disabled={!!chosen} onClick={() => pick(q, o)} className={`rounded-btn border-2 px-4 py-3 text-left font-medium transition ${cls}`}>
              {o} {isAnswer && "✓"} {res && isChosen && !res.correct && "✗"}
            </button>
          );
        })}
      </div>
      {res && (
        <div className="space-y-2">
          <p className={`text-sm ${res.correct ? "text-success-text" : "text-error-text"}`}>
            {res.correct ? t("Chính xác!") : t("Đáp án đúng: {a}", { a: res.correct_answer })} {res.vi && lang === "vi" && <span className="text-muted-foreground">— {res.vi}</span>}
          </p>
          <Button onClick={next}>{res.finished ? t("Xem kết quả") : t("Câu tiếp theo")}</Button>
        </div>
      )}
      {answer.error && <ErrorBox error={answer.error} />}
    </Card>
  );
}
