"use client";

import { useRef, useState, type ReactNode } from "react";

const THRESHOLD = 70; // px of horizontal drag that counts as a swipe
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Drag or swipe its content to the left (next) or right (previous). Works with touch, pen and mouse; vertical scrolling still works.
 *  While dragging the card follows the finger and tilts; past the threshold it flies out, `onSwipe` runs (it may be async) and the
 *  next card slides in from the other side. Where there is nothing further the card only rubber-bands back. A drag never counts as a click. */
export function Swipeable({ children, canPrev, canNext, onSwipe }: { children: ReactNode; canPrev: boolean; canNext: boolean; onSwipe: (dir: "next" | "prev") => void | Promise<void> }) {
  const [dx, setDx] = useState(0);
  const [mode, setMode] = useState<"idle" | "drag" | "leave" | "enter">("idle");
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const locked = useRef(false); // the gesture has been recognised as horizontal
  const dragged = useRef(false);
  const allowed = (d: number) => (d < 0 ? canNext : canPrev);

  const down = (e: React.PointerEvent) => {
    if (mode !== "idle" || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    locked.current = false; dragged.current = false;
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (!locked.current) {
      if (Math.abs(ddx) < 10 || Math.abs(ddx) < Math.abs(ddy) * 1.3) return; // not (yet) a horizontal drag: let the page scroll
      locked.current = true; dragged.current = true; setMode("drag");
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDx(allowed(ddx) ? ddx : ddx * 0.25); // rubber band at the first / last card
  };
  const end = async () => {
    const wasDragging = start.current !== null && locked.current;
    start.current = null; locked.current = false;
    if (!wasDragging) return;
    const w = box.current?.clientWidth ?? 360, d = dx;
    if (Math.abs(d) > THRESHOLD && allowed(d)) {
      setMode("leave"); setDx(d < 0 ? -w : w);
      await sleep(190);
      await onSwipe(d < 0 ? "next" : "prev");
      setMode("enter"); setDx(d < 0 ? w * 0.6 : -w * 0.6); // jump (no transition) to the opposite side …
      await frame();
      setMode("idle"); setDx(0);                            // … and glide into place
    } else { setMode("idle"); setDx(0); }
  };

  const w = box.current?.clientWidth ?? 360;
  return (
    <div ref={box} className="relative touch-pan-y select-none" onPointerDown={down} onPointerMove={move} onPointerUp={() => void end()} onPointerCancel={() => void end()}
      onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } }}>
      <div style={{ transform: `translateX(${dx}px) rotate(${dx / 24}deg)`, opacity: 1 - Math.min(Math.abs(dx) / (w * 1.5), 0.6), transition: mode === "drag" || mode === "enter" ? "none" : "transform 0.2s ease-out, opacity 0.2s ease-out" }}>
        {children}
      </div>
    </div>
  );
}
