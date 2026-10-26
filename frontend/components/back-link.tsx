"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export const backButtonClass =
  "group inline-flex items-center gap-2 rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-x-0.5 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:border-indigo-500 dark:hover:bg-indigo-600 dark:hover:text-white";
const arrow =
  "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white transition group-hover:bg-white group-hover:text-indigo-600";
const label = (children: ReactNode) =>
  typeof children === "string" ? children.replace(/^←\s*/, "") : children; // the arrow is drawn by the button

/** Framed, coloured "back" link. Goes back to exactly where the user was (same filters, page and scroll);
 *  falls back to `href` when the page was opened directly. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={backButtonClass}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <span aria-hidden="true" className={arrow}>
        ←
      </span>
      {label(children)}
    </Link>
  );
}

/** Same look, for a "back" that is an action inside the page (no navigation). */
export function BackButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={backButtonClass}>
      <span aria-hidden="true" className={arrow}>
        ←
      </span>
      {label(children)}
    </button>
  );
}
