"use client";
/**
 * "Take a test" hub: daily quiz, weekly test, phase test and practice by skill.
 * Each launches the QuizRunner and saves through completeQuiz with the right kind.
 */
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Level, PackedQuestionIndex, Question } from "@/lib/content/schemas";
import { SKILLS, todayISO, type QuizKind, type Skill } from "@/lib/firestore/types";
import { completeQuiz } from "@/lib/study/service";
import { skillLabel } from "@/lib/engine/dailyPlan";
import { hashSeed, mulberry32, shuffle, type SubmittedAnswer } from "@/lib/engine/scoring";
import { curriculumDayFor, phaseForDay } from "@/lib/engine/progress";
import { fetchDrill, fetchQuestionsByIds } from "@/lib/questions/client";
import { unpackQuestionIndex } from "@/lib/questions/pack";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Button, Callout, Card, PageTitle } from "@/components/ui";
import { LoadingState, SkillGlyph } from "@/components/progress/shared";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { levelForPhase, pickWithFallback, questionLevelsUpTo, type ContentLinks } from "./helpers";

type PhaseSummary = { id: number; name: string; startDay: number; endDay: number };
/** Per level, the id suffixes of every vocabulary word ("12" for n5-vocab-12) and kanji ("一" for n5-kanji-一). */
export type DrillPool = Partial<Record<Level, { vocab: string[]; kanji: string[] }>>;
/** `questionIndex` is the packed slim bank (id/level/skill/difficulty/content ids); full records are fetched on demand. */
type Props = { questionIndex: PackedQuestionIndex; contentLinks: ContentLinks; phases: PhaseSummary[]; drillPool?: DrillPool };

const DRILL_COUNT = 20;

type Launch = {
  key: string;
  kind: QuizKind;
  title: string;
  mode: "practice" | "test";
  /** Picked bank question ids (kept so a retry fetches the same set). */
  ids: string[];
  /** For drills: vocabulary/kanji content ids generated on the fly with `seed` instead of bank ids. */
  drill?: { contentIds: string[]; seed: string };
  status: "loading" | "ready" | "error";
  questions: Question[];
};

export function TestsHubClient({ questionIndex: packedIndex, contentLinks, phases, drillPool = {} }: Props) {
  const questionIndex = useMemo(() => unpackQuestionIndex(packedIndex), [packedIndex]);
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
      const full = base.drill ? await fetchDrill(base.drill.contentIds, { seed: base.drill.seed, perItem: 1 }) : await fetchQuestionsByIds(base.ids);
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

  // A drill picks 20 random words/kanji of the current level (any level with content when the pool is
  // missing this one) and generates one question each, so every item in the catalogue is reachable.
  const drillLevel: Level | null = drillPool[level] ? level : ((Object.keys(drillPool) as Level[]).at(-1) ?? null);
  const drillPoolFor = (kind: "vocab" | "kanji") => (drillLevel ? (drillPool[drillLevel]?.[kind] ?? []) : []);
  const startDrill = (kind: "vocab" | "kanji") => {
    if (!user || !drillLevel) return;
    const key = `drill-${kind}`;
    const seed = `${user.uid}-${today}-${key}-${Date.now()}`;
    const rand = mulberry32(hashSeed(seed));
    const contentIds = shuffle(drillPoolFor(kind).slice(), rand)
      .slice(0, DRILL_COUNT)
      .map((s) => `${drillLevel}-${kind}-${s}`);
    const title = `${kind === "kanji" ? "Kanji" : "Vocabulary"} drill · ${drillLevel.toUpperCase()}`;
    void loadLaunch({ key, kind: "practice", title, mode: "practice", ids: [], drill: { contentIds, seed } });
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

  const actions = <Button onClick={close}>Back to tests</Button>;

  const tests = [
    {
      key: "daily",
      type: "quiz",
      title: "Daily quiz",
      desc: "10 questions · instant feedback",
      cta: "Start daily quiz",
      primary: true,
      onStart: () => start("daily", "daily", "Daily quiz", "practice", 10),
    },
    {
      key: "weekly",
      type: "weekly-test",
      title: "Weekly test",
      desc: "25 questions · exam style, feedback at the end",
      cta: "Start weekly test",
      primary: false,
      onStart: () => start("weekly", "weekly", "Weekly test", "test", 25),
    },
    {
      key: "phase",
      type: "phase-test",
      title: `Level test (${level.toUpperCase()})`,
      desc: "40 questions · all five skills, exam style",
      cta: "Start level test",
      primary: false,
      onStart: () => start("phase", "phase", `Level test (${level.toUpperCase()})`, "test", 40),
    },
  ];

  return (
    <div className="pb-16">
      <PageTitle title="Take a test" />
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
          {/* Three test rows; only the daily quiz is filled. */}
          <Card padding="p-0" className="overflow-hidden animate-rise">
            <ul className="divide-y divide-line">
              {tests.map((t) => (
                <li key={t.key} className="flex flex-wrap items-center gap-3 sm:gap-4 p-4 sm:px-5">
                  <SkillGlyph type={t.type} tone={t.primary ? "accent" : "neutral"} />
                  <div className="min-w-0 flex-1 basis-48">
                    <h2 className="font-semibold">{t.title}</h2>
                    <p className="text-xs text-muted">{t.desc}</p>
                  </div>
                  <Button onClick={t.onStart} disabled={!ready} variant={t.primary ? "primary" : "outline"}>
                    {t.cta} <Arrow />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="mt-4 animate-rise-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h2">Practice quiz by skill</h2>
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

          <Card className="mt-4 animate-rise-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h2">Drills</h2>
              <span className="text-xs text-muted">{DRILL_COUNT} random items{drillLevel ? ` from ${drillLevel.toUpperCase()}` : ""}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { kind: "vocab", skill: "vocabulary", label: "Vocabulary drill", hint: "meaning or reading of a word" },
                  { kind: "kanji", skill: "kanji", label: "Kanji drill", hint: "meaning of a kanji or reading of a word using it" },
                ] as const
              ).map((d) => {
                const n = drillPoolFor(d.kind).length;
                return (
                  <button
                    key={d.kind}
                    type="button"
                    onClick={() => startDrill(d.kind)}
                    disabled={!ready || n === 0}
                    className="group surface surface-hover flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:shadow-ring"
                  >
                    <SkillGlyph type={d.skill} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">{d.label}</span>
                      <span className="block text-xs text-muted">{d.hint}</span>
                    </span>
                    <Arrow className="text-muted group-hover:text-accent" />
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="mt-6 text-sm">
            <Link href="/tests/history" className="inline-flex items-center gap-1 text-accent hover:underline">
              Test history <Arrow className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
