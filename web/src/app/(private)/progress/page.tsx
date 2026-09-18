import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { contentStats, getFoundation } from "@/lib/content";
import { LEVELS, type Level } from "@/lib/content/levels";
import { Container, PageTitle } from "@/components/ui";
import { ProgressClient } from "@/components/progress/ProgressClient";
import type { Skill } from "@/lib/firestore/types";

export const metadata = pageMetadata({
  title: "Progress",
  description: "Your overall progress across grammar, vocabulary, kanji, reading, listening and mock exams.",
  path: "/progress",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  await requireUser("/progress");
  // Catalog totals per skill: one record per level plus the cumulative total over the whole roadmap.
  // Kana (the Foundation lessons) is counted under N5, the level it leads into, and in the total.
  const stats = contentStats();
  const kana = getFoundation().length;
  const byLevel = {} as Record<Level, Record<Skill, number>>;
  const totals: Record<Skill, number> = { kana, grammar: 0, vocabulary: 0, kanji: 0, reading: 0, listening: 0 };
  for (const level of LEVELS) byLevel[level] = { kana: level === "n5" ? kana : 0, grammar: 0, vocabulary: 0, kanji: 0, reading: 0, listening: 0 };
  for (const p of stats.per) {
    const t = byLevel[p.level];
    t.grammar = p.grammar;
    t.vocabulary = p.vocabulary;
    t.kanji = p.kanji;
    t.reading = p.reading;
    t.listening = p.listening;
    totals.grammar += p.grammar;
    totals.vocabulary += p.vocabulary;
    totals.kanji += p.kanji;
    totals.reading += p.reading;
    totals.listening += p.listening;
  }
  return (
    <Container wide>
      <PageTitle eyebrow="My learning" title="Progress" description="How far you are through the roadmap, skill by skill, and how your study time and accuracy change week to week." />
      <ProgressClient totals={totals} totalsByLevel={byLevel} />
    </Container>
  );
}
