"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import type { ChatMessage, ChatSession } from "@/types";
import { ErrorBox, Spinner, inputCls } from "@/components/ui";

function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [active, setActive] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [text, setText] = useState("");
  const sessions = useGet<ChatSession[]>(user ? "/chat/sessions" : null);
  const messages = useGet<ChatMessage[]>(user && active ? `/chat/sessions/${active}/messages` : null);
  const create = useSend<ChatSession, { title: string }>("POST", "/chat/sessions", ["/chat/sessions"]);
  const send = useSend<unknown, { id: string; content: string }>("POST", (v) => `/chat/sessions/${v.id}/messages`, ["/chat/sessions"], (v) => ({ content: v.content }));
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data, send.isPending]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    let id = active;
    if (!id) { id = (await create.mutateAsync({ title: "" })).data.id; setActive(id); }
    setText("");
    send.mutate({ id, content });
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-t-2xl bg-indigo-600 px-4 py-3 text-white">
        <div>
          <p className="font-semibold">{t("Trợ lý tiếng Anh")}</p>
          <p className="text-xs opacity-80">{t("Hỏi về ngữ pháp, từ vựng, động từ bất quy tắc")}</p>
        </div>
        <div className="flex gap-1">
          {user && <button onClick={() => setShowList(!showList)} title={t("Lịch sử")} className="rounded px-2 py-1 hover:bg-white/20">☰</button>}
          {user && <button onClick={() => { setActive(null); setShowList(false); }} title={t("Cuộc trò chuyện mới")} className="rounded px-2 py-1 hover:bg-white/20">＋</button>}
          <button onClick={onClose} aria-label={t("Đóng")} className="rounded px-2 py-1 hover:bg-white/20">✕</button>
        </div>
      </div>

      {!user ? (
        <p className="p-6 text-center text-sm">
          {t("Vui lòng")} <Link href="/login" onClick={onClose} className="text-indigo-600 underline">{t("đăng nhập")}</Link> {t("để chat với trợ lý.")}
        </p>
      ) : showList ? (
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {sessions.isLoading && <Spinner />}
          {sessions.data?.data.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{t("Chưa có cuộc trò chuyện nào.")}</p>}
          {sessions.data?.data.map((s) => (
            <button key={s.id} onClick={() => { setActive(s.id); setShowList(false); }}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${active === s.id ? "bg-indigo-100 dark:bg-indigo-950" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{s.title}</button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!active && (
              <div className="space-y-2 text-center text-sm text-slate-500">
                <p>{t("Thử hỏi:")}</p>
                {["Present Perfect", "abandon", "go"].map((s) => (
                  <button key={s} onClick={() => setText(s)} className="mx-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">{s}</button>
                ))}
              </div>
            )}
            {messages.data?.data.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <div className={`inline-block max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}>{m.content}</div>
                {m.sources && m.sources.length > 0 && <p className="mt-1 text-xs text-slate-500">{t("Nguồn:")} {m.sources.map((s) => s.title).join(", ")}</p>}
              </div>
            ))}
            {send.isPending && <p className="text-sm text-slate-500">{t("Đang trả lời...")}</p>}
            <div ref={bottom} />
          </div>
          {(send.error || create.error) && <div className="px-3"><ErrorBox error={send.error ?? create.error} /></div>}
          <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
            <input className={inputCls} placeholder={t("Nhập câu hỏi...")} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" disabled={send.isPending || create.isPending} className="rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50" aria-label={t("Gửi")}>➤</button>
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
          className="animate-modal fixed bottom-20 right-4 z-40 flex h-[min(560px,72vh)] w-[min(380px,calc(100vw-2rem))] flex-col rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
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
