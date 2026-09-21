"use client";
/**
 * Mock exam review: scaled score with pass/fail estimate, per-section table,
 * time, accuracy, every question with the learner's answer, the correct answer,
 * explanations and distractor notes, and "Review this" links for weak content.
 *
 * Loads the result from Firestore (getExamResult) and falls back to the copy the
 * runner put in sessionStorage, so a result saved offline can still be reviewed.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Question } from "@/lib/content/schemas";
import { getExamResult } from "@/lib/firestore/repo";
import { PASS_SECTION_MIN, PASS_TOTAL_MIN, SECTION_SCALED_MAX } from "@/lib/engine/scoring";
import { useAuth } from "@/components/auth/AuthProvider";
import { Arrow, Badge, Button, Card, Callout, Kbd, Pill, ProgressBar, Stat } from "@/components/ui";
import { LoadingState, Ring } from "@/components/progress/shared";
import { accuracyOf, formatDate, formatDuration, PassBadge, PromptText, readSessionResult, SCALED_MAX, typeLabel, type StoredExamResult } from "./shared";
import { cleanNote, wrongOptionNotes } from "@/lib/questions/notes";

type Resolved = { id: string; href: string; title: string; type: string };

function parseResolve(json: unknown): Resolved[] {
  const out: Resolved[] = [];
  const push = (id: string, v: unknown) => {
    if (v && typeof v === "object" && typeof (v as Resolved).href === "string") {
      const r = v as Partial<Resolved>;
      out.push({ id, href: r.href!, title: r.title ?? id, type: r.type ?? "" });
    }
  };
  if (Array.isArray(json)) {
    for (const item of json) if (item && typeof item === "object" && typeof (item as Resolved).id === "string") push((item as Resolved).id, item);
    return out;
  }
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    const inner = (obj.items ?? obj.results ?? obj.resolved ?? obj) as unknown;
    if (Array.isArray(inner)) return parseResolve(inner);
    if (inner && typeof inner === "object") for (const [id, v] of Object.entries(inner as Record<string, unknown>)) push(id, v);
  }
  return out;
}

export function ExamResultClient({ resultId }: { resultId: string }) {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const offlineParam = params.get("offline") === "1";

  const [result, setResult] = useState<StoredExamResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [questions, setQuestions] = useState<Map<string, Question> | null>(null);
  const [resolved, setResolved] = useState<Map<string, Resolved>>(new Map());
  const [expanded, setExpanded] = useState<"all" | "wrong">("wrong");

  // 1. Result: Firestore first, sessionStorage fallback.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      let r: StoredExamResult | null = null;
      if (user) {
        try {
          r = await getExamResult(user.uid, resultId);
        } catch {
          r = null;
        }
      }
      if (!r) r = readSessionResult(resultId);
      if (cancelled) return;
      setResult(r);
      setStatus(r ? "ready" : "missing");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, resultId]);

  // 2. Questions for this exam.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    fetch(`/api/exams/${encodeURIComponent(result.examId)}/questions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: { questions: Question[] }) => {
        if (!cancelled) setQuestions(new Map((json.questions ?? []).map((q) => [q.id, q])));
      })
      .catch(() => {
        if (!cancelled) setQuestions(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  // 3. Weak content ids → titles and hrefs.
  useEffect(() => {
    if (!result || result.weakContentIds.length === 0) return;
    let cancelled = false;
    fetch(`/api/content/resolve?ids=${encodeURIComponent(result.weakContentIds.join(","))}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        if (cancelled) return;
        setResolved(new Map(parseResolve(json).map((r) => [r.id, r])));
      })
      .catch(() => {
        /* links fall back to plain ids */
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (loading || status === "loading") return <LoadingState label="Loading your result…" rows={3} />;
  if (status === "missing" || !result) {
    return (
      <Callout tone="warn" title="Result not found">
        <p>This exam result is not in your history on this account. If you just finished an exam offline, open this page from the same browser tab.</p>
        <div className="mt-3">
          <Button href="/mock-exams/history" variant="secondary">
            Back to history
          </Button>
        </div>
      </Callout>
    );
  }

  const acc = Math.round(accuracyOf(result) * 100);
  const correct = result.sections.reduce((a, s) => a + s.score, 0);
  const total = result.sections.reduce((a, s) => a + s.total, 0);
  const showOffline = offlineParam || result.offline;
  const weakGroups = groupWeak(result.weakContentIds);

  return (
    <div className="pb-12">
      {showOffline && (
        <div className="mb-4">
          <Callout tone="warn" title="Saved offline">
            <p className="text-sm">The result is stored on this device and will sync to your account automatically the next time the app can reach the server.</p>
          </Callout>
        </div>
      )}

      {/* Summary */}
      <Card padding="p-0" className="overflow-hidden animate-rise">
        <div className={`px-5 sm:px-7 py-3 text-sm font-semibold flex flex-wrap items-center justify-between gap-2 ${result.passedEstimate ? "bg-ok text-white" : "bg-warn text-white"}`}>
          <span>{result.passedEstimate ? "Pass estimate" : "Below the pass line"}</span>
          <span className="text-xs font-normal opacity-90">
            Pass line {PASS_TOTAL_MIN} overall and {PASS_SECTION_MIN} per section
          </span>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Ring value={(result.totalScaled / SCALED_MAX) * 100} size={136} stroke={11} tone={result.passedEstimate ? "ok" : "warn"} label={`Scaled score ${result.totalScaled} of ${SCALED_MAX}`}>
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight leading-none">{result.totalScaled}</p>
                <p className="text-xs text-muted mt-1">/ {SCALED_MAX}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">{formatDate(result.createdAt)}</p>
              <h1 className="mt-1 text-h2 ja" lang="ja">
                {result.title}
              </h1>
              <div className="mt-2">
                <PassBadge result={result} />
              </div>
            </div>
          </div>
          {/* The pass estimate is already the banner; only tiles with a value remain. */}
          <div className={`mt-5 grid gap-2 sm:gap-3 ${result.seconds > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
            <Stat label="Accuracy" value={`${acc}%`} hint={`${correct}/${total} correct`} tone={acc >= 80 ? "ok" : "neutral"} />
            {result.seconds > 0 && <Stat label="Time" value={formatDuration(result.seconds)} />}
          </div>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Per-section scores</caption>
            <thead className="text-left text-muted text-[11px] uppercase tracking-wider bg-bg-elev">
              <tr>
                <th className="px-5 sm:px-7 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium text-right">Raw</th>
                <th className="px-3 py-2 font-medium text-right">Scaled / {SECTION_SCALED_MAX}</th>
                <th className="px-3 py-2 font-medium text-right">Time</th>
                <th className="px-5 sm:px-7 py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.sections.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-5 sm:px-7 py-2.5">
                    <span lang="ja" className="ja font-medium">
                      {s.name}
                    </span>
                    <div className="mt-1.5 w-32">
                      <ProgressBar value={(s.scaled / SECTION_SCALED_MAX) * 100} size="sm" tone={s.scaled >= PASS_SECTION_MIN ? "ok" : "accent"} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {s.score}/{s.total}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{s.scaled}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatDuration(s.seconds)}</td>
                  <td className="px-5 sm:px-7 py-2.5 text-right">
                    <Badge tone={s.scaled >= PASS_SECTION_MIN ? "ok" : "warn"}>{s.scaled >= PASS_SECTION_MIN ? "OK" : `Below ${PASS_SECTION_MIN}`}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Weak areas */}
      <Card className="mt-4 animate-rise-2">
        <h2 className="text-h2">Weak areas</h2>
        {result.weakContentIds.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No tagged content was missed. Well done.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {weakGroups.map((g) => (
              <div key={g.label}>
                <h3 className="text-[11px] uppercase tracking-wider text-muted">{g.label}</h3>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {g.ids.map((id) => {
                    const r = resolved.get(id);
                    return (
                      <li key={id} className="text-sm">
                        {r ? (
                          <Link href={r.href} className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 h-8 text-xs font-medium text-accent-ink hover:brightness-95 transition">
                            Review this: <span lang="ja">{r.title}</span>
                            <Arrow className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-line px-3 h-8 text-xs text-muted">{id}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {result.weakContentIds.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <Button href="/review" variant="outline">
              Open review queue
            </Button>
          </div>
        )}
      </Card>

      {/* Questions */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h2">Question review</h2>
        <div role="group" aria-label="Filter questions" className="flex gap-2 text-sm">
          <Pill active={expanded === "wrong"} onClick={() => setExpanded("wrong")}>
            Incorrect only
          </Pill>
          <Pill active={expanded === "all"} onClick={() => setExpanded("all")}>
            All questions
          </Pill>
        </div>
      </div>

      {questions === null ? (
        <div className="mt-3">
          <LoadingState label="Loading questions…" rows={3} />
        </div>
      ) : (
        <ol className="mt-3 grid gap-3">
          {result.answers.map((a, i) => {
            if (expanded === "wrong" && a.correct) return null;
            const q = questions.get(a.questionId);
            if (!q) {
              return (
                <Card as="li" key={a.questionId}>
                  <p className="text-sm text-muted">Question {i + 1} ({a.questionId}) is no longer in the bank.</p>
                </Card>
              );
            }
            const chosen = a.selectedIndex;
            const perOption = q.distractorExplanations.length === q.options.length;
            return (
              <Card as="li" key={a.questionId} className={`border-l-4 ${a.correct ? "border-l-ok" : "border-l-warn"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span className="flex items-center gap-2">
                    <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold tabular-nums text-ink">{i + 1}</span>
                    {typeLabel(q)} · {q.skill}
                  </span>
                  <span className="flex items-center gap-2">
                    {a.seconds > 0 && <span>{formatDuration(a.seconds)}</span>}
                    <Badge tone={a.correct ? "ok" : "warn"}>{a.correct ? "Correct" : chosen === null ? "Unanswered" : "Incorrect"}</Badge>
                  </span>
                </div>
                {q.context && q.context.trim() && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-accent">{q.skill === "listening" ? "Script" : "Passage"}</summary>
                    <div lang="ja" className="ja mt-2 rounded-xl border border-line bg-bg-elev p-3 text-sm leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                      {q.context}
                    </div>
                  </details>
                )}
                <PromptText text={q.prompt} className="mt-3" />
                <ol className="mt-3 grid gap-1.5">
                  {q.options.map((opt, oi) => {
                    const isAnswer = oi === q.answerIndex;
                    const isChosen = oi === chosen;
                    return (
                      <li
                        key={oi}
                        className={`rounded-xl border px-3.5 py-2.5 text-sm ${isAnswer ? "border-ok bg-ok-soft" : isChosen ? "border-warn bg-warn-soft" : "border-line bg-surface"}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0" aria-hidden>
                            <Kbd>{oi + 1}</Kbd>
                          </span>
                          <span lang="ja" className="ja text-base">
                            {opt}
                          </span>
                          <span className="ml-auto shrink-0">
                            {isAnswer && <Badge tone="ok">{isChosen ? "Your answer ✓" : "Correct answer"}</Badge>}
                            {isChosen && !isAnswer && <Badge tone="warn">Your answer ✗</Badge>}
                          </span>
                        </div>
                        {perOption && !isAnswer && q.distractorExplanations[oi] && cleanNote(q.distractorExplanations[oi]) && (
                          <p className="mt-1 pl-9 text-xs text-muted">{cleanNote(q.distractorExplanations[oi])}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-3">
                  <Callout tone={a.correct ? "ok" : "accent"} title="Explanation">
                    <span className="block">{q.explanation}</span>
                    {!perOption && wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length).length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted space-y-0.5">
                        {wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length).map((d) => (
                          <li key={d.index}>{d.text}</li>
                        ))}
                      </ul>
                    )}
                  </Callout>
                </div>
              </Card>
            );
          })}
          {expanded === "wrong" && result.answers.every((a) => a.correct) && (
            <li>
              <Callout tone="ok" title="Perfect">
                Every question was answered correctly.
              </Callout>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

function groupWeak(ids: string[]): { label: string; ids: string[] }[] {
  const groups: Record<string, string[]> = { Grammar: [], Vocabulary: [], Kanji: [], Reading: [], Listening: [], Other: [] };
  for (const id of ids) {
    if (id.includes("-grammar-")) groups.Grammar.push(id);
    else if (id.includes("-vocab-")) groups.Vocabulary.push(id);
    else if (id.includes("-kanji-")) groups.Kanji.push(id);
    else if (id.includes("-reading-")) groups.Reading.push(id);
    else if (id.includes("-listening-")) groups.Listening.push(id);
    else groups.Other.push(id);
  }
  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, v]) => ({ label: `Weak ${label.toLowerCase()}`, ids: v }));
}
