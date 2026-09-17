import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { getCurriculum, getQuestionIndex, resolveContentId } from "@/lib/content";
import { questionContentIds } from "@/lib/engine/scoring";
import { CURRICULUM_DAYS } from "@/lib/engine/progress";
import { Container } from "@/components/ui";
import { DailyStudyClient } from "@/components/study/DailyStudyClient";
import { levelForPhase, questionLevelsUpTo, type ContentLinks } from "@/components/study/helpers";
import { readCurrentDay } from "@/lib/study/currentDay";

export const metadata = pageMetadata({
  title: "Daily study",
  description: "Today's Japanese study plan: grammar, vocabulary, kanji, reading, listening, review and a mini test.",
  path: "/daily-study",
  noIndex: true,
});

export const dynamic = "force-dynamic";

function clampDay(n: number): number {
  return Math.max(1, Math.min(CURRICULUM_DAYS, Math.floor(n)));
}

export default async function DailyStudyPage({ searchParams }: { searchParams?: { day?: string } }) {
  const user = await requireUser("/daily-study");
  const curriculum = getCurriculum();

  const param = Number(searchParams?.day);
  const stored = await readCurrentDay(user.uid);
  const day = clampDay(Number.isFinite(param) && param > 0 ? param : stored ?? 1);
  const cday = curriculum.days.find((d) => d.day === day) ?? curriculum.days[0];
  const phase = curriculum.phases.find((p) => day >= p.startDay && day <= p.endDay);

  // Only a slim index (id/level/skill/difficulty/tags) of the banks the client can draw from is
  // shipped; the client picks ids and fetches the full records on demand from /api/content/questions.
  const levels = questionLevelsUpTo(levelForPhase(cday.phase));
  const questionIndex = getQuestionIndex().filter((q) => levels.includes(q.level));
  const links: ContentLinks = {};
  const add = (id: string) => {
    if (links[id]) return;
    const r = resolveContentId(id);
    if (r) links[id] = r;
  };
  for (const t of cday.tasks) for (const id of t.contentIds) add(id);
  for (const q of questionIndex) for (const id of questionContentIds(q)) add(id);

  return (
    <Container wide>
      <DailyStudyClient
        key={cday.day}
        day={cday}
        phase={phase ? { id: phase.id, name: phase.name } : { id: cday.phase, name: `Phase ${cday.phase}` }}
        questionIndex={questionIndex}
        contentLinks={links}
        sessionName={user.name}
      />
    </Container>
  );
}
