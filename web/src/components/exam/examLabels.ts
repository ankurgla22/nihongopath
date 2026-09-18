import { LEVELS, LEVEL_LABEL, type Level } from "@/lib/content/levels";
import type { ExamBlueprint } from "@/lib/content/schemas";

type Section = ExamBlueprint["sections"][number];

/** "N5 mock exam A" — English title; the data title ("N5 模擬試験 A") becomes the subtitle. */
export function examTitle(e: Pick<ExamBlueprint, "id" | "level" | "title">): string {
  const m = /-([a-z0-9]+)$/i.exec(e.id);
  const variant = m ? ` ${m[1].toUpperCase()}` : "";
  return `${LEVEL_LABEL[e.level]} mock exam${variant}`;
}

/** English gloss for a section name, e.g. 言語知識（文法） → "Language knowledge (grammar)". */
export function sectionGloss(s: Pick<Section, "name" | "skill">): string {
  const n = s.name;
  if (n.includes("文字") || n.includes("語彙")) return "Language knowledge (vocabulary)";
  if (n.includes("文法")) return n.includes("読解") ? "Language knowledge (grammar) and reading" : "Language knowledge (grammar)";
  if (s.skill === "language") return "Language knowledge";
  if (s.skill === "reading") return "Reading";
  return "Listening";
}

/** Sort exams N5 → N1, then by id (A, B, C). */
export function sortExams<T extends Pick<ExamBlueprint, "id" | "level">>(exams: T[]): T[] {
  return [...exams].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.id.localeCompare(b.id));
}

export function isLevelValue(v: string): v is Level {
  return (LEVELS as string[]).includes(v);
}
