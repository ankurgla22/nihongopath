"use client";
/**
 * Logged-in home: greeting, today's card, and (only once they have a value) streak / due reviews /
 * study time, the weekly review and recent tests (tasks.md §19, §25). Flushes any locally queued
 * results on mount.
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
import { Arrow, Badge, Button, Callout, Card, ProgressBar, Stat } from "@/components/ui";
import { SkillGlyph } from "@/components/progress/shared";
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
  // Greeting depends on the visitor's clock: fill it in after hydration.
  const [clock, setClock] = useState<{ greeting: string } | null>(null);
  useEffect(() => {
    setClock({ greeting: greeting() });
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

  const plannedCount = todayDoc?.plannedTasks.length ?? daySummary?.taskTypes.length ?? 0;
  const completedCount = todayDoc?.completedTaskIds.length ?? 0;
  const todayMinutes = todayDoc?.minutes ?? 0;

  const weekly = useMemo(() => {
    const acc: Partial<Record<Skill, { correct: number; total: number }>> = {};
    let minutes = 0;
    let lessons = 0;
    let daysStudied = 0;
    let completedDays = 0;
    for (const d of week) {
      minutes += d.minutes;
      if (d.minutes > 0 || d.completedTaskIds.length > 0) daysStudied++;
      if (d.completed) completedDays++;
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
    return { acc, minutes, lessons, daysStudied, completedDays };
  }, [week]);

  const weak = userDoc ? weakSkills(userDoc) : [];
  const recs = userDoc ? recommendations(userDoc, recent) : [];
  const weeklyTestToday = todayDoc?.plannedTasks.some((t) => t.type === "weekly-test") || daySummary?.taskTypes.includes("weekly-test");
  const weeklyTestTaskId = todayDoc?.plannedTasks.find((t) => t.type === "weekly-test")?.id;
  const name = userDoc?.displayName || sessionName || user?.displayName || "learner";
  const streak = userDoc?.streak ?? 0;
  const totalMinutes = userDoc?.totalStudyMinutes ?? 0;
  const dueCount = due?.length ?? 0;
  // First visit: nothing studied yet. Show a single "Start Day 1" card and nothing else.
  const firstVisit = !loading && historyLoaded && !hasHistory && currentDay === 1 && totalMinutes === 0 && (userDoc?.totalLessonsCompleted ?? 0) === 0;
  const day1 = days.find((d) => d.day === 1);

  // Stat tiles render only with a non-zero value (streak, due reviews, study time).
  const stats: { label: string; value: string; hint?: string; tone?: "neutral" | "accent" | "ok" }[] = [];
  if (!loading && streak > 0) stats.push({ label: "Streak", value: `${streak} day${streak === 1 ? "" : "s"}`, hint: userDoc && userDoc.longestStreak > streak ? `best ${userDoc.longestStreak}` : undefined, tone: "accent" });
  if (dueCount > 0) stats.push({ label: "Due reviews", value: String(dueCount), tone: "accent" });
  if (!loading && totalMinutes > 0) stats.push({ label: "Study time", value: hours(totalMinutes), hint: weekly.minutes > 0 ? `${hours(weekly.minutes)} this week` : undefined });

  const showWeekly = weekly.completedDays >= 1;
  const showRecent = recent.length >= 1;

  return (
    <div className="pb-16">
      {/* Greeting */}
      <header className="pt-10 pb-6 animate-rise">
        <h1 className="text-h1">
          {clock?.greeting ?? "Welcome back"}, {name}
        </h1>
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

      {/* Today */}
      {firstVisit ? (
        <Card className="animate-rise" padding="p-5 sm:p-7">
          <h2 className="text-h2">
            Start Day 1{day1 ? <> — {day1.title.replace(/^Day 1 — /, "")}</> : null}
            {day1 && day1.plannedMinutes > 0 && <span className="text-muted font-normal"> (about {day1.plannedMinutes} min)</span>}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted">Day 1 of {CURRICULUM_DAYS}. Open the lesson, then take the short daily quiz at the end.</p>
          <div className="mt-4">
            <Button href="/daily-study" size="lg">
              Start Day 1
              <Arrow />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="animate-rise" padding="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            {phase && <Badge tone="accent">Phase {phase.id} · {phase.name}</Badge>}
            {todayDoc?.completed && <Badge tone="ok">Done for today</Badge>}
          </div>
          <h2 className="mt-1.5 text-h2">
            Day {loading ? "…" : currentDay} <span className="text-muted font-normal">/ {CURRICULUM_DAYS}</span>
            {daySummary && <span className="text-muted font-normal"> — {daySummary.title.replace(/^Day \d+ — /, "")}</span>}
          </h2>
          {plannedCount > 0 && (
            <>
              <p className="mt-2 text-sm text-muted">
                {completedCount} of {plannedCount} tasks completed
                {todayMinutes > 0 && <> · {todayMinutes} min logged</>}
              </p>
              <div className="mt-3 max-w-md">
                <ProgressBar value={(completedCount / plannedCount) * 100} size="sm" tone={todayDoc?.completed ? "ok" : "accent"} />
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/daily-study" size="lg">
              {todayDoc?.completed ? "Open today's plan" : `Continue Day ${loading ? "…" : currentDay}`}
              <Arrow />
            </Button>
            {weeklyTestToday && (
              <Button variant="outline" size="lg" href={weeklyTestTaskId ? `/daily-study#task-${weeklyTestTaskId}` : "/daily-study"}>
                Take this week&apos;s test
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Stat tiles: only non-zero values */}
      {!firstVisit && stats.length > 0 && (
        <div className={`mt-4 grid grid-cols-2 gap-3 sm:gap-4 animate-rise-2 ${stats.length >= 3 ? "lg:grid-cols-3" : ""}`}>
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} hint={s.hint} tone={s.tone} />
          ))}
        </div>
      )}

      {!firstVisit && (showWeekly || showRecent) && (
        <div className={`mt-6 grid gap-4 ${showWeekly && showRecent ? "lg:grid-cols-[3fr_2fr]" : ""}`}>
          {/* Weekly review: only once at least one day was completed */}
          {showWeekly && (
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

              {SKILLS.some((s) => (weekly.acc[s]?.total ?? 0) > 0) && (
                <>
                  <h3 className="mt-5 text-sm font-semibold">Accuracy by skill</h3>
                  <ul className="mt-2 space-y-2.5">
                    {SKILLS.map((s) => {
                      const v = weekly.acc[s];
                      if (!v || v.total === 0) return null;
                      const ratio = v.correct / v.total;
                      return (
                        <li key={s} className="flex items-center gap-3">
                          <SkillGlyph type={s} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{skillLabel(s)}</span>
                              <span className="text-muted tabular-nums text-xs">
                                {pct(ratio)} · {v.correct}/{v.total}
                              </span>
                            </div>
                            <ProgressBar value={ratio * 100} size="sm" tone={accuracyTone(ratio)} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {weak.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-semibold">Weak areas</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {weak.map((s) => (
                      <Badge key={s} tone="warn" size="md">
                        {skillLabel(s)} · {pct(userDoc?.skillAccuracy?.[s] ?? 0)}
                      </Badge>
                    ))}
                  </div>
                </>
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
          )}

          {/* Recent tests: only once at least one exists */}
          {showRecent && (
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-h2">Recent tests</h2>
                <Link href="/tests/history" className="text-sm text-accent hover:underline">
                  All history
                </Link>
              </div>
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
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
