import type { FoundationLesson } from "@/lib/content/schemas";

export const FOUNDATION_KIND: Record<FoundationLesson["kind"], { label: string; ja: string; tone: "neutral" | "accent" | "ok" | "warn" | "info" }> = {
  hiragana: { label: "Hiragana", ja: "ひらがな", tone: "accent" },
  katakana: { label: "Katakana", ja: "カタカナ", tone: "info" },
  pronunciation: { label: "Pronunciation", ja: "発音", tone: "ok" },
  numbers: { label: "Numbers", ja: "数字", tone: "warn" },
  greetings: { label: "Greetings", ja: "挨拶", tone: "neutral" },
};

export const FOUNDATION_TOTAL_LABEL = "8 lessons · kana, sounds, numbers, greetings";
