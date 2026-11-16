# Design system – Học cùng Phao

**Friendly · Modern · Gamified Education.** Mint Green + White + Cyan + Yellow accent (Light), Mint Green + Slate surfaces (Dark). Typeface: **Nunito**.

## How it works

* Every colour is a CSS variable in `app/globals.css` (`:root` = Light, `.dark` = Dark) stored as `R G B` channels.
* `tailwind.config.ts` exposes them as semantic utilities: `bg-primary`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary/20` (opacity works) …
* **Components never contain colours.** Switching Light / Dark / System only changes the variables, so every page, modal, input and chart follows. `npm run check:tokens` fails if someone adds a palette colour (`bg-slate-100`), a `dark:` colour variant or a hex class.
* Theme engine: `next-themes` (class strategy). Options: **Light / Dark / System**, in the header menu and in *Hồ sơ cá nhân → Giao diện*. *System* follows `prefers-color-scheme` and updates live when the OS changes; a manual choice wins and is stored in `localStorage`. next-themes injects a tiny script before first paint, so there is **no flash** on reload, and `<html suppressHydrationWarning>` avoids hydration warnings.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | #F0FDFA | #0F172A | page |
| `--surface` | #FFFFFF | #1E293B | cards, inputs, modals |
| `--surface-secondary` | #E6F7F2 | #273449 | inset areas, hovers, tracks |
| `--foreground` | #134E4A | #F8FAFC | main text |
| `--muted-foreground` | #64748B | #94A3B8 | secondary text |
| `--border` | #CCEBE3 | #334155 | hairlines, dividers |
| `--input` | #7C8DA3 | #6B7C93 | edge of form controls (≥3:1, WCAG 1.4.11) |
| `--primary` / `-hover` | #10B981 / #059669 | #10B981 / #34D399 | brand, primary buttons |
| `--primary-foreground` | #FFFFFF | #022C22 | text on primary |
| `--primary-soft` / `-text` | #D1FAE5 / #047857 | #143933 / #34D399 | tinted backgrounds / small text and links |
| `--secondary` | #06B6D4 | #22D3EE | cyan highlights |
| `--accent` | #FBBF24 | #FBBF24 | yellow: rewards, hints, XP |
| `--success` | #22C55E | #4ADE80 | correct |
| `--error` | #F87171 | #F87171 | wrong |
| `--ring` | #10B981 | #34D399 | keyboard focus |
| `--shadow*`, `--depth` | soft teal shadow, mint edge | light shadow, dark edge | soft-3D "raised block" |

Each status colour also has `-foreground`, `-soft` (tinted background) and `-text` (readable on surfaces).

## Components

* **Button** (`components/ui.tsx`): 12px radius, 700 weight, 150ms. Hover lifts 1px + stronger shadow, active presses 1px (global `translate` rule, also applied to `.lift` links). `variant`: `primary`, `ghost`, `danger`.
* **Card**: 18px radius, hairline `border-border`, `shadow-raised` (soft shadow + depth edge). `interactive` adds the 2px hover lift. In Dark the depth is mostly surface/border contrast, not heavy shadow.
* **Inputs** (`inputCls`): hover, focus ring, invalid (`aria-invalid`) and disabled states.
* Typography: 400 body, 500 labels, 600 sub-headings, 700 headings/buttons.
* Canvas / three.js drawing reads tokens with `tokenColor("--primary")` (`lib/theme.ts`). Game artwork (wood planks, night sky, Wordle tile colours, brand logos) keeps its own palette on purpose.

## Accessibility

* Visible `:focus-visible` outline on everything interactive; hover/active/disabled states never rely on colour alone.
* `prefers-reduced-motion` switches animations and lifts off.
* Contrast (WCAG): text pairs are ≥ 4.5:1 except **white on `#10B981` = 2.5:1** (white on `#059669` = 3.8:1). The brief asks for white text on the Mint primary in Light mode, so it is used with bold 700 text; for full AA change one line: `--primary-foreground: 2 44 34` in `:root`.
