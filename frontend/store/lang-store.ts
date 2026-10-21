import { create } from "zustand";

export type Lang = "vi" | "en";

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>((set) => ({
  lang: "vi",
  setLang: (lang) => {
    try { localStorage.setItem("lang", lang); } catch { /* storage may be blocked */ }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));
