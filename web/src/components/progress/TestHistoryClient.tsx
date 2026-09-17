"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Pill, Section, Stat } from "@/components/ui";
import { listExamResults, listQuizResults } from "@/lib/firestore/repo";
import type { ExamResultDoc, QuizKind, QuizResultDoc } from "@/lib/firestore/types";
import { EmptyState, ErrorState, LoadingState, Ring, SignedOutState, errMessage, formatDate, formatSeconds, pct, LinkCard } from "./shared";

const KIND_LABEL: Record<QuizKind, string> = {
  lesson: "Lesson quiz",
  daily: "Daily quiz",
  weekly: "Weekly test",
  phase: "Phase test",
  review: "Review",
  practice: "Practice",
};

function kindLabel(k: string): string {
  return (KIND_LABEL as Record<string, string>)[k] ?? k;
}

function accuracyTone(a: number): "ok" | "warn" | "neutral" {
  if (a >= 0.8) return "ok";
  if (a < 0.6) return "warn";
  return "neutral";
}

export function TestHistoryClient() {
  const { user, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizResultDoc[] | null>(null);
  const [exams, setExams] = useState<ExamResultDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | QuizKind>("all");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [q, e] = await Promise.all([listQuizResults(user.uid, 200), listExamResults(user.uid, 50)]);
        if (cancelled) return;
        setQuizzes(q);
        setExams(e);
      } catch (err) {
        if (!cancelled) setError(errMessage(err, "Could not load your test history."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const kinds = useMemo(() => Array.from(new Set((quizzes ?? []).map((q) => q.kind))), [quizzes]);
  const shown = useMemo(() => (quizzes ?? []).filter((q) => filter === "all" || q.kind === filter), [quizzes, filter]);
  const avg = useMemo(() => {
    const qs = quizzes ?? [];
    if (!qs.length) return null;
    const c = qs.reduce((a, q) => a + q.score, 0);
    const t = qs.reduce((a, q) => a + q.total, 0);
    return t > 0 ? c / t : null;
  }, [quizzes]);

  if (!authLoading && !user) return <SignedOutState />;
  if (error) return <ErrorState message={error} />;
  if (!quizzes || !exams) return <LoadingState label="Loading your tests…" rows={5} />;

  const bestExam = exams.reduce<ExamResultDoc | null>((b, e) => (b === null || e.totalScaled > b.totalScaled ? e : b), null);

  return (
    <div className="pb-12">
      {quizzes.length === 0 && exams.length === 0 ? (
        <EmptyState
          title="No tests yet"
          action={
            <Button href="/tests" variant="secondary">
              Take a test
            </Button>
          }
        >
          Finish a lesson mini test, a daily quiz or a mock exam and it will be saved here with every answer and explanation.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-rise">
          <Stat label="Quizzes" value={quizzes.length} hint="saved with every answer" />
          <Stat label="Average accuracy" value={avg === null ? "—" : pct(avg)} tone={avg !== null && avg >= 0.8 ? "ok" : "neutral"} />
          <Stat label="Mock exams" value={exams.length} />
          <Stat label="Best exam" value={bestExam ? Math.round(bestExam.totalScaled) : "—"} hint={bestExam ? "/ 180 scaled" : "none yet"} tone={bestExam?.passedEstimate ? "ok" : "neutral"} />
        </div>
      )}

      {quizzes.length > 0 && (
        <Section title="Quizzes and tests" eyebrow="Newest first">
          {kinds.length > 1 && (
            <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2 mb-4">
              {(["all", ...kinds] as const).map((k) => (
                <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>
                  {k === "all" ? "All" : kindLabel(k)}
                </Pill>
              ))}
            </div>
          )}
          <ul className="space-y-3" aria-label="Quiz results">
            {shown.map((q) => (
              <li key={q.id}>
                <LinkCard href={`/tests/history/${encodeURIComponent(q.id)}`}>
                  <div className="flex items-center gap-4">
                    <Ring value={q.accuracy * 100} size={56} stroke={6} tone={q.accuracy >= 0.8 ? "ok" : q.accuracy < 0.6 ? "warn" : "accent"} label={`Accuracy ${pct(q.accuracy)}`}>
                      <span className="text-xs font-semibold tabular-nums">{pct(q.accuracy)}</span>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate">{q.title}</h3>
                      <p className="text-sm text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge>{kindLabel(q.kind)}</Badge>
                        <time dateTime={q.createdAt}>{formatDate(q.date)}</time>
                        <span className="tabular-nums">· {formatSeconds(q.seconds)}</span>
                      </p>
                    </div>
                    <dl className="hidden sm:block text-right">
                      <dt className="text-[11px] uppercase tracking-wider text-muted">Score</dt>
                      <dd className="font-semibold tabular-nums text-lg">
                        {q.score}
                        <span className="text-sm font-normal text-muted">/{q.total}</span>
                      </dd>
                    </dl>
                    <span className="sm:hidden">
                      <Badge tone={accuracyTone(q.accuracy)}>
                        {q.score}/{q.total}
                      </Badge>
                    </span>
                  </div>
                </LinkCard>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {exams.length > 0 && (
        <Section title="Mock exams" eyebrow="JLPT scale" intro="Scaled score out of 180 (pass estimate ≈ 90).">
          <ul className="space-y-3" aria-label="Mock exam results">
            {exams.map((e) => (
              <li key={e.id}>
                <LinkCard href={`/mock-exams/history/${encodeURIComponent(e.id)}`}>
                  <div className="flex items-center gap-4">
                    <Ring value={(e.totalScaled / 180) * 100} size={56} stroke={6} tone={e.passedEstimate ? "ok" : "warn"} label={`Scaled score ${Math.round(e.totalScaled)} of 180`}>
                      <span className="text-sm font-semibold tabular-nums">{Math.round(e.totalScaled)}</span>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate" lang="ja">
                        {e.title}
                      </h3>
                      <p className="text-sm text-muted mt-0.5">
                        <time dateTime={e.createdAt}>{formatDate(e.date)}</time> · {formatSeconds(e.seconds)}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {e.sections.map((s) => (
                          <li key={s.id}>
                            <Badge tone={s.scaled >= 19 ? "ok" : "warn"}>
                              <span lang="ja">{s.name}</span> {Math.round(s.scaled)}/60
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="hidden sm:block text-right">
                      <Badge tone={e.passedEstimate ? "ok" : "warn"}>{e.passedEstimate ? "Pass estimate" : "Below pass line"}</Badge>
                    </div>
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
