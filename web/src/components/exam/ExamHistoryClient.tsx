"use client";
/**
 * "My Exam History": every saved mock exam attempt for the signed-in learner,
 * newest first, with scaled score, per-section scaled, pass estimate, time and accuracy.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExamResultDoc } from "@/lib/firestore/types";
import { listExamResults } from "@/lib/firestore/repo";
import { flushPending } from "@/lib/study/service";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Callout, Card, EmptyState, Stat } from "@/components/ui";
import { LoadingState, Ring } from "@/components/progress/shared";
import { accuracyOf, formatDate, formatDuration, PassBadge, SCALED_MAX } from "./shared";

export function ExamHistoryClient() {
  const { user, loading } = useAuth();
  const [results, setResults] = useState<ExamResultDoc[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        await flushPending(user.uid).catch(() => 0);
        const list = await listExamResults(user.uid);
        if (!cancelled) setResults(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your exam history.");
          setResults([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || (user && results === null)) return <LoadingState label="Loading your exam history…" rows={3} />;
  if (!user)
    return (
      <Callout tone="warn" title="Not signed in">
        Sign in to see your exam history.
      </Callout>
    );

  const list = results ?? [];
  const best = list.reduce<ExamResultDoc | null>((b, e) => (b === null || e.totalScaled > b.totalScaled ? e : b), null);
  const passes = list.filter((r) => r.passedEstimate).length;

  return (
    <div className="pb-10">
      {error && (
        <div className="mb-4">
          <Callout tone="warn" title="Could not reach your history">
            <p>{error}</p>
          </Callout>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState title="No mock exams yet" action={<Button href="/mock-exams">Browse mock exams</Button>}>
          Every attempt appears here with its scaled score.
        </EmptyState>
      ) : (
        <>
          {/* Stat tiles render only with a non-zero value; one attempt has nothing to summarise. */}
          {list.length > 1 && best && (
            <div className={`grid grid-cols-2 gap-3 sm:gap-4 mb-6 animate-rise ${passes > 0 ? "sm:grid-cols-3" : ""}`}>
              <Stat label="Attempts" value={list.length} />
              <Stat label="Best score" value={best.totalScaled} hint={`/ ${SCALED_MAX} scaled`} tone={best.passedEstimate ? "ok" : "neutral"} />
              {passes > 0 && <Stat label="Pass estimates" value={passes} hint={`of ${list.length}`} tone="ok" />}
            </div>
          )}
          <ol className="grid gap-3">
            {list.map((r, i) => {
              const n = list.length - i;
              const acc = Math.round(accuracyOf(r) * 100);
              return (
                <Card as="li" key={r.id} hover>
                  <div className="flex items-start gap-4">
                    <Ring value={(r.totalScaled / SCALED_MAX) * 100} size={72} stroke={7} tone={r.passedEstimate ? "ok" : "warn"} label={`Scaled score ${r.totalScaled} of ${SCALED_MAX}`}>
                      <span className="text-base font-semibold tabular-nums leading-none">{r.totalScaled}</span>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Mock exam #{n}</p>
                        <PassBadge result={r} />
                      </div>
                      <h2 className="mt-0.5 text-lg font-semibold ja truncate" lang="ja">
                        <Link href={`/mock-exams/history/${r.id}`} className="hover:text-accent transition">
                          {r.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted">
                        {formatDate(r.createdAt)} · {acc}% accuracy · {formatDuration(r.seconds)}
                      </p>
                      <ul className="mt-2.5 flex flex-wrap gap-1.5">
                        {r.sections.map((s) => (
                          <li key={s.id}>
                            <Badge tone={s.scaled >= (s.min ?? 19) ? "ok" : "warn"}>
                              <span lang="ja">{s.name}</span> {s.scaled}/{s.max ?? 60}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
