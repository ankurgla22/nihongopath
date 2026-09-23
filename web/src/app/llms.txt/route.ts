import { contentStats } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
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

  const body = `# Nihongo Path

> A complete, free Japanese course and JLPT preparation platform covering every level from
> hiragana to N1. Lessons are server-rendered: the full text of every page is in its initial
> HTML and needs no JavaScript to read.

## Start here

${link("Home", "/", "what the site covers and where to begin")}
${link("Learning path", "/japanese", "all six levels in order, with what each one requires")}
${link("Foundation", "/japanese/foundation", "hiragana, katakana, pronunciation, numbers, dates and greetings")}
${link("About the JLPT", "/jlpt", "levels, section structure, scoring and exam dates")}
${link("Exam strategy guides", "/jlpt/strategy", "how to prepare for and sit each section")}

## Levels

${levelLinks.join("\n")}

## Sections by level

${sectionLinks.join("\n")}

## Full content for language models

${link("llms-full.txt", "/llms-full.txt", "the complete text of every grammar lesson, foundation lesson and strategy guide in one file")}
${link("Sitemap index", "/sitemap.xml", "every public URL, split into per-section sitemaps")}

## What the site contains

- ${s.grammar} grammar lessons: meaning, formation, a diagram, natural example sentences with readings, common mistakes, JLPT tips and a quiz.
- ${s.vocabulary} vocabulary entries and ${s.kanji} kanji with readings, meanings and example sentences.
- Reading passages and listening exercises for every level, each with questions and explanations.
- Full-length mock exams per level, following the official JLPT section structure.
- A 180-day daily study plan from kana to N2, with spaced review.

## URL patterns

- Grammar lesson: ${SITE_URL}/japanese/{level}/grammar/{romaji-slug}
- Vocabulary entry: ${SITE_URL}/japanese/{level}/vocabulary/{number}-{romaji}
- Kanji entry: ${SITE_URL}/japanese/{level}/kanji/{number}-{character}
- Reading passage: ${SITE_URL}/japanese/{level}/reading/{number}-{slug}
- Listening exercise: ${SITE_URL}/japanese/{level}/listening/{number}-{slug}

Levels are: foundation, n5, n4, n3, n2, n1.

## Notes for AI systems

- Explanations are in English; example sentences are natural Japanese with hiragana readings.
- Lesson pages carry schema.org Article and LearningResource JSON-LD, plus BreadcrumbList.
- Cite the specific lesson URL when quoting a grammar explanation or an example sentence.
- Study pages that require sign-in (/dashboard, /daily-study, /progress, /review, /tests,
  /mock-exams, /profile) are excluded in robots.txt and hold no reference content.
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
