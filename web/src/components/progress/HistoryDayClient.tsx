"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Card, Section, Stat } from "@/components/ui";
import { getDaily, listQuizResultsForDate, listSessionsForDate } from "@/lib/firestore/repo";
import type { DailyProgressDoc, QuizResultDoc, StudySessionDoc } from "@/lib/firestore/types";
import { SKILLS } from "@/lib/firestore/types";
import { groupIdsByType, hrefFor, resolveContentIds, type ResolvedContent } from "./contentHref";
import { EmptyState, ErrorState, LoadingState, SignedOutState, SkillGlyph, errMessage, formatDateTime, formatMinutes, formatSeconds, pct, skillLabel, LinkCard } from "./shared";

type Data = { daily: DailyProgressDoc | null; sessions: StudySessionDoc[]; quizzes: QuizResultDoc[] };

/** Links for a list of content ids, grouped by type. Titles fill in once the resolver responds. */
export function ContentIdLinks({ ids, resolved, verb }: { ids: string[]; resolved: Record<string, ResolvedContent>; verb?: string }) {
  const groups = groupIdsByType(ids);
  const order = [...SKILLS, "other"];
  const keys = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (keys.length === 0) return <p className="text-sm text-muted">No lesson content recorded.</p>;
  return (
    <div className="space-y-3">
      {keys.map((type) => (
        <div key={type}>
          <h4 className="text-[11px] uppercase tracking-wider text-muted mb-1.5">{skillLabel(type)}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {groups[type].map((id) => {
              const l = hrefFor(id, resolved);
              return (
                <li key={id}>
                  <Link
                    href={l.href}
                    lang={l.exact && type !== "other" ? "ja" : undefined}
                    className={`inline-flex items-center rounded-full border border-line bg-surface px-3 h-8 text-sm transition hover:border-line-strong hover:bg-surface-2 focus:outline-none focus-visible:shadow-ring ${l.exact && type !== "other" ? "ja" : ""}`}
                    title={l.exact ? `${verb ?? "Open"} ${skillLabel(type).toLowerCase()}: ${l.title}` : `Open the ${skillLabel(type).toLowerCase()} index (${id})`}
                  >
                    {verb && l.exact ? `${verb} ` : ""}
                    {l.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function HistoryDayClient({ date }: { date: string }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [resolved, setResolved] = useState<Record<string, ResolvedContent>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [daily, sessions, quizzes] = await Promise.all([getDaily(user.uid, date), listSessionsForDate(user.uid, date), listQuizResultsForDate(user.uid, date)]);
        if (cancelled) return;
        sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        setData({ daily, sessions, quizzes });
        const ids = new Set<string>();
        for (const s of sessions) for (const id of s.contentIds ?? []) ids.add(id);
        for (const t of daily?.plannedTasks ?? []) for (const id of t.contentIds) ids.add(id);
        for (const q of quizzes) for (const id of q.weakContentIds ?? []) ids.add(id);
        if (ids.size) {
          const r = await resolveContentIds(Array.from(ids));
          if (!cancelled) setResolved(r);
        }
      } catch (err) {
        if (!cancelled) setError(errMessage(err, "Could not load this day."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, date]);

  const summary = useMemo(() => {
    if (!data) return null;
    const sessionMinutes = data.sessions.reduce((a, s) => a + Math.max(0, s.minutes || 0), 0);
    const minutes = data.daily?.minutes || sessionMinutes;
    const topics = Array.from(new Set(data.sessions.map((s) => s.skill)));
    const correct = data.quizzes.reduce((a, q) => a + q.score, 0);
    const total = data.quizzes.reduce((a, q) => a + q.total, 0);
    const plannedDone = data.daily ? data.daily.plannedTasks.filter((t) => data.daily!.completedTaskIds.includes(t.id)).length : 0;
    return { minutes, topics, correct, total, plannedDone, planned: data.daily?.plannedTasks.length ?? 0 };
  }, [data]);

  if (!authLoading && !user) return <SignedOutState />;
  if (error) return <ErrorState message={error} />;
  if (!data || !summary) return <LoadingState label="Loading this day…" rows={4} />;

  const nothing = !data.daily && data.sessions.length === 0 && data.quizzes.length === 0;
  if (nothing)
    return (
      <EmptyState
        title="Nothing recorded on this day"
        action={
          <Button href="/history" variant="secondary">
            Back to study history
          </Button>
        }
      >
        Nothing was saved for this date.
      </EmptyState>
    );

  return (
    <div className="pb-12">
      {/* Stat tiles render only with a value. */}
      {(summary.minutes > 0 || summary.total > 0 || summary.planned > 0 || summary.topics.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-rise">
          {summary.minutes > 0 && <Stat label="Study time" value={formatMinutes(summary.minutes)} />}
          {summary.total > 0 && <Stat label="Quiz score" value={pct(summary.correct / summary.total)} hint={`${summary.correct} of ${summary.total} correct`} tone={summary.correct / summary.total >= 0.8 ? "ok" : "neutral"} />}
          {summary.planned > 0 && <Stat label="Plan" value={`${summary.plannedDone}/${summary.planned}`} hint={data.daily ? `Day ${data.daily.curriculumDay}${data.daily.completed ? " · complete" : ""}` : undefined} tone={data.daily?.completed ? "ok" : "neutral"} />}
          {summary.topics.length > 0 && (
            <div className="surface rounded-2xl p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wider text-muted">Topics</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.topics.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-sm">
                    <SkillGlyph type={t} size="sm" />
                    <span className="sr-only">{skillLabel(t)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {data.sessions.length > 0 && (
        <Section title="Sessions">
          <ol className="space-y-3" aria-label="Study sessions">
            {data.sessions.map((s) => (
              <li key={s.id}>
                <Card as="article">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-medium flex items-center gap-2.5">
                      <SkillGlyph type={s.skill} size="sm" tone="accent" />
                      <span>{skillLabel(s.skill)}</span>
                      <Badge>{formatMinutes(s.minutes)}</Badge>
                    </h3>
                    <p className="text-sm text-muted tabular-nums">
                      <time dateTime={s.startedAt}>{formatDateTime(s.startedAt)}</time>
                      {s.endedAt && (
                        <>
                          {" "}
                          – <time dateTime={s.endedAt}>{new Date(s.endedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                        </>
                      )}
                    </p>
                  </div>
                  <ContentIdLinks ids={s.contentIds ?? []} resolved={resolved} />
                </Card>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {data.daily && data.daily.plannedTasks.length > 0 && (
        <Section title="Planned tasks" eyebrow={`Day ${data.daily.curriculumDay}`}>
          <Card padding="p-0" className="overflow-hidden">
            <ul className="divide-y divide-line" aria-label="Planned tasks">
              {data.daily.plannedTasks.map((t) => {
                const done = data.daily!.completedTaskIds.includes(t.id);
                return (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 p-4 sm:px-5">
                    <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${done ? "bg-ok text-white" : "border border-line-strong text-muted"}`} aria-hidden>
                      {done ? "✓" : ""}
                    </span>
                    <SkillGlyph type={t.type} size="sm" tone={done ? "ok" : "neutral"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                        <span className={done ? "" : "text-muted"}>{skillLabel(t.type)}</span>
                        <Badge>{formatMinutes(t.minutes)}</Badge>
                        <span className="sr-only">{done ? " (completed)" : " (not completed)"}</span>
                      </p>
                      {t.contentIds.length > 0 && (
                        <div className="mt-2">
                          <ContentIdLinks ids={t.contentIds} resolved={resolved} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>
      )}

      {data.quizzes.length > 0 && (
        <Section title="Quiz results">
          <ul className="space-y-3" aria-label="Quiz results">
            {data.quizzes.map((q) => (
              <li key={q.id}>
                <LinkCard href={`/tests/history/${encodeURIComponent(q.id)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium flex items-center gap-2 min-w-0">
                      <Badge tone="accent">{q.kind}</Badge>
                      <span className="truncate">{q.title}</span>
                    </h3>
                    <p className="text-sm tabular-nums">
                      <Badge tone={q.accuracy >= 0.8 ? "ok" : q.accuracy < 0.6 ? "warn" : "neutral"} size="md">
                        {pct(q.accuracy)}
                      </Badge>
                      <span className="text-muted ml-2">
                        {q.score}/{q.total} · {formatSeconds(q.seconds)}
                      </span>
                    </p>
                  </div>
                </LinkCard>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
