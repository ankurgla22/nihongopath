import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { getCurriculum, getKanji, getQuestionIndex, getVocabulary, resolveContentId } from "@/lib/content";
import { LEVELS } from "@/lib/content/schemas";
import { questionContentIds } from "@/lib/engine/scoring";
import { Container } from "@/components/ui";
import { TestsHubClient, type DrillPool } from "@/components/study/TestsHubClient";
import { levelForPhase, questionLevelsUpTo, type ContentLinks } from "@/components/study/helpers";
import { phaseForDay } from "@/lib/engine/progress";
import { readCurrentDay } from "@/lib/study/currentDay";

export const metadata = pageMetadata({
  title: "Take a test",
  description: "Daily quiz, weekly test, phase test and practice by skill — every result is saved to your progress.",
  path: "/tests",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const user = await requireUser("/tests");
  const curriculum = getCurriculum();
  // Ship a slim index of the levels the hub can draw from (full records are fetched on demand);
  // when the current day is unknown keep every level.
  const day = await readCurrentDay(user.uid);
  const phase = day === null ? undefined : phaseForDay(day, curriculum.phases);
  const levels = phase ? questionLevelsUpTo(levelForPhase(phase.id)) : null;
  const questionIndex = levels ? getQuestionIndex().filter((q) => levels.includes(q.level)) : getQuestionIndex();
  const links: ContentLinks = {};
  for (const q of questionIndex) {
    for (const id of questionContentIds(q)) {
      if (links[id]) continue;
      const r = resolveContentId(id);
      if (r) links[id] = r;
    }
  }
  const phases = curriculum.phases.map((p) => ({ id: p.id, name: p.name, startDay: p.startDay, endDay: p.endDay }));
  // Compact id lists for the vocabulary/kanji drills: only the id suffix per level ("12" for n5-vocab-12,
  // "一" for n5-kanji-一) so the whole catalogue costs a few tens of KB instead of shipping full ids or records.
  const drillLevels = levels ? LEVELS.filter((l) => (levels as string[]).includes(l)) : LEVELS;
  const drillPool: DrillPool = {};
  for (const l of drillLevels) {
    drillPool[l] = {
      vocab: getVocabulary(l).map((v) => v.id.replace(`${l}-vocab-`, "")),
      kanji: getKanji(l).map((k) => k.id.replace(`${l}-kanji-`, "")),
    };
  }

  return (
    <Container wide>
      <TestsHubClient questionIndex={questionIndex} contentLinks={links} phases={phases} drillPool={drillPool} />
    </Container>
  );
}
