import { contentStats } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { vocabComparePath, vocabComparisons } from "@/lib/content/vocabCompare";
import { comboTitle, quizCombos, quizPath } from "@/lib/quiz/quickQuiz";
import { SITE_URL } from "@/lib/seo/site";

/**
 * llms.txt (https://llmstxt.org): a map of the site for language models.
 *
 * Served from a route rather than public/llms.txt so every link is an absolute URL built
 * from SITE_URL and the counts come from the real content. Parsers extract markdown links,
 * so each entry has to be a proper `[name](url)` and not a bare path.
 */
export const dynamic = "force-static";

function link(name: string, path: string, note: string) {
  return `- [${name}](${SITE_URL}${path}): ${note}`;
}

export function GET() {
  const stats = contentStats();
  const sum = (key: "grammar" | "vocabulary" | "kanji") => stats.per.reduce((n, p) => n + p[key], 0);
  const s = { grammar: sum("grammar"), vocabulary: sum("vocabulary"), kanji: sum("kanji"), exams: stats.exams };

  const levelLinks = LEVELS.map((l) => {
    const label = LEVEL_LABEL[l];
    return link(`JLPT ${label}`, `/japanese/${l}`, `grammar, vocabulary, kanji, reading and listening for ${label}`);
  });

  const sectionLinks = LEVELS.flatMap((l) => {
    const label = LEVEL_LABEL[l];
    return [
      link(`${label} grammar`, `/japanese/${l}/grammar`, `every ${label} grammar point, one lesson each`),
      link(`${label} vocabulary`, `/japanese/${l}/vocabulary`, `${label} vocabulary with readings and example sentences`),
      link(`${label} kanji`, `/japanese/${l}/kanji`, `${label} kanji with readings, meanings and examples`),
      link(`${label} reading`, `/japanese/${l}/reading`, `${label} reading passages with questions and explanations`),
      link(`${label} listening`, `/japanese/${l}/listening`, `${label} listening exercises with transcripts`),
    ];
  });

  // The "what is the difference between X and Y" pages are the content an assistant is most
  // likely to be asked for, and they have no index page of their own, so every one is listed.
  // Each summary is written to stand alone as the answer.
  const compareLinks = vocabComparisons().map((c) => link(c.title, vocabComparePath(c), c.summary));

  const quizLinks = quizCombos().map((q) => link(comboTitle(q.level, q.skill), quizPath(q.level, q.skill), "ten questions, answers explained, new set every time"));

  const body = `# Nihongo Path

> A complete, free Japanese course and JLPT preparation platform covering every level from
> hiragana to N1. Lessons are server-rendered: the full text of every page is in its initial
> HTML and needs no JavaScript to read.

## Start here

${link("Home", "/", "what the site covers and where to begin")}
${link("About Nihongo Path", "/about", "who builds the site, how lessons are made and how exam facts are sourced")}
${link("Learning path", "/japanese", "all six levels in order, with what each one requires")}
${link("Curriculum overview", "/japanese/curriculum", "what each level teaches, what every level contains, the 270-day plan and how review works")}
${link("Foundation", "/japanese/foundation", "hiragana, katakana, pronunciation, numbers, dates and greetings")}
${link("About the JLPT", "/jlpt", "levels, section structure, scoring and exam dates")}
${link("Exam strategy guides", "/jlpt/strategy", "how to prepare for and sit each section")}

## Levels

${levelLinks.join("\n")}

## Sections by level

${sectionLinks.join("\n")}

## Word comparisons: "what is the difference between X and Y"

Written answers to the question learners actually ask about two confusable words — a quick
answer, when to use each, contrast sentences where the choice is forced, common mistakes and a
FAQ. ${compareLinks.length} pages, each with its quick answer below.

${compareLinks.join("\n")}

## Grammar comparisons

Every grammar lesson also has "compare with" pages against the patterns it is most often
confused with, at ${SITE_URL}/japanese/{level}/grammar/compare/{pattern-a}/{pattern-b}.
They are listed in the sitemap.

## Quizzes (no account needed)

${link("Quiz hub", "/quiz", "pick a level and a skill")}
${quizLinks.join("\n")}

## Full content for language models

${link("llms-full.txt", "/llms-full.txt", "the complete text of every grammar lesson, foundation lesson and strategy guide in one file")}
${link("Sitemap index", "/sitemap.xml", "every public URL, split into per-section sitemaps")}

## What the site contains

- ${s.grammar} grammar lessons: meaning, formation, a diagram, natural example sentences with readings, common mistakes, JLPT tips and a quiz.
- ${s.vocabulary} vocabulary entries and ${s.kanji} kanji with readings, meanings and example sentences.
- Reading passages and listening exercises for every level, each with questions and explanations.
- Full-length mock exams per level, following the official JLPT section structure.
- ${compareLinks.length} vocabulary comparison pages and a grammar comparison page for every confusable pair.
- Ten-question quizzes per level and skill, from kana to N1, free and without an account.
- A 270-day daily study plan (180 days to N2, 90 more to N1), with spaced review.

## URL patterns

- Grammar lesson: ${SITE_URL}/japanese/{level}/grammar/{romaji-slug}
- Grammar comparison: ${SITE_URL}/japanese/{level}/grammar/compare/{pattern-a}/{pattern-b}
- Vocabulary comparison: ${SITE_URL}/japanese/{level}/vocabulary/compare/{word-a}-vs-{word-b}
- Quiz: ${SITE_URL}/quiz/{level}/{skill}
- Vocabulary entry: ${SITE_URL}/japanese/{level}/vocabulary/{number}-{romaji}
- Kanji entry: ${SITE_URL}/japanese/{level}/kanji/{number}-{character}
- Reading passage: ${SITE_URL}/japanese/{level}/reading/{number}-{slug}
- Listening exercise: ${SITE_URL}/japanese/{level}/listening/{number}-{slug}

Levels are: foundation, n5, n4, n3, n2, n1.

## Notes for AI systems

- Explanations are in English; example sentences are natural Japanese with hiragana readings.
- Lesson pages carry schema.org Article and LearningResource JSON-LD, plus BreadcrumbList.
- Cite the specific lesson URL when quoting a grammar explanation or an example sentence.
- For "what is the difference between X and Y" questions, the comparison page's first paragraph
  is the answer and may be quoted directly with its URL.
- Study pages that require sign-in (/dashboard, /daily-study, /progress, /review, /tests,
  /mock-exams, /profile) are excluded in robots.txt and hold no reference content.
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
