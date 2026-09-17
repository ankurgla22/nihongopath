import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { contentStats, getFoundation } from "@/lib/content";
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
  // Catalog totals per skill, cumulative over N5..N2 (the whole 180-day roadmap).
  const stats = contentStats();
  const totals: Record<Skill, number> = { kana: getFoundation().length, grammar: 0, vocabulary: 0, kanji: 0, reading: 0, listening: 0 };
  for (const p of stats.per) {
    totals.grammar += p.grammar;
    totals.vocabulary += p.vocabulary;
    totals.kanji += p.kanji;
    totals.reading += p.reading;
    totals.listening += p.listening;
  }
  return (
    <Container wide>
      <PageTitle eyebrow="My learning" title="Progress" description="How far you are through the roadmap, skill by skill, and how your study time and accuracy change week to week." />
      <ProgressClient totals={totals} />
    </Container>
  );
}
