"use client";

import { useEffect, useRef, useState } from "react";
import { AudioWave } from "@/components/audio-wave";
import { Protected } from "@/components/protected";
import { SpeakingEvaluation } from "@/components/speaking-evaluation";
import { SpeakingHistory } from "@/components/speaking-history";
import { Button, Card, Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import type { SpeakingSession, Topic } from "@/types";

const PREP_SECONDS = 10;
const MAX_SECONDS = 120;

interface RecognitionEvent { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null;
}

function Hints({ hints, compact = false }: { hints: string[]; compact?: boolean }) {
  const t = useT();
  if (hints.length === 0) return null;
  return (
    <div className={`rounded-xl border border-indigo-200 bg-indigo-50 text-left dark:border-indigo-900 dark:bg-indigo-950/50 ${compact ? "p-3 text-sm" : "p-4"}`}>
      <p className="mb-2 font-semibold text-indigo-900 dark:text-indigo-200">💡 {t("Gợi ý: bạn có thể trả lời các câu hỏi sau")}</p>
      <ul className="list-disc space-y-1 pl-5 text-slate-800 dark:text-slate-200">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
    </div>
  );
}

function Result({ s, audioUrl }: { s: SpeakingSession; audioUrl?: string | null }) {
  const t = useT();
  return (
    <Card className="space-y-4">
      <p className="font-semibold">{s.topic_title}</p>
      {s.xp_awarded ? <p className="text-sm text-green-600">+{s.xp_awarded} XP</p> : null}
      {audioUrl && <audio controls src={audioUrl} className="w-full" />}
      {s.metrics && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><p className="text-xl font-bold">{s.metrics.duration}s</p>{t("Thời lượng")}</div>
          <div><p className="text-xl font-bold">{s.metrics.word_count}</p>{t("Số từ")}</div>
          <div><p className="text-xl font-bold">{s.metrics.words_per_minute ?? "–"}</p>{t("Từ/phút")}</div>
        </div>
      )}
      <div>
        <p className="text-sm font-medium">{t("Bản ghi chữ (transcript)")}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {s.transcript || (s.ai_status === "not_configured" ? t("Chưa có bản ghi chữ. Bật AI local (AI_PROVIDER=local) để tự động chuyển giọng nói thành chữ.") : t("Không có bản ghi chữ cho bài nói này."))}
        </p>
      </div>
      <SpeakingEvaluation ev={s.evaluation} status={s.ai_status} />
    </Card>
  );
}

function Speaking() {
  const t = useT();
  const topics = useGet<Topic[]>("/speaking/topics");
  const create = useSend<SpeakingSession, { topic_id: string }>("POST", "/speaking/sessions");
  const upload = useSend<SpeakingSession, { id: string; fd: FormData }>("POST", (v) => `/speaking/sessions/${v.id}/audio`, ["/speaking/sessions", "/leaderboard", "/activity"], (v) => v.fd);

  const [phase, setPhase] = useState<"pick" | "prep" | "recording" | "uploading" | "done">("pick");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [count, setCount] = useState(PREP_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SpeakingSession | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<unknown>(null);
  const sessionId = useRef("");
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const keepListening = useRef(false);
  const finalText = useRef("");
  const interimText = useRef("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function choose(tp: Topic) {
    setError(null);
    try {
      const r = await create.mutateAsync({ topic_id: tp.id });
      sessionId.current = r.data.id;
      setTopic(tp); setCount(PREP_SECONDS); setPhase("prep");
      let left = PREP_SECONDS;
      timer.current = setInterval(() => {
        left -= 1; setCount(left);
        if (left <= 0) { if (timer.current) clearInterval(timer.current); void beginRecording(); }
      }, 1000);
    } catch (e) { setError(e); }
  }

  async function beginRecording() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(media);
      const rec = new MediaRecorder(media);
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      finalText.current = ""; interimText.current = "";

      let resolveEnd: () => void = () => undefined;
      const recognitionEnded = new Promise<void>((res) => { resolveEnd = res; });

      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        media.getTracks().forEach((tr) => tr.stop());
        setStream(null);
        setPhase("uploading");
        void (async () => {
          // The browser recogniser delivers its last words AFTER stop(): wait for it (max 2 s) before reading the transcript.
          await Promise.race([recognitionEnded, new Promise((r) => setTimeout(r, 2000))]);
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, "speech");
          fd.append("transcript", `${finalText.current} ${interimText.current}`.trim()); // only a fallback: the server transcribes the audio itself when local AI is on
          fd.append("duration", String((Date.now() - startedAt) / 1000));
          setAudioUrl(URL.createObjectURL(blob));
          upload.mutate({ id: sessionId.current, fd }, {
            onSuccess: (r) => { setResult(r.data); setPhase("done"); },
            onError: (e) => { setError(e); setPhase("pick"); },
          });
        })();
      };

      const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = "en-US"; r.continuous = true; r.interimResults = true;
        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const x = e.results[i];
            if (!x) continue;
            if (x.isFinal) finalText.current += `${x[0].transcript} `; else interim += x[0].transcript;
          }
          interimText.current = interim;
        };
        r.onerror = () => undefined;
        r.onend = () => { // Chrome stops after a silence: keep listening until the user stops the recording
          if (keepListening.current) { try { r.start(); } catch { resolveEnd(); } } else resolveEnd();
        };
        keepListening.current = true;
        try { r.start(); recognition.current = r; } catch { resolveEnd(); }
      } else resolveEnd();

      rec.start();
      recorder.current = rec;
      setElapsed(0); setPhase("recording");
      timer.current = setInterval(() => setElapsed((s) => { if (s + 1 >= MAX_SECONDS) stop(); return s + 1; }), 1000);
    } catch {
      setError(new Error(t("Không truy cập được micro. Hãy cấp quyền micro cho trình duyệt."))); setPhase("pick");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    keepListening.current = false;
    recognition.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  if (phase === "prep" || phase === "recording" || phase === "uploading") {
    return (
      <Card className="space-y-4 text-center">
        <p className="text-sm text-slate-500">{t("Chủ đề:")} {topic?.title}</p>
        <p className="text-xl font-semibold">{topic?.prompt}</p>
        {phase === "prep" && <p className="text-4xl font-bold">{t("Chuẩn bị:")} 00:{String(Math.max(count, 0)).padStart(2, "0")}</p>}
        {phase === "recording" && (<>
          <AudioWave stream={stream} />
          <p className="text-2xl font-bold text-red-600"><span className="mr-1 animate-pulse">●</span>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</p>
          <Button variant="danger" onClick={stop}>{t("Dừng và gửi")}</Button>
        </>)}
        {phase === "uploading" && (
          <div className="space-y-3 p-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm text-slate-500">{t("Đang phân tích bài nói... Lần đầu chạy AI local có thể mất vài chục giây.")}</p>
          </div>
        )}
        {phase !== "uploading" && <Hints hints={topic?.hints ?? []} compact={phase === "recording"} />}
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {error != null && <ErrorBox error={error} />}
      {phase === "done" && result && (<div className="space-y-3"><Result s={result} audioUrl={audioUrl} /><Button onClick={() => { setPhase("pick"); setResult(null); }}>{t("Luyện chủ đề khác")}</Button></div>)}
      {phase === "pick" && (
        <section>
          <h2 className="mb-2 font-semibold">{t("Chọn chủ đề")}</h2>
          {topics.isLoading ? <Spinner /> : (topics.data?.data.length ?? 0) === 0 ? <Empty>{t("Chưa có chủ đề. Hãy chạy seed.")}</Empty> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {topics.data?.data.map((tp) => (
                <Card key={tp.id} className="space-y-1">
                  <p className="font-semibold">{tp.title} <span className="text-xs text-slate-500">({tp.level})</span></p>
                  <p className="text-sm text-slate-500">{tp.prompt}</p>
                  {tp.hints && <p className="text-xs text-indigo-600 dark:text-indigo-400">💡 {t("{n} câu hỏi gợi ý", { n: tp.hints.length })}</p>}
                  <Button disabled={create.isPending} onClick={() => choose(tp)}>{t("Bắt đầu")}</Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
      <section>
        <h2 className="mb-2 font-semibold">{t("Lịch sử luyện nói")}</h2>
        <SpeakingHistory />
      </section>
    </div>
  );
}

export default function SpeakingPage() {
  const t = useT();
  return <Protected><Page title={t("Luyện nói")}><Speaking /></Page></Protected>;
}
