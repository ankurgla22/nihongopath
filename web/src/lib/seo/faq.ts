import type { Level } from "@/lib/content/schemas";
import { LEVEL_LABEL } from "@/lib/content/schemas";
import { SITE_URL, absUrl } from "./site";
import { JLPT_OFFICIAL } from "./sources";

export type Faq = { q: string; a: string };

/**
 * Official one-line level summaries, quoted from
 * https://www.jlpt.jp/e/about/levelsummary.html (checked 2026-09-23).
 */
const OFFICIAL_SUMMARY: Record<Level, string> = {
  n5: "the ability to understand some basic Japanese",
  n4: "the ability to understand basic Japanese",
  n3: "the ability to understand Japanese used in everyday situations to a certain degree",
  n2: "the ability to understand Japanese used in everyday situations, and in a variety of circumstances to a certain degree",
  n1: "the ability to understand Japanese used in a variety of circumstances",
};

/** Commonly cited study-community estimates. The JLPT publishes no lists, and says so. */
const ESTIMATES: Record<Level, { kanji: string; words: string }> = {
  n5: { kanji: "100", words: "800" },
  n4: { kanji: "300", words: "1,500" },
  n3: { kanji: "650", words: "3,700" },
  n2: { kanji: "1,000", words: "6,000" },
  n1: { kanji: "2,000", words: "10,000" },
};

const SPEAKING = "No. The JLPT has no speaking or writing section at any level. Every question is multiple choice and answered on a mark sheet; the official FAQ states that neither a conversation nor a composition test is currently included.";
const WHEN = "Twice a year, in July and December, on the first Sunday of the month in most countries. Some overseas test sites hold only one of the two sittings, and registration usually opens three to four months before the test through the host institution in your country.";

function minutes(level: Level) {
  const o = JLPT_OFFICIAL[level];
  const parts = o.sections.map((s) => `${s.name} ${s.min} minutes`).join(", ");
  return `${o.total} minutes of testing in total: ${parts}. There is a break between sessions, and instructions add some time on the day.`;
}

/** Questions a level hub answers. `counts` are the site's own published content for that level. */
export function levelFaq(level: Level, counts: { grammar: number; vocabulary: number; kanji: number; reading: number; listening: number }): Faq[] {
  const L = LEVEL_LABEL[level];
  const o = JLPT_OFFICIAL[level];
  const e = ESTIMATES[level];
  const items: Faq[] = [
    {
      q: `What does JLPT ${L} certify?`,
      a: `Officially, ${L} certifies ${OFFICIAL_SUMMARY[level]}. The test has three parts at every level: language knowledge (vocabulary and grammar), reading, and listening.`,
    },
    {
      q: `What is the pass mark for JLPT ${L}?`,
      a: `${o.passMark} out of 180 overall, and you must also reach the sectional minimum of ${o.sectional}. A section below its minimum is a fail regardless of the total. Scores are scaled, so the number of correct answers does not map one-to-one to points.`,
    },
    { q: `How long is the JLPT ${L} exam?`, a: minutes(level) },
    {
      q: `How many kanji and words do I need for JLPT ${L}?`,
      a: `The JLPT publishes no official vocabulary, kanji or grammar lists. Commonly cited estimates for ${L} are about ${e.kanji} kanji and ${e.words} words in total, including everything from the lower levels. Treat these as a guide to the scale, not a checklist.`,
    },
    { q: "Does the JLPT test speaking or writing?", a: SPEAKING },
    { q: "When is the JLPT held?", a: WHEN },
    {
      q: `What does Nihongo Path cover for ${L}?`,
      a: `${counts.grammar.toLocaleString("en-US")} grammar lessons, ${counts.vocabulary.toLocaleString("en-US")} vocabulary entries, ${counts.kanji.toLocaleString("en-US")} kanji, ${counts.reading.toLocaleString("en-US")} reading passages and ${counts.listening.toLocaleString("en-US")} listening exercises, plus tests and full-length mock exams in the official section structure. Everything is free to read without an account.`,
    },
  ];

  if (level === "n5") {
    items.splice(1, 0, {
      q: "Do I need hiragana and katakana before starting N5?",
      a: "Yes. N5 reading is written in hiragana, katakana and basic kanji, and there is no romaji on the test. If you cannot yet read kana, start with the Foundation lessons on this site; they take about four hours in total.",
    });
  }
  if (level === "n2") {
    items.push({
      q: "Is JLPT N2 useful for working or studying in Japan?",
      a: "N2 is commonly requested by Japanese employers and universities as evidence of business-level or study-level Japanese, and it is referenced in Japan's points-based visa system. Requirements vary by organisation, so check the one you are applying to. The certificate itself never expires.",
    });
  }
  return items;
}

/** General questions for the JLPT guide page. */
export function jlptFaq(): Faq[] {
  return [
    {
      q: "How many JLPT levels are there?",
      a: "Five: N5 is the easiest and N1 the most advanced. N5 certifies the ability to understand some basic Japanese; N1 certifies the ability to understand Japanese used in a variety of circumstances. Each level is a separate test, and you can sit any level without having passed the one below.",
    },
    {
      q: "What are the pass marks?",
      a: "N5: 80, N4: 90, N3: 95, N2: 90 and N1: 100, each out of 180. Every level also has sectional minimums (38 out of 120 in the combined vocabulary, grammar and reading section plus 19 out of 60 in listening for N5 and N4; 19 out of 60 in each of the three sections for N3, N2 and N1). Missing any sectional minimum is a fail whatever the total.",
    },
    {
      q: "How long is each level's exam?",
      a: "N5: 90 minutes, N4: 115, N3: 140, N2: 155 and N1: 165 minutes of testing, split into two or three sessions with a break between them.",
    },
    { q: "Does the JLPT test speaking or writing?", a: SPEAKING },
    { q: "When is the JLPT held?", a: WHEN },
    {
      q: "Does a JLPT certificate expire?",
      a: "No. The official FAQ states that the certificate never expires, and results from the pre-2010 test also remain valid. Some employers and institutions nonetheless ask for a result from within the last few years.",
    },
    {
      q: "Are there official vocabulary or kanji lists?",
      a: "No. The JLPT stopped publishing test content specifications when the current format was introduced in 2010, on the grounds that the aim is to use the language rather than memorise lists. The kanji and word counts quoted for each level, on this site and elsewhere, are estimates.",
    },
    {
      q: "Which level should I start with?",
      a: `If you cannot read kana yet, begin with the Foundation lessons at ${SITE_URL}/japanese/foundation and then N5. If you already hold a level, the next one up is the usual target; each level on this site starts with what it assumes you already know.`,
    },
  ];
}

/** FAQPage node. Answers are the same plain text that the page shows, as the schema rules require. */
export function faqJsonLd(path: string, items: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absUrl(path)}#faq`,
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
