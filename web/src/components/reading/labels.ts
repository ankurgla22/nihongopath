import type { ReadingPassage } from "@/lib/content/schemas";

export const READING_KIND_LABEL: Record<ReadingPassage["kind"], { ja: string; en: string; hint: string }> = {
  short: { ja: "短文", en: "Short passages", hint: "About 200 characters, one question each. Find the main point fast." },
  medium: { ja: "中文", en: "Medium passages", hint: "About 500 characters, usually three questions. Track the topic and the author's opinion." },
  long: { ja: "長文", en: "Long passages", hint: "About 900 characters, four questions. Structure matters: intro, argument, conclusion." },
  integrated: { ja: "統合理解", en: "Integrated comprehension", hint: "Two texts (A and B) on the same theme. Compare their positions." },
  info: { ja: "情報検索", en: "Information retrieval", hint: "Notices, timetables, adverts. Read the question first, then scan for the condition." },
};

export const READING_KIND_ORDER: ReadingPassage["kind"][] = ["short", "medium", "long", "integrated", "info"];

export function fmtMinutes(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
