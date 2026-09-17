import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)" },
        muted: "var(--muted)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)", soft: "var(--accent-soft)", ink: "var(--accent-ink)" },
        ok: { DEFAULT: "var(--ok)", soft: "var(--ok-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        jp: ["var(--font-jp)", "Noto Sans JP", "Hiragino Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        ring: "0 0 0 4px var(--ring)",
      },
      maxWidth: {
        content: "46rem",
        wide: "76rem",
      },
      fontSize: {
        display: ["clamp(2.4rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["clamp(1.9rem, 3.2vw, 2.6rem)", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "700" }],
        h2: ["1.375rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "650" }],
      },
    },
  },
  plugins: [],
};
export default config;
