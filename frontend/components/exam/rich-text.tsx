import type { ReactNode } from "react";

/** Renders the <u>, <b> and <i> markers produced by the exam parser, without dangerouslySetInnerHTML. */
export function RichText({ text }: { text: string }) {
  let u = false, b = false, i = false;
  const out: ReactNode[] = [];
  text.split(/(<\/?[ubi]>)/g).forEach((part, idx) => {
    const m = part.match(/^<(\/?)([ubi])>$/);
    if (m) {
      const on = m[1] === "";
      if (m[2] === "u") u = on; else if (m[2] === "b") b = on; else i = on;
      return;
    }
    if (part) out.push(<span key={idx} className={`${u ? "underline" : ""} ${b ? "font-bold" : ""} ${i ? "italic" : ""}`}>{part}</span>);
  });
  return <>{out}</>;
}
