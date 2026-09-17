"use client";
/**
 * "Take a test" hub: daily quiz, weekly test, phase test and practice by skill.
 * Each launches the QuizRunner and saves through completeQuiz with the right kind.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import type { Question, QuestionIndexEntry } from "@/lib/content/schemas";
import { SKILLS, todayISO, type QuizKind, type Skill } from "@/lib/firestore/types";
import { completeQuiz } from "@/lib/study/service";
import { skillLabel } from "@/lib/engine/dailyPlan";
import type { SubmittedAnswer } from "@/lib/engine/scoring";
import { curriculumDayFor, phaseForDay } from "@/lib/engine/progress";
import { fetchQuestionsByIds } from "@/lib/questions/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Button, Callout, Card, PageTitle } from "@/components/ui";
import { LoadingState, SkillGlyph } from "@/components/progress/shared";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { levelForPhase, pickWithFallback, questionLevelsUpTo, type ContentLinks } from "./helpers";

type PhaseSummary = { id: number; name: string; startDay: number; endDay: number };
/** `questionIndex` is the slim bank (id/level/skill/difficulty/tags); full records are fetched on demand. */
type Props = { questionIndex: QuestionIndexEntry[]; contentLinks: ContentLinks; phases: PhaseSummary[] };

type Launch = {
  key: string;
  kind: QuizKind;
  title: string;
  mode: "practice" | "test";
  /** Picked ids (kept so a retry fetches the same set). */
  ids: string[];
  status: "loading" | "ready" | "error";
  questions: Question[];
};

export function TestsHubClient({ questionIndex, contentLinks, phases }: Props) {
  const { user } = useAuth();
  const { userDoc, loading, error, refresh } = useUserDoc();
  const today = todayISO();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const launchToken = useRef(0);

  const currentDay = userDoc ? curriculumDayFor(userDoc) : 1;
  const phase = phaseForDay(currentDay, phases);
  const phaseId = phase?.id ?? 1;
  const level = levelForPhase(phaseId);
  const levels = questionLevelsUpTo(level);
  const ready = Boolean(user) && !loading;

  const loadLaunch = async (base: Omit<Launch, "status" | "questions">) => {
    const token = ++launchToken.current;
    setLaunch({ ...base, status: "loading", questions: [] });
    try {
      const full = await fetchQuestionsByIds(base.ids);
      if (token !== launchToken.current) return;
      setLaunch({ ...base, status: "ready", questions: full });
    } catch {
      if (token !== launchToken.current) return;
      setLaunch({ ...base, status: "error", questions: [] });
    }
  };

  const start = (key: string, kind: QuizKind, title: string, mode: "practice" | "test", count: number, skills?: Skill[]) => {
    if (!user) return;
    const seed = `${user.uid}-${today}-${key}-${Date.now()}`;
    const picked = pickWithFallback(questionIndex, { count, levels, skills, seed });
    void loadLaunch({ key, kind, title, mode, ids: picked.map((q) => q.id) });
  };

  const close = () => {
    launchToken.current++;
    setLaunch(null);
  };

  const onComplete = async (answers: SubmittedAnswer[], seconds: number) => {
    if (!user || !launch) return;
    await completeQuiz({
      uid: user.uid,
      kind: launch.kind,
      title: launch.title,
      questions: launch.questions,
      answers,
      seconds,
      curriculumDay: currentDay,
    });
    await refresh();
  };

  const actions = (
    <>
      <Button onClick={close}>Back to tests</Button>
      <Button variant="secondary" href="/tests/history">
        Test history
      </Button>
    </>
  );

  const tests = [
    {
      key: "daily",
      type: "quiz",
      title: "Daily quiz",
      desc: "10 questions with instant explanations. Good for a quick check of today's material.",
      meta: ["10 questions", "practice"],
      cta: "Start daily quiz",
      onStart: () => start("daily", "daily", "Daily quiz", "practice", 10),
    },
    {
      key: "weekly",
      type: "weekly-test",
      title: "Weekly test",
      desc: "25 questions, exam-style: no feedback until the end. Mixed skills at your level.",
      meta: ["25 questions", "test mode"],
      cta: "Start weekly test",
      onStart: () => start("weekly", "weekly", "Weekly test", "test", 25),
    },
    {
      key: "phase",
      type: "phase-test",
      title: `Phase ${phaseId} test`,
      desc: `40 questions across grammar, vocabulary, kanji, reading and listening for ${phase?.name ?? `Phase ${phaseId}`} (${levels.filter((l) => l !== "foundation").map((l) => l.toUpperCase()).join(", ")}).`,
      meta: ["40 questions", "test mode"],
      cta: "Start phase test",
      onStart: () => start("phase", "phase", `Phase ${phaseId} test`, "test", 40),
    },
  ];

  return (
    <div className="pb-16">
      <PageTitle
        eyebrow="Practice & tests"
        title="Take a test"
        description={`Questions are drawn from ${level.toUpperCase()} and below (your current level, Day ${currentDay}). Every result updates your progress and review queue.`}
        actions={
          <Button href="/tests/history" variant="secondary" size="sm">
            Test history
          </Button>
        }
      />
      {error && (
        <div className="mb-4">
          <Callout tone="warn">{error}</Callout>
        </div>
      )}

      {launch && launch.status === "loading" ? (
        <LoadingState label={`Loading ${launch.title.toLowerCase()}…`} rows={3} />
      ) : launch && launch.status === "error" ? (
        <div className="space-y-3 animate-rise">
          <Callout tone="warn">Could not load the questions. Check your connection and try again.</Callout>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void loadLaunch(launch)}>Retry</Button>
            <Button variant="secondary" onClick={close}>
              Back to tests
            </Button>
          </div>
        </div>
      ) : launch ? (
        <QuizRunner
          key={launch.key}
          questions={launch.questions}
          title={launch.title}
          mode={launch.mode}
          storageKey={`nihongo-path:quiz:${user?.uid ?? "anon"}:${today}:${launch.key}`}
          contentLinks={contentLinks}
          onComplete={onComplete}
          onExit={close}
          resultActions={actions}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 animate-rise">
            {tests.map((t) => (
              <Card key={t.key} hover className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <SkillGlyph type={t.type} size="lg" tone="accent" />
                  <div className="flex flex-wrap justify-end gap-1">
                    {t.meta.map((m) => (
                      <Badge key={m}>{m}</Badge>
                    ))}
                  </div>
                </div>
                <h2 className="mt-4 text-h2">{t.title}</h2>
                <p className="mt-1.5 text-sm text-muted flex-1">{t.desc}</p>
                <div className="mt-5">
                  <Button onClick={t.onStart} disabled={!ready} className="w-full sm:w-auto">
                    {t.cta} <Arrow />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-4 animate-rise-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h2">Practice by skill</h2>
              <span className="text-xs text-muted">10 questions · explanations after each answer</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {SKILLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => start(`practice-${s}`, "practice", `${skillLabel(s)} practice`, "practice", 10, [s])}
                  disabled={!ready}
                  className="group surface surface-hover flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:shadow-ring"
                >
                  <SkillGlyph type={s} />
                  <span className="flex-1 font-medium">{skillLabel(s)}</span>
                  <Arrow className="text-muted group-hover:text-accent" />
                </button>
              ))}
            </div>
          </Card>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/tests/history" className="inline-flex items-center gap-1 text-accent hover:underline">
              Test history <Arrow className="h-3.5 w-3.5" />
            </Link>
            <Link href="/mock-exams/history" className="inline-flex items-center gap-1 text-accent hover:underline">
              Mock exam history <Arrow className="h-3.5 w-3.5" />
            </Link>
            <Link href="/daily-study" className="inline-flex items-center gap-1 text-accent hover:underline">
              Today&apos;s plan <Arrow className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
