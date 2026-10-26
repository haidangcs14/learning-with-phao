"use client";

import { useEffect, useRef, useState } from "react";

interface YTPlayer {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number; getDuration(): number; setPlaybackRate(rate: number): void; getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[]; destroy(): void;
}
declare global {
  interface Window { YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer }; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => { apiPromise = null; reject(new Error("load failed")); };
      document.head.appendChild(script);
      setTimeout(() => { if (!window.YT?.Player) { apiPromise = null; reject(new Error("timeout")); } }, 15000);
    });
  }
  return apiPromise;
}

// Vietnamese text is the translation key (English in lib/i18n.ts).
const ERRORS: Record<number, string> = {
  2: "Đường dẫn video không hợp lệ.", 5: "Trình duyệt không phát được video này.",
  100: "Video không tồn tại hoặc đang ở chế độ riêng tư.", 101: "Chủ video không cho phép phát video ở trang khác.", 150: "Chủ video không cho phép phát video ở trang khác.",
};

/** Real YouTube player: every value below comes from the player itself, nothing is simulated. */
export function useYouTube(videoId: string) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [rates, setRates] = useState<number[]>([0.5, 0.75, 1, 1.25, 1.5]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    setStatus("loading"); setError(""); setPlaying(false);
    loadApi().then(() => {
      const el = host.current;
      if (cancelled || !el || !window.YT) return;
      el.innerHTML = "";
      const target = document.createElement("div");
      el.appendChild(target);
      const p = new window.YT.Player(target, {
        width: "100%", height: "100%", videoId, host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (cancelled) return;
            player.current = p;
            setStatus("ready"); setDuration(p.getDuration()); setRates(p.getAvailablePlaybackRates());
            timer = setInterval(() => { setTime(p.getCurrentTime()); setDuration(p.getDuration()); }, 250);
          },
          onStateChange: (e: { data: number }) => setPlaying(e.data === 1 || e.data === 3), // playing or buffering
          onPlaybackRateChange: () => setRateState(p.getPlaybackRate()),
          onError: (e: { data: number }) => { setStatus("error"); setError(ERRORS[e.data] ?? "Không phát được video này."); },
        },
      });
    }).catch(() => { if (!cancelled) { setStatus("error"); setError("Không tải được trình phát YouTube. Hãy kiểm tra kết nối mạng hoặc trình chặn quảng cáo."); } });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try { player.current?.destroy(); } catch { /* already gone */ }
      player.current = null;
    };
  }, [videoId]);

  return {
    host, status, error, playing, time, duration, rate, rates, ready: status === "ready",
    play: () => player.current?.playVideo(), pause: () => player.current?.pauseVideo(),
    seek: (seconds: number) => player.current?.seekTo(Math.max(0, seconds), true),
    setRate: (r: number) => { player.current?.setPlaybackRate(r); setRateState(r); },
  };
}
