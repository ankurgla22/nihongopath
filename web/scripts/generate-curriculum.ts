/**
 * Generates the daily curriculum from the real content JSON.
 * Run: npm run gen:curriculum   (writes content/curriculum/curriculum.json)
 *
 * Days 1–180 are the N2 plan from tasks.md §18 (six phases, pacing from
 * study-materials/00-master-plan/master-schedule.md). Days 181–270 continue to N1 in three
 * more phases that mirror the N2 core / intensive / exam-preparation shape. Task minutes
 * follow §16 (grammar 25, vocab 20, kanji 15, reading 20, listening 20, review 15, quiz 10 = 125).
 *
 * Every authored reading passage, listening exercise and kanji set is scheduled at least once:
 * phase 1 doubles up passages on its last week (days 1–7 are kana-only), and kanji sets are
 * spread so that no set is skipped when a phase has fewer content days than sets.
 */
import fs from "node:fs";
import path from "node:path";
import { CurriculumSchema, type Curriculum, type CurriculumDay, type Level } from "../src/lib/content/schemas";

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(CONTENT, "curriculum", "curriculum.json");

type Task = CurriculumDay["tasks"][number];
type Grammar = { id: string; title: string; order: number };
type Vocab = { id: string; order: number };
type Kanji = { id: string; character: string; day: number };
type Exam = { id: string; level: Level; sections: { timeLimitSeconds: number }[] };

const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(CONTENT, rel), "utf8"));

const LEVELS: Level[] = ["n5", "n4", "n3", "n2", "n1"];
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
const exams = fs
  .readdirSync(path.join(CONTENT, "exams"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => {
    const j = readJson<Exam | Exam[]>(`exams/${f}`);
    return Array.isArray(j) ? j : [j];
  });
const examMinutes = (id: string) => Math.round((exams.find((e) => e.id === id)?.sections ?? []).reduce((n, s) => n + s.timeLimitSeconds, 0) / 60);

// Reading / listening pools are read from the content folders so every authored item is scheduled.
function idsIn(level: string, kind: "reading" | "listening", filter?: (item: { kind: string }) => boolean): string[] {
  const dir = path.join(CONTENT, level, kind);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { id: string; order: number; kind: string })
    .filter((x) => !filter || filter(x))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.id);
}

const MIN = { grammar: 25, vocabulary: 20, kanji: 15, reading: 20, listening: 20, review: 15, quiz: 10 };

/**
 * One row per phase. `pass` is "first" (new material spread over the phase), "second" (a
 * rolling re-study of the level: 5 grammar / 40 vocab a day continuing across phases) or
 * "exam" (same as second, with the mock exams). `reading` selects which passages the phase
 * rotates through; `listeningOffset` staggers the rotation so consecutive phases of the same
 * level do not replay the same exercises on the same weekday.
 */
type PhaseCfg = Curriculum["phases"][number] & {
  level: Level;
  pass: "first" | "second" | "exam";
  reading: string[];
  listeningOffset: number;
  mocks: Record<number, string>;
};
const PHASES: PhaseCfg[] = [
  { id: 1, name: "Foundation", description: "Kana, N5 grammar, {V} N5 words and the {K} N5 kanji. Build daily study habits.", startDay: 1, endDay: 30, level: "n5", pass: "first", reading: idsIn("n5", "reading"), listeningOffset: 0, mocks: {} },
  { id: 2, name: "Intermediate", description: "All N4 grammar including keigo basics, {V} N4 words, {K} N4 kanji, first graded reading passages.", startDay: 31, endDay: 60, level: "n4", pass: "first", reading: idsIn("n4", "reading"), listeningOffset: 0, mocks: {} },
  { id: 3, name: "N3 → N2 Transition", description: "N3 grammar, {V} N3 words and {K} N3 kanji. Start exam-style reading and listening.", startDay: 61, endDay: 90, level: "n3", pass: "first", reading: idsIn("n3", "reading"), listeningOffset: 0, mocks: {} },
  { id: 4, name: "N2 Core", description: "All 200 N2 grammar points, {V} N2 words and {K} N2 kanji with short-passage reading and listening drills.", startDay: 91, endDay: 135, level: "n2", pass: "first", reading: idsIn("n2", "reading", (x) => x.kind === "short"), listeningOffset: 0, mocks: {} },
  { id: 5, name: "N2 Intensive", description: "Second pass over N2 grammar and vocabulary, medium/long/integrated reading, full listening rotation, first mock exam.", startDay: 136, endDay: 165, level: "n2", pass: "second", reading: idsIn("n2", "reading", (x) => x.kind !== "short"), listeningOffset: 45, mocks: { 150: "n2-mock-a" } },
  { id: 6, name: "N2 Exam Preparation", description: "Weak-point review, timed passages, confusable pairs, contractions, two mock exams and the N2 phase test.", startDay: 166, endDay: 180, level: "n2", pass: "exam", reading: idsIn("n2", "reading"), listeningOffset: 75, mocks: { 170: "n2-mock-b", 178: "n2-mock-c" } },
  { id: 7, name: "N1 Core", description: "All 180 N1 grammar points, {V} N1 words and {K} N1 kanji, with short and mid-length editorial reading and natural-speed listening.", startDay: 181, endDay: 225, level: "n1", pass: "first", reading: idsIn("n1", "reading", (x) => x.kind === "short" || x.kind === "medium"), listeningOffset: 0, mocks: {} },
  { id: 8, name: "N1 Intensive", description: "Second pass over N1 grammar and vocabulary, long, integrated and information-retrieval reading, full listening rotation, first N1 mock exam.", startDay: 226, endDay: 255, level: "n1", pass: "second", reading: idsIn("n1", "reading", (x) => x.kind !== "short"), listeningOffset: 45, mocks: { 240: "n1-mock-a" } },
  { id: 9, name: "N1 Exam Preparation", description: "Weak-point review, timed long passages, register and nuance drills, two mock exams and the N1 phase test.", startDay: 256, endDay: 270, level: "n1", pass: "exam", reading: idsIn("n1", "reading"), listeningOffset: 75, mocks: { 260: "n1-mock-b", 268: "n1-mock-c" } },
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

/**
 * Kanji days covered by slot `slot` of `total`: the contiguous range of sets that maps onto this
 * slot, so a phase with fewer content days than kanji sets doubles sets up rather than skipping.
 */
function kanjiDaysFor(slot: number, total: number, maxDay: number): number[] {
  const from = Math.floor((slot / total) * maxDay) + 1;
  const to = Math.max(from, Math.floor(((slot + 1) / total) * maxDay));
  const out: number[] = [];
  for (let d = from; d <= Math.min(to, maxDay); d++) out.push(d);
  return out;
}

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
    objectives: ["Learn the 46 basic hiragana (あ〜ん) row by row; say each sound aloud and trace it", "Pronunciation basics: vowels, mora timing, pitch", "Daily quiz: 15 kana questions (last task of the day)"],
    kana: [["foundation-1", 40], ["foundation-5", 15]],
    quiz: 15,
  },
  2: {
    title: "Hiragana: dakuten, combinations and long vowels",
    objectives: ["Learn dakuten/handakuten (が・ざ・だ・ば・ぱ), yōon (きゃ・しゅ・ちょ…), small っ and long vowels", "Read short hiragana words and a 100-character hiragana passage aloud", "Daily quiz: 15 kana questions (last task of the day)"],
    kana: [["foundation-2", 45]],
    quiz: 15,
  },
  3: {
    title: "Katakana: the basic 46",
    objectives: ["Learn the 46 basic katakana (ア〜ン); distinguish look-alikes シ/ツ, ソ/ン", "Recognize common loanwords (コーヒー, テレビ…)", "Daily quiz: 15 kana questions (last task of the day)"],
    kana: [["foundation-3", 45]],
    quiz: 15,
  },
  4: {
    title: "Katakana: dakuten, combinations and the long-vowel mark",
    objectives: ["Learn katakana dakuten, yōon and the long-vowel mark ー", "Read 30 katakana loanwords aloud", "Daily quiz: 15 kana questions (last task of the day)"],
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
/** Phase 1 has no passages on the kana-only days 1–7; the passages that would have gone there double up on the last week. */
const N5_CATCH_UP_DAYS = 7;

const previousOfLevel = (p: PhaseCfg) => PHASES.filter((x) => x.level === p.level && x.id < p.id);

function buildPhase(phase: PhaseCfg): CurriculumDay[] {
  const days: CurriculumDay[] = [];
  const total = phase.endDay - phase.startDay + 1;
  const level = phase.level;
  const L = LEVEL_NAME[level];
  const isN5 = phase.id === 1;

  // Content days: every day except the phase-test day carries new material.
  const contentDays = total - 1;
  const grammarStart = isN5 ? N5_GRAMMAR_START_DAY - 1 : 0; // phase 1: days 1–4 are kana only
  const kanjiStart = isN5 ? N5_KANJI_START_DAY - 1 : 0; // phase 1: kanji starts on day 8
  const vocabStart = isN5 ? N5_VOCAB_START_DAY - 1 : 0;

  // Grammar / vocab slices.
  let grammarChunks: Grammar[][];
  let vocabChunks: Vocab[][];
  if (isN5) {
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
  } else if (phase.pass === "first") {
    grammarChunks = chunk(grammar[level], contentDays - grammarStart);
    vocabChunks = chunk(vocab[level], contentDays);
  } else {
    // Second pass and exam phases: 5 grammar / 40 vocab per day, the rotation continuing from
    // where the previous second-pass phase of the same level stopped.
    const offset = previousOfLevel(phase)
      .filter((x) => x.pass !== "first")
      .reduce((n, x) => n + (x.endDay - x.startDay), 0);
    grammarChunks = [];
    vocabChunks = [];
    for (let i = 0; i < contentDays; i++) {
      const gi = ((offset + i) * 5) % grammar[level].length;
      grammarChunks.push(Array.from({ length: 5 }, (_, k) => grammar[level][(gi + k) % grammar[level].length]));
      const vi = ((offset + i) * 40) % vocab[level].length;
      vocabChunks.push(Array.from({ length: 40 }, (_, k) => vocab[level][(vi + k) % vocab[level].length]));
    }
  }

  const readingPool = phase.reading;
  const listeningPool = idsIn(level, "listening");
  const listeningOffset = phase.listeningOffset;
  const mockDays = new Set(Object.keys(phase.mocks).map(Number));

  // Phase 1: which passages/exercises will not be reached by the normal rotation (days 8–30), to
  // double up on the last week.
  const firstPassageDay = 7; // day > 7
  // The rotation index is the day offset, so on days 8–30 it reaches pool items 7..29; items 0..6
  // are the ones that never come up and get doubled onto the last week.
  const readingLeftover = isN5 ? readingPool.slice(0, firstPassageDay) : [];
  const listeningLeftover = isN5 ? listeningPool.slice(0, firstPassageDay) : [];

  for (let i = 0; i < total; i++) {
    const day = phase.startDay + i;
    const isLast = i === total - 1;
    const isWeekly = day % 7 === 0 && !isLast;
    const isMock = mockDays.has(day);
    const tasks: Task[] = [];
    const objectives: string[] = [];
    let title = "";

    const fd = isN5 ? FOUNDATION_DAYS[day] : undefined;
    const mixed = Boolean(fd && day >= N5_GRAMMAR_START_DAY);
    const M = mixed ? { ...MIN, ...FOUNDATION_MIXED_MIN } : MIN;
    if (fd) {
      title = fd.title;
      objectives.push(...fd.objectives);
      for (const [id, minutes] of fd.kana) tasks.push({ type: "kana", minutes, contentIds: [id] });
    }

    // Grammar (a mock-exam day carries only the exam and a review: no new material on top of 155+ minutes)
    const g = !isLast && !isMock && i >= grammarStart ? grammarChunks[i - grammarStart] ?? [] : [];
    if (g.length) {
      tasks.push({ type: "grammar", minutes: M.grammar, contentIds: g.map((x) => x.id) });
      const pats = g.map(pattern);
      if (!title) title = `${L} grammar: ${pats.slice(0, 2).join(" · ")}`;
      objectives.push(`${phase.pass !== "first" ? "Re-study" : "Learn"} ${L} grammar ${g[0].order}–${g[g.length - 1].order}: ${pats.join(", ")}`);
    }

    // Vocabulary
    const v = !isLast && !isMock && i >= vocabStart ? vocabChunks[i - vocabStart] ?? [] : [];
    if (v.length) {
      tasks.push({ type: "vocabulary", minutes: M.vocabulary, contentIds: v.map((x) => x.id) });
      objectives.push(`${phase.pass !== "first" ? "Review" : "Learn"} ${L} vocabulary #${v[0].order}–${v[v.length - 1].order} (${v.length} words)`);
    }

    // Kanji
    if (!isLast && !isMock && i >= kanjiStart) {
      const slot = i - kanjiStart;
      const slots = contentDays - kanjiStart;
      // Phase 1: one kanji set (~10 kanji) per calendar day so all 103 N5 kanji finish early, then a review pass.
      const firstPass = !isN5 || slot < kanjiDays[level];
      const kds = isN5 ? [(slot % kanjiDays[level]) + 1] : kanjiDaysFor(slot, slots, kanjiDays[level]);
      const ks = kanji[level].filter((k) => kds.includes(k.day));
      tasks.push({ type: "kanji", minutes: MIN.kanji, contentIds: ks.map((k) => k.id) });
      const setLabel = kds.length === 1 ? `day ${kds[0]}` : `days ${kds[0]}–${kds[kds.length - 1]}`;
      objectives.push(`${firstPass ? "" : "Review "}${L} kanji ${setLabel}: ${ks.map((k) => k.character).join(" ")}`);
    }

    if (isMock) {
      const examId = phase.mocks[day];
      const examName = examId.replace(/^n(\d)-mock-/, (_m, d) => `N${d}-`).toUpperCase();
      const minutes = examMinutes(examId);
      title = `Mock exam ${examName} under full timing`;
      tasks.push({ type: "review", minutes: MIN.review, contentIds: [] });
      tasks.push({ type: "mock-exam", minutes, contentIds: [], examId });
      objectives.unshift(`Sit mock exam ${examName} under exam timing (${minutes} minutes across the official sections)`, "Score it and write a weak-point list");
      days.push({ day, phase: phase.id, title: `Day ${day} — ${title}`, objectives: objectives.slice(0, 4), tasks });
      continue;
    }

    // Reading
    if (readingPool.length && day > firstPassageDay) {
      const ids = [readingPool[i % readingPool.length]];
      const catchUp = isN5 && i >= total - N5_CATCH_UP_DAYS ? readingLeftover[i - (total - N5_CATCH_UP_DAYS)] : undefined;
      if (catchUp && !ids.includes(catchUp)) ids.push(catchUp);
      tasks.push({ type: "reading", minutes: MIN.reading + (ids.length - 1) * 10, contentIds: ids });
      objectives.push(`Reading passage${ids.length > 1 ? "s" : ""} ${ids.map((rid) => rid.replace(/^n\d-reading-/, (m) => m.slice(0, 2).toUpperCase() + " #")).join(", ")}`);
    } else {
      tasks.push({ type: "reading", minutes: M.reading, contentIds: [] });
      objectives.push(day <= 7 ? "Free reading: kana words and short kana passages" : "Free reading: graded reader / kana-and-kanji passages");
    }

    // Listening
    if (listeningPool.length && day > firstPassageDay) {
      const ids = [listeningPool[(listeningOffset + i) % listeningPool.length]];
      const catchUp = isN5 && i >= total - N5_CATCH_UP_DAYS ? listeningLeftover[i - (total - N5_CATCH_UP_DAYS)] : undefined;
      if (catchUp && !ids.includes(catchUp)) ids.push(catchUp);
      tasks.push({ type: "listening", minutes: MIN.listening + (ids.length - 1) * 10, contentIds: ids });
      objectives.push(`Listening exercise${ids.length > 1 ? "s" : ""} ${ids.map((lid) => lid.replace(/^n(\d)-listening-/, (_m: string, d: string) => "N" + d + " #")).join(", ")}: listen, check, read transcript, shadow`);
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

    days.push({ day, phase: phase.id, title: `Day ${day} — ${title}`, objectives: objectives.slice(0, 4), tasks });
  }
  return days;
}

// Phase descriptions quote how much material the phase covers. Fill those counts from the
// actual level membership rather than hard-coding them, so the plan can never promise a number
// the content does not contain — re-bucketing a word to another level updates the prose too.
const phasesOut: Curriculum["phases"] = PHASES.map(({ id, name, description, startDay, endDay, level }) => ({
  id,
  name,
  description: description
    .replace("{V}", vocab[level].length.toLocaleString("en-US"))
    .replace("{K}", String(kanji[level].length)),
  startDay,
  endDay,
}));
const allDays = PHASES.flatMap(buildPhase);

// Post-pass: any reading passage or listening exercise the rotations never reached is added to
// the last ordinary days of its level's final phase, so every authored item is scheduled once.
for (const level of LEVELS) {
  const last = [...PHASES].reverse().find((p) => p.level === level)!;
  const phaseDays = allDays.filter((d) => d.phase === last.id && !d.tasks.some((t) => t.type === "mock-exam" || t.type === "phase-test"));
  for (const kind of ["reading", "listening"] as const) {
    const scheduled = new Set(allDays.flatMap((d) => d.tasks.filter((t) => t.type === kind).flatMap((t) => t.contentIds)));
    const missing = idsIn(level, kind).filter((id) => !scheduled.has(id));
    missing.forEach((id, i) => {
      const day = phaseDays[phaseDays.length - 1 - (i % phaseDays.length)];
      const task = day.tasks.find((t) => t.type === kind);
      if (task && !task.contentIds.includes(id)) {
        task.contentIds.push(id);
        task.minutes += 10;
      }
    });
  }
}
const curriculum: Curriculum = { phases: phasesOut, days: allDays };
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
