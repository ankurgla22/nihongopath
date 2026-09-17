/**
 * Generates the 180-day N2 curriculum from the real content JSON.
 * Run: npm run gen:curriculum   (writes content/curriculum/curriculum.json)
 *
 * Pacing follows study-materials/00-master-plan/master-schedule.md mapped onto
 * 180 days and the 6 phases from tasks.md §18. Task minutes follow §16
 * (grammar 25, vocab 20, kanji 15, reading 20, listening 20, review 15, quiz 10 = 125).
 */
import fs from "node:fs";
import path from "node:path";
import {
  CurriculumSchema,
  type Curriculum,
  type CurriculumDay,
  type Level,
} from "../src/lib/content/schemas";

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(CONTENT, "curriculum", "curriculum.json");

type Task = CurriculumDay["tasks"][number];
type Grammar = { id: string; title: string; order: number };
type Vocab = { id: string; order: number };
type Kanji = { id: string; character: string; day: number };

const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(CONTENT, rel), "utf8"));

const LEVELS: Level[] = ["n5", "n4", "n3", "n2"];
const grammar = {} as Record<Level, Grammar[]>;
const vocab = {} as Record<Level, Vocab[]>;
const kanji = {} as Record<Level, Kanji[]>;
const kanjiDays = {} as Record<Level, number>;
for (const l of LEVELS) {
  grammar[l] = readJson<Grammar[]>(`${l}/grammar-base.json`).sort((a, b) => a.order - b.order);
  vocab[l] = readJson<Vocab[]>(`${l}/vocabulary.json`).sort((a, b) => a.order - b.order);
  kanji[l] = readJson<Kanji[]>(`${l}/kanji.json`);
  kanjiDays[l] = Math.max(...kanji[l].map((k) => k.day));
}

// Reference ids owned by other generators (reading / listening / exams).
const READING: Record<string, string[]> = {
  n4: [1, 2, 3, 4].map((n) => `n4-reading-${n}`),
  n3: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `n3-reading-${n}`),
  n2Short: [1, 2, 3, 4, 5, 6].map((n) => `n2-reading-${n}`),
  n2Long: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => `n2-reading-${n}`),
  n2All: Array.from({ length: 16 }, (_, i) => `n2-reading-${i + 1}`),
};
const LISTENING = Array.from({ length: 30 }, (_, i) => `n2-listening-${i + 1}`);
const MOCK_EXAM_ID = "n2-mock-a";
const MOCK_DAYS = new Set([150, 170, 178]);

const MIN = { grammar: 25, vocabulary: 20, kanji: 15, reading: 20, listening: 20, review: 15, quiz: 10 };

const PHASES: Curriculum["phases"] = [
  { id: 1, name: "Foundation", description: "Kana, N5 grammar, 700 N5 words and the 103 N5 kanji. Build daily study habits.", startDay: 1, endDay: 30 },
  { id: 2, name: "Intermediate", description: "All N4 grammar including keigo basics, 900 N4 words, 148 N4 kanji, first graded reading passages.", startDay: 31, endDay: 60 },
  { id: 3, name: "N3 → N2 Transition", description: "N3 grammar, 1,500 N3 words and 369 N3 kanji. Start exam-style reading and listening.", startDay: 61, endDay: 90 },
  { id: 4, name: "N2 Core", description: "All 200 N2 grammar points, 1,800 N2 words and 387 N2 kanji with short-passage reading and listening drills.", startDay: 91, endDay: 135 },
  { id: 5, name: "N2 Intensive", description: "Second pass over N2 grammar and vocabulary, medium/long/integrated reading, full listening rotation, first mock exam.", startDay: 136, endDay: 165 },
  { id: 6, name: "Exam Preparation", description: "Weak-point review, timed passages, confusable pairs, contractions, two mock exams and the final phase test.", startDay: 166, endDay: 180 },
];

/** Split arr into n contiguous, near-equal chunks (first chunks get the remainder). */
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  const base = Math.floor(arr.length / n);
  let rem = arr.length % n;
  let i = 0;
  for (let c = 0; c < n; c++) {
    const size = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    out.push(arr.slice(i, i + size));
    i += size;
  }
  return out;
}

/** Map slot index (0-based of total) proportionally onto kanji day 1..maxDay. */
const kanjiDayFor = (slot: number, total: number, maxDay: number) =>
  Math.min(maxDay, Math.floor((slot / total) * maxDay) + 1);

/** "〜ようと思う / 〜ようと思っている \"I think I will\"" -> "〜ようと思う / 〜ようと思っている" */
function pattern(g: Grammar): string {
  const p = g.title.split(/ ["“]/)[0].trim();
  return p.length > 28 ? p.slice(0, 27) + "…" : p;
}

const LEVEL_NAME: Record<Level, string> = { n5: "N5", n4: "N4", n3: "N3", n2: "N2", n1: "N1" };

/**
 * Phase 1, days 1–8: foundation lessons (content/foundation/*.json, ids foundation-1..8) before the
 * N5 material. `kana` lists [lessonId, minutes]; `quiz` is the kana-quiz question count.
 */
type FoundationDay = { title: string; objectives: string[]; kana: [string, number][]; quiz?: number };
const FOUNDATION_DAYS: Record<number, FoundationDay> = {
  1: {
    title: "Hiragana: the basic 46",
    objectives: ["Learn the 46 basic hiragana (あ〜ん) row by row; say each sound aloud and trace it", "Pronunciation basics: the five vowels, mora timing and pitch", "Kana recognition quiz (15 questions)"],
    kana: [["foundation-1", 40], ["foundation-5", 15]],
    quiz: 15,
  },
  2: {
    title: "Hiragana: dakuten, combinations and long vowels",
    objectives: ["Learn dakuten/handakuten (が・ざ・だ・ば・ぱ), yōon (きゃ・しゅ・ちょ…), small っ and long vowels", "Read short hiragana words and a 100-character hiragana passage aloud", "Kana recognition quiz (15 questions)"],
    kana: [["foundation-2", 45]],
    quiz: 15,
  },
  3: {
    title: "Katakana: the basic 46",
    objectives: ["Learn the 46 basic katakana (ア〜ン); distinguish look-alikes シ/ツ, ソ/ン", "Recognize common loanwords (コーヒー, テレビ…)", "Kana recognition quiz (15 questions)"],
    kana: [["foundation-3", 45]],
    quiz: 15,
  },
  4: {
    title: "Katakana: dakuten, combinations and the long-vowel mark",
    objectives: ["Learn katakana dakuten, yōon and the long-vowel mark ー", "Read 30 katakana loanwords aloud", "Kana recognition quiz (15 questions)"],
    kana: [["foundation-4", 45]],
    quiz: 15,
  },
  5: {
    title: "Numbers & counters + first N5 grammar",
    objectives: ["Numbers 1–10,000 and the basic counters (つ・人・本・枚・円)"],
    kana: [["foundation-6", 25]],
  },
  6: {
    title: "Dates & time + N5 grammar",
    objectives: ["Days of the week, dates, months and telling the time"],
    kana: [["foundation-7", 25]],
  },
  7: {
    title: "Greetings & set phrases + week 1 test",
    objectives: ["Daily greetings and classroom/set phrases (おはようございます, すみません, お願いします…)"],
    kana: [["foundation-8", 20]],
  },
};
/** Days with a foundation lesson that also carry N5 grammar/vocabulary. */
const FOUNDATION_MIXED_MIN = { grammar: 25, vocabulary: 15, reading: 15, listening: 15, review: 10, quiz: 10 };
const N5_VOCAB_SMALL_DAYS = [5, 6, 7, 8, 9, 10];
const N5_VOCAB_SMALL = 15;
const N5_GRAMMAR_INTRO_DAYS = [5, 6, 7];
const N5_GRAMMAR_INTRO = 2;
const N5_KANJI_START_DAY = 8;
const N5_GRAMMAR_START_DAY = 5;
const N5_VOCAB_START_DAY = 5;

function buildPhase(phase: Curriculum["phases"][number]): CurriculumDay[] {
  const days: CurriculumDay[] = [];
  const total = phase.endDay - phase.startDay + 1;
  const level: Level = (["n5", "n4", "n3", "n2", "n2", "n2"] as Level[])[phase.id - 1];
  const L = LEVEL_NAME[level];

  // Content days: every day except the phase-test day carries new material.
  const contentDays = total - 1;
  const grammarStart = phase.id === 1 ? N5_GRAMMAR_START_DAY - 1 : 0; // phase 1: days 1–4 are kana only
  const kanjiStart = phase.id === 1 ? N5_KANJI_START_DAY - 1 : 0; // phase 1: kanji starts on day 8
  const vocabStart = phase.id === 1 ? N5_VOCAB_START_DAY - 1 : 0;

  // Grammar / vocab slices.
  let grammarChunks: Grammar[][];
  let vocabChunks: Vocab[][];
  if (phase.id === 1) {
    // Grammar: 2 patterns/day on the intro days, the rest spread over the remaining content days.
    const introG = N5_GRAMMAR_INTRO_DAYS.length * N5_GRAMMAR_INTRO;
    grammarChunks = [
      ...chunk(grammar[level].slice(0, introG), N5_GRAMMAR_INTRO_DAYS.length),
      ...chunk(grammar[level].slice(introG), contentDays - grammarStart - N5_GRAMMAR_INTRO_DAYS.length),
    ];
    // Vocabulary: 15 words/day on days 5–10, then ramp to a normal load.
    const smallV = N5_VOCAB_SMALL_DAYS.length * N5_VOCAB_SMALL;
    vocabChunks = [
      ...chunk(vocab[level].slice(0, smallV), N5_VOCAB_SMALL_DAYS.length),
      ...chunk(vocab[level].slice(smallV), contentDays - vocabStart - N5_VOCAB_SMALL_DAYS.length),
    ];
  } else if (phase.id <= 4) {
    grammarChunks = chunk(grammar[level], contentDays - grammarStart);
    vocabChunks = chunk(vocab[level], contentDays);
  } else {
    // Phases 5–6: second pass over N2, 5 grammar / 40 vocab per day, continuing across phases.
    const offset = phase.id === 5 ? 0 : (PHASES[4].endDay - PHASES[4].startDay) * 1;
    grammarChunks = [];
    vocabChunks = [];
    for (let i = 0; i < contentDays; i++) {
      const gi = ((offset + i) * 5) % grammar.n2.length;
      grammarChunks.push(Array.from({ length: 5 }, (_, k) => grammar.n2[(gi + k) % grammar.n2.length]));
      const vi = ((offset + i) * 40) % vocab.n2.length;
      vocabChunks.push(Array.from({ length: 40 }, (_, k) => vocab.n2[(vi + k) % vocab.n2.length]));
    }
  }

  const readingPool =
    phase.id === 2 ? READING.n4 : phase.id === 3 ? READING.n3 : phase.id === 4 ? READING.n2Short : phase.id === 5 ? READING.n2Long : phase.id === 6 ? READING.n2All : [];
  const listeningOffset = phase.id >= 3 ? [0, 0, 0, 30, 75, 105][phase.id - 1] : 0;

  for (let i = 0; i < total; i++) {
    const day = phase.startDay + i;
    const isLast = i === total - 1;
    const isWeekly = day % 7 === 0 && !isLast;
    const isMock = MOCK_DAYS.has(day);
    const tasks: Task[] = [];
    const objectives: string[] = [];
    let title = "";

    const fd = phase.id === 1 ? FOUNDATION_DAYS[day] : undefined;
    const mixed = Boolean(fd && day >= N5_GRAMMAR_START_DAY);
    const M = mixed ? { ...MIN, ...FOUNDATION_MIXED_MIN } : MIN;
    if (fd) {
      title = fd.title;
      objectives.push(...fd.objectives);
      for (const [id, minutes] of fd.kana) tasks.push({ type: "kana", minutes, contentIds: [id] });
    }

    // Grammar
    const g = !isLast && i >= grammarStart ? grammarChunks[i - grammarStart] ?? [] : [];
    if (g.length) {
      tasks.push({ type: "grammar", minutes: M.grammar, contentIds: g.map((x) => x.id) });
      const pats = g.map(pattern);
      if (!title) title = `${L} grammar: ${pats.slice(0, 2).join(" · ")}`;
      objectives.push(`${phase.id >= 5 ? "Re-study" : "Learn"} ${L} grammar ${g[0].order}–${g[g.length - 1].order}: ${pats.join(", ")}`);
    }

    // Vocabulary
    const v = !isLast && i >= vocabStart ? vocabChunks[i - vocabStart] ?? [] : [];
    if (v.length) {
      tasks.push({ type: "vocabulary", minutes: M.vocabulary, contentIds: v.map((x) => x.id) });
      objectives.push(`${phase.id >= 5 ? "Review" : "Learn"} ${L} vocabulary #${v[0].order}–${v[v.length - 1].order} (${v.length} words)`);
    }

    // Kanji
    if (!isLast && i >= kanjiStart) {
      const slot = i - kanjiStart;
      const slots = contentDays - kanjiStart;
      // Phase 1: one kanji day (~10 kanji) per calendar day so all 103 N5 kanji finish early, then a review pass.
      const firstPass = phase.id !== 1 || slot < kanjiDays[level];
      const kd = phase.id === 1 ? (slot % kanjiDays[level]) + 1 : kanjiDayFor(slot, slots, kanjiDays[level]);
      const ks = kanji[level].filter((k) => k.day === kd);
      tasks.push({ type: "kanji", minutes: MIN.kanji, contentIds: ks.map((k) => k.id) });
      objectives.push(`${firstPass ? "" : "Review "}${L} kanji day ${kd}: ${ks.map((k) => k.character).join(" ")}`);
    }

    if (isMock) {
      title = `Mock exam N2-A${day === 150 ? "" : " (retake)"} under full timing`;
      tasks.push({ type: "review", minutes: MIN.review, contentIds: [] });
      tasks.push({ type: "mock-exam", minutes: 155, contentIds: [], examId: MOCK_EXAM_ID });
      objectives.unshift("Sit mock exam N2-A under exam timing (105 min language/reading + 50 min listening)", "Score it and write a weak-point list");
      days.push({ day, phase: phase.id, title: `Day ${day} — ${title}`, objectives: objectives.slice(0, 4), tasks });
      continue;
    }

    // Reading
    if (readingPool.length) {
      const rid = readingPool[i % readingPool.length];
      tasks.push({ type: "reading", minutes: MIN.reading, contentIds: [rid] });
      objectives.push(`Reading passage ${rid.replace(/^n\d-reading-/, (m) => m.slice(0, 2).toUpperCase() + " #")}`);
    } else {
      tasks.push({ type: "reading", minutes: M.reading, contentIds: [] });
      objectives.push(day <= 7 ? "Free reading: kana words and short kana passages" : "Free reading: graded reader / kana-and-kanji passages");
    }

    // Listening
    if (phase.id >= 3) {
      const lid = LISTENING[(listeningOffset + i) % LISTENING.length];
      tasks.push({ type: "listening", minutes: MIN.listening, contentIds: [lid] });
      objectives.push(`Listening exercise #${lid.replace("n2-listening-", "")}: listen, check, read transcript, shadow`);
    } else {
      tasks.push({ type: "listening", minutes: M.listening, contentIds: [] });
      objectives.push(day <= 7 ? "Listening block: kana sounds, greetings and numbers (listen and repeat)" : "Listening block: NHK Easy / beginner audio (30 min, read then listen)");
    }

    // Review + assessment
    if (isLast) {
      title = `Phase ${phase.id} test: ${L} review`;
      tasks.push({ type: "review", minutes: MIN.review, contentIds: [] });
      tasks.push({ type: "phase-test", minutes: 45, contentIds: [], questionCount: 40 });
      objectives.unshift(`Phase ${phase.id} test (40 questions): grammar, vocabulary, kanji, reading, listening`, `Review all ${L} material and write a weak-point list`);
    } else if (isWeekly) {
      tasks.push({ type: "review", minutes: M.review, contentIds: [] });
      tasks.push({ type: "weekly-test", minutes: 25, contentIds: [], questionCount: 25 });
      objectives.push("Weekly test (25 questions) on this week's material");
    } else if (fd && !mixed) {
      // Kana-only days: kana quiz + short review.
      tasks.push({ type: "quiz", minutes: MIN.quiz, contentIds: [], questionCount: fd.quiz ?? 15 });
      tasks.push({ type: "review", minutes: 10, contentIds: [] });
    } else {
      tasks.push({ type: "review", minutes: M.review, contentIds: [] });
      tasks.push({ type: "quiz", minutes: M.quiz, contentIds: [], questionCount: 10 });
    }

    // Trim objectives to 4, keeping the most concrete (tests first, then grammar/vocab/kanji).
    days.push({ day, phase: phase.id, title: `Day ${day} — ${title}`, objectives: objectives.slice(0, 4), tasks });
  }
  return days;
}

const curriculum: Curriculum = { phases: PHASES, days: PHASES.flatMap(buildPhase) };
const parsed = CurriculumSchema.safeParse(curriculum);
if (!parsed.success) {
  console.error(parsed.error.issues.slice(0, 10));
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(parsed.data, null, 2) + "\n", "utf8");

// Summary
for (const p of PHASES) {
  const ds = curriculum.days.filter((d) => d.phase === p.id);
  const sum = (t: string) => new Set(ds.flatMap((d) => d.tasks.filter((x) => x.type === t).flatMap((x) => x.contentIds))).size;
  const mins = ds.map((d) => d.tasks.reduce((a, t) => a + t.minutes, 0));
  console.log(
    `Phase ${p.id} ${p.name} (days ${p.startDay}–${p.endDay}): grammar ${sum("grammar")} ids, vocab ${sum("vocabulary")} ids, kanji ${sum("kanji")} ids, reading ${sum("reading")}, listening ${sum("listening")}, minutes/day ${Math.min(...mins)}–${Math.max(...mins)}`
  );
}
console.log(`Wrote ${curriculum.days.length} days to ${path.relative(ROOT, OUT)}`);
