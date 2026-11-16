#!/usr/bin/env node
/* Guards the design system: components must use the semantic tokens (bg-surface, text-foreground, bg-primary ...)
 * and never hard-code palette colours, dark: colour variants or arbitrary hex classes.
 * Run:  npm run check:tokens   (exit code 1 = violations)                                                      */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components", "lib", "hooks", "store"];
// Artwork with its own palette (3D scenes, canvas games, brand logos): allowed to use literal colours.
const ART = ["components/games/bridge-scene.ts", "components/games/vocab-rain.tsx", "components/games/word-bridge.tsx", "components/games/word-guess.tsx",
  "components/games/demos.tsx", "components/keyboard-hero.tsx", "components/home-hero.tsx", "components/auth-form.tsx", "app/layout.tsx"];

const PALETTE = "slate|gray|zinc|neutral|stone|indigo|blue|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia|purple|violet";
const UTIL = "bg|text|border|ring|ring-offset|from|via|to|divide|outline|fill|stroke|accent|caret|decoration|placeholder|shadow";
const RULES = [
  [new RegExp(`(?<![\\w/.-])(?:[a-z0-9-]+:)*(?:${UTIL})-(?:${PALETTE})-\\d{2,3}(?:/\\d+)?(?![\\w-])`, "g"), "palette colour: use a token (bg-primary, text-muted-foreground, border-border, bg-success-soft ...)"],
  [new RegExp(`(?<![\\w-])dark:(?:[a-z0-9-]+:)*(?:${UTIL})-`, "g"), "dark: colour variant: tokens already change with the theme"],
  [/(?<![\w-])(?:[a-z0-9-]+:)*(?:bg|text|border|from|via|to|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g, "arbitrary hex colour: add or use a token"],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules" && name !== ".next") yield* walk(p); }
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

let bad = 0;
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file);
    if (ART.includes(rel) || rel === "lib/i18n.ts") continue;
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const [re, why] of RULES) {
        re.lastIndex = 0;
        for (const m of line.matchAll(re)) { bad++; console.error(`${rel}:${i + 1}  ${m[0]}  ← ${why}`); }
      }
    });
  }
}
if (bad) { console.error(`\n${bad} hard-coded colour(s) found.`); process.exit(1); }
console.log("✓ design tokens only: no hard-coded colours in components");
