"use client";

import { useEffect, useRef, useState } from "react";

/** Seconds left until `deadline` (epoch seconds). Uses the server clock so a wrong local clock can't extend the exam. */
export function useCountdown(deadline: number, serverNow: number, onExpire: () => void): number {
  const offset = useRef(serverNow * 1000 - Date.now());
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const fired = useRef(false);
  const [left, setLeft] = useState(() => Math.max(0, Math.round(deadline - serverNow)));
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(deadline - (Date.now() + offset.current) / 1000));
      setLeft(remaining);
      if (remaining <= 0 && !fired.current) { fired.current = true; expire.current(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}
