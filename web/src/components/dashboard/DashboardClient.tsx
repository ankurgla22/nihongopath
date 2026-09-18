"use client";
/**
 * Logged-in home: 180-day progress, streak, study time, today's status and the weekly review
 * card (tasks.md §19, §25). Flushes any locally queued results on mount.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { todayISO, SKILLS, type DailyProgressDoc, type QuizResultDoc, type ReviewItemDoc, type Skill } from "@/lib/firestore/types";
import { getDaily, listDaily, listQuizResults } from "@/lib/firestore/repo";
import { dueReviews, flushPending } from "@/lib/study/service";
import { recommendations, skillLabel, weakSkills } from "@/lib/engine/dailyPlan";
import { CURRICULUM_DAYS, curriculumDayFor, phaseForDay } from "@/lib/engine/progress";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Button, Callout, Card, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { Ring, SkillGlyph } from "@/components/progress/shared";
import { addDaysISO, pct } from "@/components/study/helpers";

export type DaySummary = { day: number; phase: number; title: string; taskTypes: string[]; plannedMinutes: number };
type PhaseSummary = { id: number; name: string; startDay: number; endDay: number };

type Props = { sessionName: string | null; days: DaySummary[]; phases: PhaseSummary[] };

function hours(minutes: number): string {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1)} h`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function accuracyTone(a: number): "ok" | "accent" | "info" {
  return a >= 0.8 ? "ok" : a >= 0.6 ? "info" : "accent";
}

function Flame({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="currentColor" aria-hidden>
      <path d="M13.5 2c.5 3.5-1.5 5-2.5 6.5C9.6 10.6 9 12 9 13.5a3 3 0 0 0 6 0c0-1-.4-1.8-1-2.5 2.7 1 4 3.3 4 6a6 6 0 0 1-12 0c0-3.3 1.5-5.5 3-7.5C10.7 7.6 12.5 5.5 13.5 2Z" />
    </svg>
  );
}

function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton inline-block align-middle ${className}`} aria-hidden />;
}

export function DashboardClient({ sessionName, days, phases }: Props) {
  const { user } = useAuth();
  const { userDoc, loading, error } = useUserDoc();
  const today = todayISO();

  const [synced, setSynced] = useState(0);
  const [due, setDue] = useState<ReviewItemDoc[] | null>(null);
  const [todayDoc, setTodayDoc] = useState<DailyProgressDoc | null>(null);
  const [week, setWeek] = useState<DailyProgressDoc[]>([]);
  const [recent, setRecent] = useState<QuizResultDoc[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** True once daily history has been fetched; false while unknown so the first-visit hero never flashes for returning users. */
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  // Greeting and date depend on the visitor's clock and locale: fill them in after hydration.
  const [clock, setClock] = useState<{ greeting: string; dateLabel: string } | null>(null);
  useEffect(() => {
    setClock({ greeting: greeting(), dateLabel: new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) });
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const n = await flushPending(user.uid).catch(() => 0);
      if (alive && n > 0) setSynced(n);
      const weekStart = addDaysISO(today, -6);
      const [d, t, list, results] = await Promise.all([
        dueReviews(user.uid).catch(() => [] as ReviewItemDoc[]),
        getDaily(user.uid, today).catch(() => null),
        listDaily(user.uid, 14).catch((e: unknown) => {
          setLoadError(e instanceof Error ? e.message : "Could not load your study history.");
          return [] as DailyProgressDoc[];
        }),
        listQuizResults(user.uid, 5).catch(() => [] as QuizResultDoc[]),
      ]);
      if (!alive) return;
      setDue(d);
      setTodayDoc(t);
      setWeek(list.filter((x) => x.date >= weekStart && x.date <= today));
      setRecent(results);
      // A plan doc created by merely opening Daily study is not history; only logged minutes or finished tasks count.
      setHasHistory(list.some((x) => x.minutes > 0 || x.completedTaskIds.length > 0) || results.length > 0);
      setHistoryLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [user, today]);

  const currentDay = userDoc ? curriculumDayFor(userDoc) : 1;
  const phase = phaseForDay(currentDay, phases);
  const daySummary = days.find((d) => d.day === currentDay);
  const percent = Math.round((Math.max(0, currentDay - 1) / CURRICULUM_DAYS) * 100);

  const plannedCount = todayDoc?.plannedTasks.length ?? daySummary?.taskTypes.length ?? 0;
  const completedCount = todayDoc?.completedTaskIds.length ?? 0;
  const todayMinutes = todayDoc?.minutes ?? 0;

  const weekly = useMemo(() => {
    const acc: Partial<Record<Skill, { correct: number; total: number }>> = {};
    let minutes = 0;
    let lessons = 0;
    let daysStudied = 0;
    for (const d of week) {
      minutes += d.minutes;
      if (d.minutes > 0 || d.completedTaskIds.length > 0) daysStudied++;
      const byId = new Map(d.plannedTasks.map((t) => [t.id, t.type]));
      for (const id of d.completedTaskIds) {
        const type = byId.get(id) ?? id.split("-").slice(2).join("-");
        if ((SKILLS as string[]).includes(type)) lessons++;
      }
      for (const [s, v] of Object.entries(d.accuracyBySkill)) {
        const prev = acc[s as Skill] ?? { correct: 0, total: 0 };
        acc[s as Skill] = { correct: prev.correct + (v?.correct ?? 0), total: prev.total + (v?.total ?? 0) };
      }
    }
    return { acc, minutes, lessons, daysStudied };
  }, [week]);

  const weak = userDoc ? weakSkills(userDoc) : [];
  const recs = userDoc ? recommendations(userDoc, recent) : [];
  const weeklyTestToday = todayDoc?.plannedTasks.some((t) => t.type === "weekly-test") || daySummary?.taskTypes.includes("weekly-test");
  const weeklyTestTaskId = todayDoc?.plannedTasks.find((t) => t.type === "weekly-test")?.id;
  const name = userDoc?.displayName || sessionName || user?.displayName || "learner";
  const streak = userDoc?.streak ?? 0;
  // First visit: nothing studied yet. Show a single "Start Day 1" hero and hide the empty history widgets.
  const firstVisit = !loading && historyLoaded && !hasHistory && currentDay === 1 && (userDoc?.totalStudyMinutes ?? 0) === 0 && (userDoc?.totalLessonsCompleted ?? 0) === 0;
  const day1 = days.find((d) => d.day === 1);

  const quickActions = [
    { href: "/review", type: "review", title: "Review mistakes", hint: due === null ? "Loading queue…" : due.length === 0 ? "Nothing due" : `${due.length} due today`, tone: due && due.length > 0 ? ("warn" as const) : ("neutral" as const) },
    { href: "/tests", type: "test", title: "Take a test", hint: "Daily quiz, weekly & level tests", tone: "neutral" as const },
    { href: "/mock-exams", type: "mock-exam", title: "Mock exams", hint: "Full-length JLPT-style, scaled scores", tone: "neutral" as const },
    { href: "/progress", type: "other", title: "View progress", hint: "Skills, memory status, weekly chart", tone: "neutral" as const },
  ];

  return (
    <div className="pb-16">
      {/* Greeting */}
      <header className="pt-10 pb-6 animate-rise">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{clock?.dateLabel ?? "\u00a0"}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h1">
            {clock?.greeting ?? "Welcome back"}, {name}
          </h1>
          {streak >= 1 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-warn-soft px-3 h-9 text-sm font-semibold tabular-nums text-warn" aria-label={`Streak ${streak} days`}>
              <Flame />
              {streak} day{streak === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="mt-2 text-muted">
          {firstVisit ? "Welcome. Your first session is ready — everything else on this page fills in as you study." : "Pick up where you left off. Your plan adapts to what you get right and wrong."}
        </p>
      </header>

      {error && (
        <div className="mb-4">
          <Callout tone="warn">{error}</Callout>
        </div>
      )}
      {loadError && (
        <div className="mb-4">
          <Callout tone="warn">{loadError}</Callout>
        </div>
      )}
      {synced > 0 && (
        <div className="mb-4">
          <Callout tone="ok">
            Synced {synced} saved result{synced === 1 ? "" : "s"} that were waiting for a connection.
          </Callout>
        </div>
      )}

      {/* Hero */}
      {firstVisit ? (
        <Card className="animate-rise relative overflow-hidden" padding="p-5 sm:p-7">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-soft opacity-70 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Your first session</p>
            <h2 className="mt-1.5 text-h2">
              Start Day 1{day1 ? <> — {day1.title.replace(/^Day 1 — /, "")}</> : null}
              {day1 && day1.plannedMinutes > 0 && <span className="text-muted font-normal"> (about {day1.plannedMinutes} min)</span>}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted">
              Day 1 of {CURRICULUM_DAYS}. Open the lesson, work through it at your own pace, then take the short daily quiz at the end. You can jump to a later day any time if you already know some Japanese.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button href="/daily-study" size="lg">
                Start Day 1
                <Arrow />
              </Button>
              <Button variant="secondary" size="lg" href="/japanese">
                See the whole path
              </Button>
            </div>
          </div>
        </Card>
      ) : (
      <Card className="animate-rise relative overflow-hidden" padding="p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-soft opacity-70 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Ring value={loading ? 0 : percent} size={136} stroke={11} label="180-day journey">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Day</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight leading-none mt-0.5">{loading ? "…" : currentDay}</p>
              <p className="text-xs text-muted mt-0.5">/ {CURRICULUM_DAYS}</p>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Today</p>
              {phase && (
                <Badge tone="accent">
                  Phase {phase.id} · {phase.name}
                </Badge>
              )}
              {todayDoc?.completed && <Badge tone="ok">Done for today</Badge>}
            </div>
            <h2 className="mt-1.5 text-h2">
              Day {loading ? "…" : currentDay} <span className="text-muted font-normal">/ {CURRICULUM_DAYS}</span>
            </h2>
            {daySummary && <p className="mt-1 text-ink-2">{daySummary.title}</p>}
            <p className="mt-2 text-sm text-muted">
              {plannedCount > 0 ? (
                <>
                  {completedCount} of {plannedCount} tasks completed
                  {todayMinutes > 0 && <> · {todayMinutes} min logged</>}
                </>
              ) : (
                "No plan built yet for today — open Daily study to generate it."
              )}
              {" · "}
              {percent}% of the journey behind you
            </p>
            {plannedCount > 0 && (
              <div className="mt-3 max-w-md">
                <ProgressBar value={(completedCount / plannedCount) * 100} size="sm" tone={todayDoc?.completed ? "ok" : "accent"} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button href="/daily-study" size="lg">
                {todayDoc?.completed ? "Open today's plan" : `Continue Day ${loading ? "…" : currentDay}`}
                <Arrow />
              </Button>
              {weeklyTestToday && (
                <Button variant="secondary" size="lg" href={weeklyTestTaskId ? `/daily-study#task-${weeklyTestTaskId}` : "/daily-study"}>
                  Take this week&apos;s test
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
      )}

      {/* Stat row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-rise-2">
        <Stat label="Streak" value={loading ? <Sk className="h-7 w-16" /> : <>{streak}<span className="text-base font-normal text-muted"> days</span></>} hint={userDoc && userDoc.longestStreak > 0 ? `best ${userDoc.longestStreak}` : "study daily to build it"} tone={streak > 0 ? "accent" : "neutral"} />
        <Stat label="Study time" value={loading ? <Sk className="h-7 w-16" /> : hours(userDoc?.totalStudyMinutes ?? 0)} hint={`${hours(weekly.minutes)} this week`} />
        <Stat label="Lessons" value={loading ? <Sk className="h-7 w-16" /> : (userDoc?.totalLessonsCompleted ?? 0)} hint={`${weekly.lessons} this week`} />
        <Stat label="Due reviews" value={due === null ? <Sk className="h-7 w-16" /> : due.length} hint={due && due.length > 0 ? "waiting in your queue" : "queue is clear"} tone={due && due.length > 0 ? "accent" : "ok"} />
      </div>

      {/* Quick actions */}
      <section className="mt-6 animate-rise-3" aria-label="Quick actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} className="group surface surface-hover rounded-2xl p-4 flex items-center gap-3 focus:outline-none focus-visible:shadow-ring">
              <SkillGlyph type={a.type} tone={a.tone} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-sm">{a.title}</span>
                <span className="block text-xs text-muted truncate">{a.hint}</span>
              </span>
              <Arrow className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          ))}
        </div>
      </section>

      {firstVisit ? (
        <p className="mt-6 text-sm text-muted">After your first session you&apos;ll see your weekly review here.</p>
      ) : (
      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Weekly review */}
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h2">Weekly review</h2>
            <span className="text-xs text-muted">last 7 days</span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              { k: "Lessons", v: String(weekly.lessons) },
              { k: "Study time", v: hours(weekly.minutes) },
              { k: "Days studied", v: `${weekly.daysStudied} / 7` },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-surface-2 border border-line/60 p-3">
                <dt className="text-[11px] uppercase tracking-wider text-muted">{x.k}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{x.v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-5 text-sm font-semibold">Accuracy by skill</h3>
          <ul className="mt-2 space-y-2.5">
            {SKILLS.map((s) => {
              const v = weekly.acc[s];
              const has = v && v.total > 0;
              const ratio = has ? v.correct / v.total : 0;
              return (
                <li key={s} className="flex items-center gap-3">
                  <SkillGlyph type={s} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{skillLabel(s)}</span>
                      <span className="text-muted tabular-nums text-xs">{has ? `${pct(ratio)} · ${v.correct}/${v.total}` : "no questions yet"}</span>
                    </div>
                    <ProgressBar value={ratio * 100} size="sm" tone={accuracyTone(ratio)} />
                  </div>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-5 text-sm font-semibold">Weak areas</h3>
          {weak.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {weak.map((s) => (
                <Badge key={s} tone="warn" size="md">
                  {skillLabel(s)} · {pct(userDoc?.skillAccuracy?.[s] ?? 0)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted">None flagged yet — keep taking the daily quizzes.</p>
          )}

          {recs.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Recommended review</h3>
              <ul className="mt-2 space-y-1.5">
                {recs.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink-2">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Recent tests */}
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h2">Recent tests</h2>
            <Link href="/tests/history" className="text-sm text-accent hover:underline">
              All history
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No tests yet" action={<Button href="/tests" variant="secondary" size="sm">Take a test</Button>}>
                Your daily quizzes and tests will show up here.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recent.slice(0, 5).map((r) => {
                const ratio = r.total > 0 ? r.score / r.total : 0;
                return (
                  <li key={r.id}>
                    <Link href={`/tests/history/${encodeURIComponent(r.id)}`} className="group flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-surface-2 transition">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="block text-xs text-muted">{r.kind}</span>
                      </span>
                      <Badge tone={ratio >= 0.8 ? "ok" : ratio < 0.6 ? "warn" : "neutral"}>
                        {r.score}/{r.total}
                      </Badge>
                      <Arrow className="text-muted group-hover:text-accent" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-semibold">Mock exams</p>
            <p className="text-xs text-muted mt-0.5">Full-length JLPT-style exams with scaled scores.</p>
            <Link href="/mock-exams/history" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
              My exam history <Arrow />
            </Link>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
