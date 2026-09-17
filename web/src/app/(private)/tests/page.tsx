import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { getCurriculum, getQuestionIndex, resolveContentId } from "@/lib/content";
import { questionContentIds } from "@/lib/engine/scoring";
import { Container } from "@/components/ui";
import { TestsHubClient } from "@/components/study/TestsHubClient";
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

  return (
    <Container wide>
      <TestsHubClient questionIndex={questionIndex} contentLinks={links} phases={phases} />
    </Container>
  );
}
