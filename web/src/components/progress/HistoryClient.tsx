"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Stat } from "@/components/ui";
import { listDaily, listQuizResults, listSessions } from "@/lib/firestore/repo";
import type { DailyProgressDoc, QuizResultDoc, StudySessionDoc } from "@/lib/firestore/types";
import { EmptyState, ErrorState, LoadingState, SignedOutState, SkillGlyph, errMessage, formatDate, formatMinutes, skillLabel, LinkCard } from "./shared";

type Row = {
  date: string;
  minutes: number;
  lessons: number;
  topics: string[];
  quiz: { correct: number; total: number; count: number } | null;
  completed: boolean;
};

const SKILL_ORDER = ["grammar", "vocabulary", "kanji", "reading", "listening", "review", "test"];

/** Merge daily docs, sessions and quiz results into one row per date, newest first. */
export function buildHistoryRows(daily: DailyProgressDoc[], sessions: StudySessionDoc[], quizzes: QuizResultDoc[]): Row[] {
  const rows = new Map<string, Row>();
  const get = (date: string) => {
    let r = rows.get(date);
    if (!r) {
      r = { date, minutes: 0, lessons: 0, topics: [], quiz: null, completed: false };
      rows.set(date, r);
    }
    return r;
  };
  const sessionMinutes = new Map<string, number>();
  const topics = new Map<string, Set<string>>();
  const lessons = new Map<string, Set<string>>();

  for (const s of sessions) {
    if (!s.date) continue;
    sessionMinutes.set(s.date, (sessionMinutes.get(s.date) ?? 0) + Math.max(0, s.minutes || 0));
    (topics.get(s.date) ?? topics.set(s.date, new Set()).get(s.date)!).add(s.skill);
    const l = lessons.get(s.date) ?? lessons.set(s.date, new Set()).get(s.date)!;
    for (const id of s.contentIds ?? []) l.add(id);
  }
  for (const d of daily) {
    const r = get(d.date);
    r.minutes = Math.max(0, d.minutes || 0);
    r.completed = !!d.completed;
    const t = topics.get(d.date) ?? topics.set(d.date, new Set()).get(d.date)!;
    if (t.size === 0) for (const task of d.plannedTasks ?? []) if (d.completedTaskIds?.includes(task.id)) t.add(task.type);
    if (!lessons.has(d.date)) {
      const l = new Set<string>();
      for (const task of d.plannedTasks ?? []) if (d.completedTaskIds?.includes(task.id)) for (const id of task.contentIds) l.add(id);
      lessons.set(d.date, l);
    }
  }
  for (const [date, m] of sessionMinutes) {
    const r = get(date);
    // Sessions are the source of truth when the daily doc has no minutes.
    if (r.minutes === 0) r.minutes = m;
  }
  for (const q of quizzes) {
    if (!q.date) continue;
    const r = get(q.date);
    r.quiz ??= { correct: 0, total: 0, count: 0 };
    r.quiz.correct += q.score;
    r.quiz.total += q.total;
    r.quiz.count += 1;
  }
  for (const r of rows.values()) {
    r.topics = Array.from(topics.get(r.date) ?? []).sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));
    r.lessons = lessons.get(r.date)?.size ?? 0;
  }
  return Array.from(rows.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function HistoryClient() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [daily, sessions, quizzes] = await Promise.all([listDaily(user.uid, 90), listSessions(user.uid, 400), listQuizResults(user.uid, 200)]);
        if (!cancelled) setRows(buildHistoryRows(daily, sessions, quizzes));
      } catch (err) {
        if (!cancelled) setError(errMessage(err, "Could not load your study history."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const totals = useMemo(() => {
    if (!rows) return null;
    const minutes = rows.reduce((a, r) => a + r.minutes, 0);
    const days = rows.filter((r) => r.minutes > 0 || r.quiz).length;
    const completed = rows.filter((r) => r.completed).length;
    const correct = rows.reduce((a, r) => a + (r.quiz?.correct ?? 0), 0);
    const total = rows.reduce((a, r) => a + (r.quiz?.total ?? 0), 0);
    return { minutes, days, completed, acc: total > 0 ? Math.round((correct / total) * 100) : null };
  }, [rows]);

  if (!authLoading && !user) return <SignedOutState />;
  if (error) return <ErrorState message={error} />;
  if (!rows) return <LoadingState label="Loading your history…" rows={5} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title="No study days yet"
        action={
          <Button href="/daily-study" variant="secondary">
            Open daily study
          </Button>
        }
      >
        Your history fills in as you complete tasks.
      </EmptyState>
    );

  return (
    <div className="pb-12">
      {/* Stat tiles render only with a non-zero value. */}
      {totals && (totals.days > 0 || totals.minutes > 0 || totals.completed > 0 || totals.acc !== null) && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6 animate-rise">
          {totals.days > 0 && <Stat label="Study days" value={totals.days} hint="last 90 days" />}
          {totals.minutes > 0 && <Stat label="Study time" value={formatMinutes(totals.minutes)} hint="last 90 days" />}
          {totals.completed > 0 && <Stat label="Days completed" value={totals.completed} tone="ok" />}
          {totals.acc !== null && <Stat label="Quiz accuracy" value={`${totals.acc}%`} />}
        </div>
      )}
      <ul className="space-y-3" aria-label="Study days">
        {rows.map((r) => {
          const acc = r.quiz && r.quiz.total > 0 ? Math.round((r.quiz.correct / r.quiz.total) * 100) : null;
          return (
            <li key={r.date}>
              <LinkCard href={`/history/${r.date}`}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="font-semibold text-lg">
                    <time dateTime={r.date}>{formatDate(r.date, { month: "long", day: "numeric" })}</time>
                    <span className="text-muted font-normal text-sm"> {r.date.slice(0, 4)}</span>
                  </h2>
                  {r.completed && <Badge tone="ok">Day complete</Badge>}
                </div>
                <dl className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Study time</dt>
                    <dd className="font-medium tabular-nums">{formatMinutes(r.minutes)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Lessons</dt>
                    <dd className="font-medium tabular-nums">{r.lessons}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Quiz</dt>
                    <dd className="font-medium tabular-nums">
                      {acc === null ? <span className="text-muted">—</span> : `${acc}%`}
                      {r.quiz && r.quiz.total > 0 && (
                        <span className="text-muted font-normal">
                          {" "}
                          ({r.quiz.correct}/{r.quiz.total})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">Topics</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {r.topics.length ? (
                        r.topics.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-xs" title={skillLabel(t)}>
                            <SkillGlyph type={t} size="sm" />
                            <span className="sr-only">{skillLabel(t)}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </LinkCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
