import type { Config } from "tailwindcss";

/** Every colour is a CSS variable (see app/globals.css) holding "R G B" channels, so utilities like bg-primary/20 still work
 *  and the whole palette switches with the theme (light / dark / system) without touching a single component. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        surface: { DEFAULT: token("surface"), secondary: token("surface-secondary") },
        foreground: token("foreground"),
        muted: { foreground: token("muted-foreground") },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        overlay: token("overlay"),
        primary: { DEFAULT: token("primary"), hover: token("primary-hover"), foreground: token("primary-foreground"), soft: token("primary-soft"), text: token("primary-text") },
        secondary: { DEFAULT: token("secondary"), hover: token("secondary-hover"), foreground: token("secondary-foreground"), soft: token("secondary-soft"), text: token("secondary-text") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground"), soft: token("accent-soft"), text: token("accent-text") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground"), soft: token("success-soft"), text: token("success-text") },
        error: { DEFAULT: token("error"), foreground: token("error-foreground"), soft: token("error-soft"), text: token("error-text") },
      },
      borderColor: { DEFAULT: token("border") },
      ringColor: { DEFAULT: token("ring") },
      fontFamily: { sans: ["var(--font-nunito)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      borderRadius: { btn: "12px", card: "18px" },
      boxShadow: { soft: "var(--shadow)", hover: "var(--shadow-hover)", raised: "var(--shadow-raised)", "raised-hover": "var(--shadow-raised-hover)" },
    },
  },
  plugins: [],
};
export default config;
