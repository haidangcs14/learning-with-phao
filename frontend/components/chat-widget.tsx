"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useGet, useSend } from "@/hooks/api";
import { apiStream } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import type { ChatMessage, ChatSession } from "@/types";
import { ErrorBox, Spinner, inputCls } from "@/components/ui";

const MODES = [["chat", "Trò chuyện"], ["grammar", "Ngữ pháp"], ["vocab", "Từ vựng"], ["translate", "Dịch"], ["correct", "Sửa bài"]] as const;
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
interface Health { enabled: boolean; reachable: boolean; model_installed: boolean; model: string | null }
interface StreamEvent { type: "token" | "done"; text?: string }

function Status({ h }: { h?: Health }) {
  const t = useT();
  if (!h) return null;
  const [dot, text] = !h.enabled ? ["⚪", t("Chế độ tra cứu bài học (chưa bật AI local)")]
    : !h.reachable ? ["🔴", t("Chưa kết nối được Ollama. Hãy chạy Ollama.")]
    : !h.model_installed ? ["🟠", t("Chưa tải model: ollama pull {m}", { m: h.model ?? "" })] : ["🟢", t("Đang dùng model {m}", { m: h.model ?? "" })];
  return <p className="px-3 pt-1 text-[11px] text-slate-500">{dot} {text}</p>;
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [active, setActive] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("chat");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("B1");
  const [pending, setPending] = useState<{ user: string; assistant: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const abort = useRef<AbortController | null>(null);
  const health = useGet<Health>(user ? "/chat/health" : null);
  const sessions = useGet<ChatSession[]>(user ? "/chat/sessions" : null);
  const messages = useGet<ChatMessage[]>(user && active ? `/chat/sessions/${active}/messages` : null);
  const create = useSend<ChatSession, { title: string }>("POST", "/chat/sessions", ["/chat/sessions"]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data, pending]);
  useEffect(() => { try { const l = localStorage.getItem("chat_level"); if (l && (LEVELS as readonly string[]).includes(l)) setLevel(l as (typeof LEVELS)[number]); } catch { /* ignore */ } }, []);
  useEffect(() => () => abort.current?.abort(), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    let id = active;
    try {
      if (!id) { id = (await create.mutateAsync({ title: "" })).data.id; setActive(id); }
      setText("");
      setPending({ user: content, assistant: "" });
      const ctrl = new AbortController();
      abort.current = ctrl;
      const res = await apiStream(`/chat/sessions/${id}/stream`, { method: "POST", body: JSON.stringify({ content, mode, level }), signal: ctrl.signal });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) { // NDJSON: one event per line; tokens are appended as they arrive
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "token" && ev.text) setPending((p) => (p ? { ...p, assistant: p.assistant + ev.text } : p));
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err);
    } finally {
      abort.current = null;
      setPending(null);
      void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/chat/sessions") });
    }
  }

  const bubble = (role: string) => `inline-block max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`;
  const small = "rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  return (
    <>
      <div className="flex items-center justify-between rounded-t-2xl bg-indigo-600 px-4 py-3 text-white">
        <div><p className="font-semibold">{t("Trợ lý tiếng Anh")}</p><p className="text-xs opacity-80">{t("Hỏi về ngữ pháp, từ vựng, động từ bất quy tắc")}</p></div>
        <div className="flex gap-1">
          {user && <button onClick={() => setShowList(!showList)} title={t("Lịch sử")} className="rounded px-2 py-1 hover:bg-white/20">☰</button>}
          {user && <button onClick={() => { setActive(null); setShowList(false); }} title={t("Cuộc trò chuyện mới")} className="rounded px-2 py-1 hover:bg-white/20">＋</button>}
          <button onClick={onClose} aria-label={t("Đóng")} className="rounded px-2 py-1 hover:bg-white/20">✕</button>
        </div>
      </div>

      {!user ? (
        <p className="p-6 text-center text-sm">{t("Vui lòng")} <Link href="/login" onClick={onClose} className="text-indigo-600 underline">{t("đăng nhập")}</Link> {t("để chat với trợ lý.")}</p>
      ) : showList ? (
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {sessions.isLoading && <Spinner />}
          {sessions.data?.data.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{t("Chưa có cuộc trò chuyện nào.")}</p>}
          {sessions.data?.data.map((s) => (
            <button key={s.id} onClick={() => { setActive(s.id); setShowList(false); }} className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${active === s.id ? "bg-indigo-100 dark:bg-indigo-950" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{s.title}</button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <select className={small} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label={t("Chế độ")}>{MODES.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
            <select className={small} value={level} onChange={(e) => { setLevel(e.target.value as typeof level); try { localStorage.setItem("chat_level", e.target.value); } catch { /* ignore */ } }} aria-label={t("Trình độ")}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
          <Status h={health.data?.data} />
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!active && !pending && (
              <div className="space-y-2 text-center text-sm text-slate-500">
                <p>{t("Thử hỏi:")}</p>
                {["Present Perfect", "abandon", "What is the difference between say and tell?"].map((s) => (
                  <button key={s} onClick={() => setText(s)} className="mx-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">{s}</button>
                ))}
              </div>
            )}
            {messages.data?.data.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <div className={bubble(m.role)}>{m.content}</div>
                {m.sources && m.sources.length > 0 && <p className="mt-1 text-xs text-slate-500">{t("Nguồn:")} {m.sources.map((s) => s.title).join(", ")}</p>}
              </div>
            ))}
            {pending && (
              <>
                <div className="text-right"><div className={bubble("user")}>{pending.user}</div></div>
                <div><div className={bubble("assistant")}>{pending.assistant || <span className="animate-pulse text-slate-500">{t("Đang trả lời...")}</span>}</div></div>
              </>
            )}
            <div ref={bottom} />
          </div>
          {(error != null || create.error) && <div className="px-3"><ErrorBox error={error ?? create.error} /></div>}
          <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
            <input className={inputCls} placeholder={t("Nhập câu hỏi...")} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
            {pending
              ? <button type="button" onClick={() => abort.current?.abort()} className="rounded-lg bg-red-600 px-3 text-white" aria-label={t("Dừng")}>■</button>
              : <button type="submit" disabled={create.isPending} className="rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50" aria-label={t("Gửi")}>➤</button>}
          </form>
        </>
      )}
    </>
  );
}

export function ChatWidget() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => { // the "Chat" key on the home keyboard opens the widget
    const openIt = () => setOpen(true);
    window.addEventListener("open-chat", openIt);
    return () => window.removeEventListener("open-chat", openIt);
  }, []);
  return (
    <>
      {open && (
        <div role="dialog" aria-label={t("Trợ lý tiếng Anh")}
          className="animate-modal fixed bottom-20 right-4 z-40 flex h-[min(600px,76vh)] w-[min(400px,calc(100vw-2rem))] flex-col rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <ChatPanel onClose={() => setOpen(false)} />
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-label={t("Mở chatbot")} aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-indigo-700">
        {open ? "✕" : "💬"}
      </button>
    </>
  );
}
