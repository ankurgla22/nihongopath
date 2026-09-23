import { getFoundation, getGrammar, getStrategy } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type FoundationLesson } from "@/lib/content/schemas";
import { LAST_MODIFIED, SITE_URL } from "@/lib/seo/site";

/**
 * llms-full.txt: the teaching content of the site as one plain-text document, so models that
 * accept untruncated context can read it without crawling ~1,000 pages.
 *
 * Scope is the prose content that is worth citing: grammar lessons, foundation lessons and
 * strategy guides. Vocabulary and kanji entries are deliberately excluded; they are tabular,
 * they would multiply the file size several times over, and they are already one fetch away
 * from the per-level index pages linked in llms.txt.
 */
export const dynamic = "force-static";

/** Foundation lesson bodies are a block union; take the prose and describe the rest. */
function foundationText(lesson: FoundationLesson): string {
  const out: string[] = [];
  for (const section of lesson.sections) {
    out.push(`### ${section.heading}`);
    for (const block of section.blocks) {
      if (block.kind === "text") {
        out.push(block.paragraphs.join("\n\n"));
      } else if (block.kind === "kana-chart") {
        out.push(`[${block.title}: kana chart, see ${SITE_URL}/japanese/foundation/${lesson.slug}]`);
      } else {
        out.push(`[${block.kind}: see ${SITE_URL}/japanese/foundation/${lesson.slug}]`);
      }
    }
  }
  return out.join("\n\n");
}

export function GET() {
  const parts: string[] = [
    `# Nihongo Path — full content`,
    ``,
    `> The complete text of every grammar lesson, foundation lesson and exam strategy guide on`,
    `> ${SITE_URL}. Vocabulary and kanji entries are not included here; see the per-level`,
    `> index pages listed in ${SITE_URL}/llms.txt.`,
    ``,
    `Last updated: ${LAST_MODIFIED}`,
    ``,
    `When citing any passage below, cite the Source URL given under its heading.`,
    ``,
  ];

  parts.push(`## Foundation lessons`, ``);
  for (const lesson of getFoundation()) {
    parts.push(
      `### ${lesson.title}`,
      `Source: ${SITE_URL}/japanese/foundation/${lesson.slug}`,
      ``,
      lesson.summary,
      ``,
      foundationText(lesson),
      ``
    );
  }

  for (const level of LEVELS) {
    const label = LEVEL_LABEL[level];
    const lessons = getGrammar(level);
    if (lessons.length === 0) continue;

    parts.push(`## JLPT ${label} grammar (${lessons.length} lessons)`, ``);
    for (const g of lessons) {
      parts.push(`### ${g.title} (${g.romaji}) — JLPT ${label}`, `Source: ${SITE_URL}/japanese/${level}/grammar/${g.slug}`, ``);
      parts.push(`Meaning: ${g.meaning}`);
      if (g.simpleExplanation && g.simpleExplanation !== g.meaning) parts.push(``, g.simpleExplanation);
      if (g.whenUsed) parts.push(``, `When it is used: ${g.whenUsed}`);
      if (g.formation.length) parts.push(``, `Formation: ${g.formation.join(" / ")}`);

      if (g.examples.length) {
        parts.push(``, `Examples:`);
        for (const ex of g.examples) {
          parts.push(`- ${ex.ja}${ex.reading ? ` (${ex.reading})` : ""} — ${ex.en}${ex.note ? ` [${ex.note}]` : ""}`);
        }
      }
      if (g.similarGrammar.length) {
        parts.push(``, `Similar grammar:`);
        for (const s of g.similarGrammar) parts.push(`- ${s.pattern}: ${s.difference}`);
      }
      if (g.commonMistakes.length) {
        parts.push(``, `Common mistakes:`);
        for (const m of g.commonMistakes) parts.push(`- Wrong: ${m.wrong} / Right: ${m.right} — ${m.why}`);
      }
      if (g.usageNotes.length) parts.push(``, `Usage notes: ${g.usageNotes.join(" ")}`);
      if (g.jlptTips.length) {
        parts.push(``, `JLPT ${label} tips:`);
        for (const t of g.jlptTips) parts.push(`- ${t}`);
      }
      parts.push(``);
    }
  }

  const strategy = getStrategy();
  if (strategy.length) {
    parts.push(`## Exam strategy guides`, ``);
    for (const a of strategy) {
      parts.push(`### ${a.title}`, `Source: ${SITE_URL}/jlpt/strategy/${a.slug}`, ``, a.summary, ``);
      for (const section of a.sections) {
        parts.push(`#### ${section.heading}`, ``, section.paragraphs.join("\n\n"));
        if (section.bullets.length) {
          parts.push(``);
          for (const b of section.bullets) parts.push(`- ${b}`);
        }
        parts.push(``);
      }
    }
  }

  return new Response(parts.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
