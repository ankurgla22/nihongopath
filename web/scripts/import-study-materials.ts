/**
 * Converts ../study-materials markdown into base JSON content under web/content.
 * Run: npm run import:content
 *
 * Produces:
 *   content/<level>/kanji.json       KanjiItem[]
 *   content/<level>/vocabulary.json  VocabItem[]
 *   content/<level>/grammar-base.json  GrammarLesson[] (enriched=false)
 */
import fs from "node:fs";
import path from "node:path";
import {
  GrammarLessonSchema,
  KanjiItemSchema,
  VocabItemSchema,
  type GrammarLesson,
  type KanjiItem,
  type Level,
  type VocabItem,
} from "../src/lib/content/schemas";

const ROOT = path.resolve(__dirname, "..");
const SM = path.resolve(ROOT, "..", "study-materials");
const OUT = path.join(ROOT, "content");

const read = (p: string) => fs.readFileSync(p, "utf8");
const write = (p: string, data: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
};

import { toRomaji } from "../src/lib/content/romaji";

function slugify(s: string): string {
  return toRomaji(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Parse "例（れい）meaning; 例2（よみ）meaning" or "例 れい meaning" into word entries. */
function parseExampleWords(cell: string): { word: string; reading: string; meaning: string }[] {
  const out: { word: string; reading: string; meaning: string }[] = [];
  // Split on ";" or after a ")" only when the next entry starts with Japanese, so "white (noun)" stays one meaning.
  const parts = cell.split(/[;；]|(?<=\))\s*(?=[぀-ヿ一-鿿])/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    let m = p.match(/^(.+?)[（(]([^）)]+)[）)]\s*(.*)$/);
    if (m) {
      out.push({ word: m[1].trim(), reading: m[2].trim(), meaning: m[3].trim() || "—" });
      continue;
    }
    m = p.match(/^(\S+)\s+([぀-ゟ゠-ヿー]+)\s+(.+)$/);
    if (m) out.push({ word: m[1], reading: m[2], meaning: m[3] });
  }
  if (out.length === 0 && cell) out.push({ word: cell, reading: "", meaning: "" });
  return out;
}

const splitReadings = (cell: string) =>
  cell === "—" || cell === "-" || !cell
    ? []
    : cell
        .split(/[、,／/]/)
        .map((r) => r.trim())
        .filter((r) => r && r !== "—");

function importKanji(level: Level): KanjiItem[] {
  const file = path.join(SM, "02-kanji", `kanji-${level.toUpperCase()}.md`);
  const lines = read(file).split(/\r?\n/);
  const items: KanjiItem[] = [];
  let day = 0;
  let inMain = true;
  for (const line of lines) {
    if (/^## 50 tricky/.test(line) || /Most Useful Radicals/.test(line)) inMain = false;
    if (!inMain) continue;
    const dm = line.match(/^## Day (\d+)/);
    if (dm) day = Number(dm[1]);
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const c = splitCells(line);
    if (c.length < 6) continue;
    const [num, ch, on, kun, meaning, words] = c;
    const character = ch.trim();
    if ([...character].length !== 1) continue;
    const item = {
      id: `${level}-kanji-${character}`,
      slug: `${num}-${character}`,
      level,
      order: Number(num),
      day: day || 1,
      character,
      meanings: meaning.split(/[,;，、]/).map((m) => m.trim()).filter(Boolean),
      onyomi: splitReadings(on),
      kunyomi: splitReadings(kun),
      words: parseExampleWords(words),
      examples: [],
      similarKanji: [],
      commonMistakes: [],
      enriched: false,
    };
    const parsed = KanjiItemSchema.safeParse(item);
    if (parsed.success) items.push(parsed.data);
    else console.warn(`kanji ${level} #${num} ${character}: ${parsed.error.issues[0]?.message}`);
  }
  return items;
}

function importVocab(level: Level): VocabItem[] {
  const dir = path.join(SM, "03-vocabulary");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().startsWith(`vocab-${level}`))
    .sort();
  const items: VocabItem[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    let theme = "";
    for (const line of read(path.join(dir, f)).split(/\r?\n/)) {
      const hm = line.match(/^##\s+(?:\d+\.\s*)?(.+)$/);
      if (hm) theme = hm[1].trim();
      if (!/^\|\s*\d+\s*\|/.test(line)) continue;
      const c = splitCells(line);
      if (c.length < 6) continue;
      const [num, word, reading, pos, meaning, example] = c;
      if (seen.has(word)) continue;
      seen.add(word);
      const [ja, en] = example.split(/\s+[—–-]\s+|(?<=[。！？])\s+(?=[A-Z"'])/).map((s) => s.trim());
      const slugBase = slugify(reading || word) || `w${num}`;
      const item = {
        id: `${level}-vocab-${num}`,
        slug: `${num}-${slugBase}`,
        level,
        order: Number(num),
        word,
        reading,
        pos,
        meaning,
        theme: theme || undefined,
        examples: [{ ja: ja || example, en: en || "" }].map((e) => ({ ...e, en: e.en || "(see Japanese)" })),
        difficulty: level === "n1" ? 5 : level === "n2" ? 4 : level === "n3" ? 3 : 2,
        enriched: false,
      };
      const parsed = VocabItemSchema.safeParse(item);
      if (parsed.success) items.push(parsed.data);
      else console.warn(`vocab ${level} #${num} ${word}: ${parsed.error.issues[0]?.message}`);
    }
  }
  return items;
}

function importGrammar(level: Level): GrammarLesson[] {
  const file = path.join(SM, "04-grammar", `grammar-${level.toUpperCase()}.md`);
  const text = read(file);
  const blocks = text.split(/^### (?=\d+\.)/m).slice(1);
  const lessons: GrammarLesson[] = [];
  for (const block of blocks) {
    const [head, ...rest] = block.split(/\r?\n/);
    const hm = head.match(/^(\d+)\.\s*(.+)$/);
    if (!hm) continue;
    const order = Number(hm[1]);
    const title = hm[2].trim();
    const body = rest.join("\n");
    const grab = (label: string) => {
      const m = body.match(new RegExp(`\\*\\*${label}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Z]|\\n---|$)`));
      return m ? m[1].trim() : "";
    };
    const meaning = grab("Meaning");
    const formationRaw = grab("Formation");
    const examplesRaw = grab("Examples");
    const note = grab("Note");
    const formation = formationRaw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
    const exLines = examplesRaw
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
      .filter(Boolean);
    const examples: { ja: string; reading?: string; en: string }[] = [];
    // Expect triplets: Japanese / reading / English. Fall back to pairs.
    const isJa = (s: string) => /[一-鿿]/.test(s);
    const isKana = (s: string) => /^[぀-ヿー、。！？…「」（）\s\d〜～・]+$/.test(s);
    const isEn = (s: string) => /^[A-Za-z"'(]/.test(s);
    // Single-line format used by N5/N4: "日本語 — にほんご — English"
    for (const l of exLines) {
      const tri = l.split(/\s+[—–]\s+/);
      if (tri.length === 3 && isJa(tri[0]) && isEn(tri[2])) examples.push({ ja: tri[0].trim(), reading: tri[1].trim(), en: tri[2].trim() });
      else if (tri.length === 2 && (isJa(tri[0]) || isKana(tri[0])) && isEn(tri[1])) examples.push({ ja: tri[0].trim(), en: tri[1].trim() });
    }
    // Multi-line format used by N3/N2: Japanese / reading / English on consecutive lines.
    let i = examples.length === 0 ? 0 : exLines.length;
    while (i < exLines.length) {
      const a = exLines[i];
      const b = exLines[i + 1] ?? "";
      const c = exLines[i + 2] ?? "";
      if (isJa(a) && isKana(b) && isEn(c)) {
        examples.push({ ja: a, reading: b, en: c });
        i += 3;
      } else if ((isJa(a) || isKana(a)) && isEn(b)) {
        examples.push({ ja: a, en: b });
        i += 2;
      } else {
        i += 1;
      }
    }
    if (examples.length === 0) examples.push({ ja: title, en: meaning || title });
    const romaji = slugify(title.replace(/[（(].*?[）)]/g, "")) || `g${order}`;
    const lesson = {
      id: `${level}-grammar-${order}`,
      slug: `${order}-${romaji}`,
      level,
      order,
      title,
      romaji,
      meaning: meaning || title,
      simpleExplanation: meaning || title,
      formation: formation.length ? formation : ["See examples."],
      examples,
      usageNotes: note ? [note] : [],
      enriched: false,
    };
    const parsed = GrammarLessonSchema.safeParse(lesson);
    if (parsed.success) lessons.push(parsed.data);
    else console.warn(`grammar ${level} #${order}: ${parsed.error.issues[0]?.message}`);
  }
  return lessons;
}

for (const level of ["n5", "n4", "n3", "n2", "n1"] as Level[]) {
  if (!fs.existsSync(path.join(SM, "02-kanji", `kanji-${level.toUpperCase()}.md`))) { console.log(`${level}: no study materials yet, skipped`); continue; }
  const kanji = importKanji(level);
  const vocab = importVocab(level);
  const grammar = importGrammar(level);
  write(path.join(OUT, level, "kanji.json"), kanji);
  write(path.join(OUT, level, "vocabulary.json"), vocab);
  write(path.join(OUT, level, "grammar-base.json"), grammar);
  console.log(`${level}: kanji ${kanji.length}, vocab ${vocab.length}, grammar ${grammar.length}`);
}
