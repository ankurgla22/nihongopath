"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Callout, Card, Kbd, PageTitle, Pill, Section, Stat } from "@/components/ui";
import type { Question } from "@/lib/content/schemas";
import { questionContentIds } from "@/lib/engine/scoring";
import { getQuizResult } from "@/lib/firestore/repo";
import { SKILLS, type AnswerRecord, type QuizResultDoc, type Skill } from "@/lib/firestore/types";
import { groupIdsByType, hrefFor, parseContentId, resolveContentIds, type ResolvedContent } from "./contentHref";
import { EmptyState, ErrorState, LoadingState, Ring, SignedOutState, errMessage, formatDate, formatSeconds, pct, skillLabel } from "./shared";
import { cleanNote, wrongOptionNotes } from "@/lib/questions/notes";

const REVIEW_VERB: Record<string, string> = {
  grammar: "Review this grammar",
  vocabulary: "Review this word",
  kanji: "Review this kanji",
  reading: "Review this passage",
  listening: "Review this exercise",
};

async function fetchQuestions(ids: string[]): Promise<Map<string, Question>> {
  const map = new Map<string, Question>();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await fetch(`/api/content/questions?ids=${encodeURIComponent(chunk.join(","))}`);
    if (!res.ok) throw new Error("Could not load the questions for this test.");
    for (const q of (await res.json()) as Question[]) map.set(q.id, q);
  }
  return map;
}

function QuestionReview({ index, q, a }: { index: number; q: Question | undefined; a: AnswerRecord | undefined }) {
  const selected = a?.selectedIndex ?? null;
  const correct = a?.correct ?? false;
  const skipped = selected === null;
  const perOption = !!q && q.distractorExplanations.length === q.options.length;
  return (
    <Card as="article" className={`border-l-4 ${correct ? "border-l-ok" : "border-l-warn"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-medium flex items-center gap-2">
          <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold tabular-nums">{index + 1}</span>
          {q && (
            <span className="text-muted font-normal text-sm">
              {skillLabel(q.skill)} · {q.topic}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2 text-sm">
          {a && <span className="text-muted tabular-nums text-xs">{formatSeconds(a.seconds)}</span>}
          <Badge tone={correct ? "ok" : "warn"}>{correct ? "Correct" : skipped ? "Skipped" : "Incorrect"}</Badge>
        </div>
      </div>
      {!q ? (
        <p className="text-sm text-muted">This question is no longer in the question bank.</p>
      ) : (
        <>
          {q.context && (
            <p lang="ja" className="ja whitespace-pre-line text-sm border border-line rounded-xl p-3 mb-3 bg-bg-elev max-h-64 overflow-y-auto">
              {q.context}
            </p>
          )}
          <p lang="ja" className="ja text-lg sm:text-xl leading-relaxed font-medium">
            {q.prompt}
          </p>
          {q.type === "ordering" && <p className="mt-1 text-sm text-muted">Choose the word that goes in the ★ position.</p>}
          <ol className="mt-3 space-y-2" aria-label="Options">
            {q.options.map((opt, i) => {
              const isAnswer = i === q.answerIndex;
              const isSelected = i === selected;
              const cls = isAnswer ? "border-ok bg-ok-soft" : isSelected ? "border-warn bg-warn-soft" : "border-line bg-surface";
              const distractor = !isAnswer && perOption && q.distractorExplanations[i] ? cleanNote(q.distractorExplanations[i]) : undefined;
              return (
                <li key={i} className={`rounded-xl border px-3.5 py-3 text-sm ${cls}`}>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5" aria-hidden>
                      <Kbd>{String.fromCharCode(65 + i)}</Kbd>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span lang="ja" className="ja text-base">
                        {opt}
                      </span>
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {isAnswer && <Badge tone="ok">Correct answer</Badge>}
                        {isSelected && !isAnswer && <Badge tone="warn">Your answer</Badge>}
                        {isSelected && isAnswer && <Badge tone="ok">Your answer</Badge>}
                      </span>
                      {!isAnswer && distractor && (isSelected || !correct) && <p className="mt-1 text-muted">{distractor}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {skipped && <p className="mt-2 text-sm text-muted">You did not answer this question.</p>}
          <div className="mt-3">
            <Callout tone={correct ? "ok" : "accent"} title="Explanation">
              <span className="block">{q.explanation}</span>
              {!perOption && wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length).length > 0 && (
                <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
                  {wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length).map((d) => (
                    <li key={d.index}>{d.text}</li>
                  ))}
                </ul>
              )}
            </Callout>
          </div>
        </>
      )}
    </Card>
  );
}

export function TestResultClient({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<QuizResultDoc | null | undefined>(undefined);
  const [questions, setQuestions] = useState<Map<string, Question> | null>(null);
  const [resolved, setResolved] = useState<Record<string, ResolvedContent>>({});
  const [error, setError] = useState<string | null>(null);
  const [showOnly, setShowOnly] = useState<"all" | "wrong">("all");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getQuizResult(user.uid, id);
        if (cancelled) return;
        setResult(r);
        if (!r) return;
        const qmap = await fetchQuestions(r.questionIds);
        if (cancelled) return;
        setQuestions(qmap);
        const ids = new Set<string>(r.weakContentIds ?? []);
        for (const q of qmap.values()) for (const cid of questionContentIds(q)) ids.add(cid);
        const res = await resolveContentIds(Array.from(ids));
        if (!cancelled) setResolved(res);
      } catch (err) {
        if (!cancelled) setError(errMessage(err, "Could not load this test."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, id]);

  const answers = useMemo(() => {
    const m = new Map<string, AnswerRecord>();
    for (const a of result?.answers ?? []) m.set(a.questionId, a);
    return m;
  }, [result]);

  /** Weak content: the stored weakContentIds plus tags of every wrong question, grouped by skill. */
  const weak = useMemo(() => {
    if (!result) return {} as Record<string, string[]>;
    const ids: string[] = [...(result.weakContentIds ?? [])];
    for (const qid of result.questionIds) {
      const a = answers.get(qid);
      const q = questions?.get(qid);
      if (q && a && !a.correct) ids.push(...questionContentIds(q));
    }
    return groupIdsByType(ids);
  }, [result, answers, questions]);

  const weakSkills = useMemo(() => {
    const out: Skill[] = [];
    for (const s of SKILLS) {
      const b = result?.skillBreakdown?.[s];
      if (b && b.total > 0 && b.correct / b.total < 0.7) out.push(s);
    }
    return out;
  }, [result]);

  if (!authLoading && !user) return <SignedOutState />;
  if (error) return <ErrorState message={error} />;
  if (result === undefined) return <LoadingState label="Loading this test…" rows={4} />;
  if (result === null)
    return (
      <EmptyState
        title="Test not found"
        action={
          <Button href="/tests/history" variant="secondary">
            Back to test history
          </Button>
        }
      >
        This result does not exist or belongs to another account.
      </EmptyState>
    );

  const wrongCount = result.total - result.score;
  const shownIds = result.questionIds.filter((qid) => showOnly === "all" || !(answers.get(qid)?.correct ?? false));
  const weakKeys = Object.keys(weak).sort((a, b) => SKILLS.indexOf(a as Skill) - SKILLS.indexOf(b as Skill));
  const recommended = weakKeys.flatMap((t) => weak[t].map((cid) => ({ cid, type: t }))).filter(({ cid }) => resolved[cid]).slice(0, 8);

  return (
    <div className="pb-12">
      <PageTitle
        eyebrow={`${result.kind} · ${formatDate(result.date)}`}
        title={result.title}
        description={`You scored ${result.score} out of ${result.total} (${pct(result.accuracy)}) in ${formatSeconds(result.seconds)}.`}
      />

      <Card className="animate-rise" padding="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Ring value={result.accuracy * 100} size={124} stroke={11} tone={result.accuracy >= 0.8 ? "ok" : result.accuracy < 0.6 ? "warn" : "accent"} label={`Accuracy ${pct(result.accuracy)}`}>
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight leading-none">{result.score}</p>
              <p className="text-xs text-muted mt-1">of {result.total}</p>
            </div>
          </Ring>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <Stat label="Accuracy" value={pct(result.accuracy)} tone={result.accuracy >= 0.8 ? "ok" : "neutral"} />
            <Stat label="Time" value={formatSeconds(result.seconds)} />
            <Stat label="Mistakes" value={wrongCount} tone={wrongCount === 0 ? "ok" : "neutral"} />
          </div>
        </div>
        {Object.keys(result.skillBreakdown ?? {}).length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4" aria-label="Accuracy by skill">
            {SKILLS.map((s) => {
              const b = result.skillBreakdown[s];
              if (!b || b.total === 0) return null;
              const a = b.correct / b.total;
              return (
                <li key={s}>
                  <Badge tone={a >= 0.8 ? "ok" : a < 0.6 ? "warn" : "neutral"}>
                    {skillLabel(s)} {b.correct}/{b.total}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {(weakKeys.length > 0 || weakSkills.length > 0) && (
        <Section title="What to review" intro="Content behind the questions you missed. Open a lesson to go straight to the explanation.">
          {weakSkills.length > 0 && (
            <p className="text-sm mb-3">
              Weak areas this time: <strong>{weakSkills.map(skillLabel).join(", ")}</strong>.
            </p>
          )}
          <div className="space-y-4">
            {weakKeys.map((type) => (
              <div key={type}>
                <h3 className="text-xs uppercase tracking-wider text-muted mb-1">Weak {skillLabel(type).toLowerCase()}</h3>
                <ul className="flex flex-wrap gap-2">
                  {weak[type].map((cid) => {
                    const l = hrefFor(cid, resolved);
                    const verb = REVIEW_VERB[type] ?? "Review";
                    return (
                      <li key={cid}>
                        <Link
                          href={l.href}
                          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 h-8 text-sm transition hover:border-line-strong hover:bg-surface-2 focus:outline-none focus-visible:shadow-ring"
                        >
                          <span>{verb}:</span>
                          <span lang={l.exact ? "ja" : undefined} className={l.exact ? "ja font-medium" : "font-mono text-xs text-muted"}>
                            {l.title}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {recommended.length > 0 && (
            <Callout tone="accent" title="Recommended lessons">
              <ol className="list-decimal pl-5 space-y-1">
                {recommended.map(({ cid, type }) => (
                  <li key={cid}>
                    <Link href={resolved[cid].href} className="underline">
                      <span lang="ja" className="ja">
                        {resolved[cid].title}
                      </span>
                    </Link>{" "}
                    <span className="text-muted">({skillLabel(type)}, {parseContentId(cid)?.level.toUpperCase()})</span>
                  </li>
                ))}
              </ol>
            </Callout>
          )}
          {recommended.length === 0 && weakKeys.length > 0 && Object.keys(resolved).length === 0 && (
            <div className="mt-3 space-y-2" role="status" aria-busy="true">
              <span className="sr-only">Resolving lesson links…</span>
              <div className="skeleton h-3 w-1/2" aria-hidden />
              <div className="skeleton h-3 w-1/3" aria-hidden />
            </div>
          )}
        </Section>
      )}

      {weakKeys.length === 0 && wrongCount === 0 && (
        <div className="mt-6">
          <Callout tone="ok" title="Perfect score">
            Nothing to review from this test. Keep the streak going in{" "}
            <Link href="/daily-study" className="underline">
              Daily study
            </Link>
            .
          </Callout>
        </div>
      )}

      <Section title="Questions">
        {wrongCount > 0 && (
          <div role="group" aria-label="Show questions" className="flex gap-2 mb-4">
            {(["all", "wrong"] as const).map((k) => (
              <Pill key={k} active={showOnly === k} onClick={() => setShowOnly(k)}>
                {k === "all" ? `All (${result.total})` : `Mistakes (${wrongCount})`}
              </Pill>
            ))}
          </div>
        )}
        {!questions ? (
          <LoadingState label="Loading questions…" rows={3} />
        ) : (
          <ol className="space-y-4" aria-label="Question review">
            {shownIds.map((qid) => (
              <li key={qid}>
                <QuestionReview index={result.questionIds.indexOf(qid)} q={questions.get(qid)} a={answers.get(qid)} />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
