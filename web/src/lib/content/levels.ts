/**
 * JLPT levels, kept free of zod so client bundles that only need the level list (study helpers,
 * lesson quizzes) do not pull the schema library in.
 */
export type Level = "n5" | "n4" | "n3" | "n2" | "n1";
export const LEVELS: Level[] = ["n5", "n4", "n3", "n2", "n1"];

export const LEVEL_LABEL: Record<Level, string> = { n5: "N5", n4: "N4", n3: "N3", n2: "N2", n1: "N1" };
