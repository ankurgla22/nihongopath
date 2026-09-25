import { LEVELS, type Level } from "@/lib/content/schemas";

export type LevelInfo = {
  level: Level;
  label: string;
  name: string;
  tagline: string;
  description: string;
  youWillLearn: string[];
  examNote: string;
};

export const LEVEL_INFO: Record<Level, LevelInfo> = {
  n5: {
    level: "n5",
    label: "N5",
    // Not "Foundations": the kana course at /japanese/foundation is already called Foundation, and
    // two different things called the same thing in the same nav is a coin toss for the reader.
    name: "Starting out",
    tagline: "Your first sentences in Japanese.",
    description:
      "Hiragana, katakana, the most common kanji, basic particles and verb forms. After N5 you can introduce yourself, talk about daily life and read simple signs and notes.",
    youWillLearn: [
      "Particles は, が, を, に, で, へ and how they shape a sentence",
      "Present, past and negative forms of verbs and adjectives",
      "Around 100 kanji and 700 everyday words",
      "Simple requests, invitations and questions",
    ],
    examNote: "Commonly cited estimates: about 100 kanji and 800 words (the JLPT publishes no official lists). Pass mark: 80 / 180.",
  },
  n4: {
    level: "n4",
    label: "N4",
    name: "Everyday Japanese",
    tagline: "Hold a real conversation about daily topics.",
    description:
      "Te-form combinations, potential, passive, causative, conditionals and giving / receiving. You start reading short passages and understanding slow conversations.",
    youWillLearn: [
      "Verb forms: potential, passive, causative, volitional and imperative",
      "Conditionals たら, ば, と, なら and how they differ",
      "Around 150 more kanji and 900 words for daily life, work and travel",
      "Explaining reasons, giving advice and making comparisons",
    ],
    examNote: "Commonly cited estimates: about 300 kanji and 1,500 words (the JLPT publishes no official lists). Pass mark: 90 / 180.",
  },
  n3: {
    level: "n3",
    label: "N3",
    name: "Intermediate Bridge",
    tagline: "Read news headlines and follow natural speech.",
    description:
      "The bridge between everyday and formal Japanese. Keigo, nuanced sentence endings, and the grammar that turns simple sentences into natural paragraphs.",
    youWillLearn: [
      "Keigo: 尊敬語 and 謙譲語 in real situations",
      "Nuance patterns: 〜わけ, 〜はず, 〜べき, 〜ように and their differences",
      "Around 370 kanji and 1,500 words on society, work and health",
      "Reading medium-length passages and understanding the writer's intent",
    ],
    examNote: "Commonly cited estimates: about 650 kanji and 3,700 words (the JLPT publishes no official lists). Pass mark: 95 / 180.",
  },
  n2: {
    level: "n2",
    label: "N2",
    name: "Advanced Fluency",
    tagline: "Work, study and live in Japanese with confidence.",
    description:
      "Formal and written Japanese: newspaper articles, business emails, opinion pieces and fast natural conversation. N2 is commonly requested by Japanese employers and universities, though requirements vary by organisation.",
    youWillLearn: [
      "200 grammar patterns including 〜あげく, 〜ざるを得ない, 〜に限らず and 〜わけではない",
      "Around 390 kanji and 1,800 words for news, business and academic contexts",
      "Reading long passages, comparing two texts and scanning information",
      "Listening for the main point, the speaker's attitude and quick responses",
    ],
    examNote: "Commonly cited estimates: about 1,000 kanji and 6,000 words (the JLPT publishes no official lists). Pass mark: 90 / 180, with at least 19 in each section.",
  },
  n1: {
    level: "n1",
    label: "N1",
    name: "Advanced Mastery",
    tagline: "Read editorials and follow fast, abstract discussion.",
    description:
      "The highest JLPT level: literary and formal grammar, abstract vocabulary, dense editorials and lectures at natural speed. Built for learners who have passed N2 and want full professional fluency.",
    youWillLearn: [
      "Formal and literary patterns: 〜んばかり, 〜ざるを得ない, 〜を禁じ得ない, 〜とあって, 〜ながらも",
      "Abstract and specialised vocabulary for politics, economics, science and the arts",
      "Around 600 more kanji and 1,500 words of editorial and academic Japanese",
      "Reading long opinion pieces and understanding implication, irony and stance",
    ],
    examNote: "Commonly cited estimates: about 2,000 kanji and 10,000 words (the JLPT publishes no official lists). Pass mark: 100 / 180 (19 per section).",
  },
};

export const LEVEL_ORDER = LEVELS;

export function isLevel(x: string): x is Level {
  return (LEVELS as string[]).includes(x);
}

/** Dynamic route params may arrive percent-encoded (kanji slugs contain the character itself). */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
