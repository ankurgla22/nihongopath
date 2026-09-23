/**
 * Official JLPT pages that the site's exam facts (levels, section times, pass marks, dates)
 * are taken from. Rendered as visible "Sources" lists and as schema.org `citation`, so both
 * readers and machines can trace a claim back to the Japan Foundation / JEES pages.
 *
 * Verified reachable on 2026-09-23. Numbers on the site were checked against these pages then.
 */
export const JLPT_SOURCES = [
  {
    name: "N1–N5: Summary of Linguistic Competence Required for Each Level",
    url: "https://www.jlpt.jp/e/about/levelsummary.html",
    covers: "what each level certifies",
  },
  {
    name: "Composition of Test Sections and Items",
    url: "https://www.jlpt.jp/e/guideline/testsections.html",
    covers: "test sections and time limits per level",
  },
  {
    name: "Scoring Sections, Pass or Fail, Score Report",
    url: "https://www.jlpt.jp/e/guideline/results.html",
    covers: "pass marks and sectional minimums",
  },
  {
    name: "JLPT FAQ",
    url: "https://www.jlpt.jp/e/faq/index.html",
    covers: "test months, speaking and writing, certificate validity, vocabulary lists",
  },
] as const;

export const JLPT_SOURCES_CHECKED = "2026-09-23";

/** Official per-level facts, transcribed from the pages above. Do not edit without re-checking. */
export const JLPT_OFFICIAL = {
  n5: { passMark: 80, sections: [{ name: "Vocabulary", min: 20 }, { name: "Grammar and reading", min: 40 }, { name: "Listening", min: 30 }], total: 90, sectional: "38 / 120 in vocabulary, grammar and reading combined, and 19 / 60 in listening" },
  n4: { passMark: 90, sections: [{ name: "Vocabulary", min: 25 }, { name: "Grammar and reading", min: 55 }, { name: "Listening", min: 35 }], total: 115, sectional: "38 / 120 in vocabulary, grammar and reading combined, and 19 / 60 in listening" },
  n3: { passMark: 95, sections: [{ name: "Vocabulary", min: 30 }, { name: "Grammar and reading", min: 70 }, { name: "Listening", min: 40 }], total: 140, sectional: "19 / 60 in each of vocabulary and grammar, reading, and listening" },
  n2: { passMark: 90, sections: [{ name: "Vocabulary, grammar and reading", min: 105 }, { name: "Listening", min: 50 }], total: 155, sectional: "19 / 60 in each of vocabulary and grammar, reading, and listening" },
  n1: { passMark: 100, sections: [{ name: "Vocabulary, grammar and reading", min: 110 }, { name: "Listening", min: 55 }], total: 165, sectional: "19 / 60 in each of vocabulary and grammar, reading, and listening" },
} as const;
