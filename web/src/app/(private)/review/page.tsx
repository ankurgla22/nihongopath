import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { adminConfigured, adminDb } from "@/lib/firebase/admin";
import { getQuestionIndex, resolveContentId } from "@/lib/content";
import { packQuestionIndex } from "@/lib/questions/pack";
import { Container } from "@/components/ui";
import { ReviewClient } from "@/components/review/ReviewClient";
import { levelForPhase, questionLevelsUpTo, type ContentLinks } from "@/components/study/helpers";
import { phaseForDay } from "@/lib/engine/progress";
import { readCurrentDay } from "@/lib/study/currentDay";
import { getCurriculum } from "@/lib/content";

export const metadata = pageMetadata({
  title: "Review queue",
  description: "Items due for spaced-repetition review and a review session built from your mistakes.",
  path: "/review",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/** Content ids currently in the learner's review queue (privileged read; empty when unavailable). */
async function queuedContentIds(uid: string): Promise<string[]> {
  if (!adminConfigured()) return [];
  try {
    const snap = await adminDb().collection("users").doc(uid).collection("reviewItems").get();
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

export default async function ReviewPage() {
  const user = await requireUser("/review");
  // Ship a packed slim index of the levels the learner has reached (full records are fetched on
  // demand); unknown day keeps every level. Only the queued items' links are pre-resolved; QuizRunner
  // resolves links for wrong answers on demand.
  const day = await readCurrentDay(user.uid);
  const phase = day === null ? undefined : phaseForDay(day, getCurriculum().phases);
  const levels = phase ? questionLevelsUpTo(levelForPhase(phase.id)) : null;
  const questionIndex = packQuestionIndex(levels ? getQuestionIndex().filter((q) => levels.includes(q.level)) : getQuestionIndex());
  const links: ContentLinks = {};
  const add = (id: string) => {
    if (links[id]) return;
    const r = resolveContentId(id);
    if (r) links[id] = r;
  };
  for (const id of await queuedContentIds(user.uid)) add(id);

  return (
    <Container wide>
      <ReviewClient questionIndex={questionIndex} contentLinks={links} />
    </Container>
  );
}
