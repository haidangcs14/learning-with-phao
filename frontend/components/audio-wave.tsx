"use client";

import { useEffect, useRef } from "react";

/** Live waveform of the microphone stream (Web Audio AnalyserNode drawn on a canvas). */
export function AudioWave({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!stream || !canvas) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const g = canvas.getContext("2d");
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!g) return;
      analyser.getByteFrequencyData(data);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const bars = Math.max(16, Math.floor(w / 9));
      const step = w / bars;
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#6366f1"); grad.addColorStop(1, "#ec4899");
      g.fillStyle = grad;
      for (let i = 0; i < bars; i++) {
        const v = (data[Math.floor((i / bars) * data.length * 0.8)] ?? 0) / 255; // voice lives in the lower bins
        const bh = Math.max(4, v * h);
        const x = i * step + step * 0.15;
        const bw = step * 0.7;
        g.beginPath();
        g.roundRect(x, (h - bh) / 2, bw, bh, bw / 2); // mirrored around the centre line
        g.fill();
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); source.disconnect(); void ctx.close(); };
  }, [stream]);

  return <canvas ref={ref} className="h-24 w-full" aria-hidden="true" />;
}
