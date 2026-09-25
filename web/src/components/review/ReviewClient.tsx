"use client";
/**
 * Review queue: due items grouped by type with SRS status, due date and priority, plus a
 * review session (QuizRunner) whose correct answers clear items via completeQuiz(kind "review").
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PackedQuestionIndex, Question } from "@/lib/content/schemas";
import { SKILLS, todayISO, type ProgressDoc, type ReviewItemDoc, type Skill } from "@/lib/firestore/types";
import { getAllProgress, listReviewItems } from "@/lib/firestore/repo";
import { completeQuiz } from "@/lib/study/service";
import { describeStatus } from "@/lib/engine/srs";
import { skillLabel } from "@/lib/engine/dailyPlan";
import type { SubmittedAnswer } from "@/lib/engine/scoring";
import { curriculumDayFor } from "@/lib/engine/progress";
import { fetchDrill, fetchQuestionsByIds } from "@/lib/questions/client";
import { unpackQuestionIndex } from "@/lib/questions/pack";
import { scrollUnderHeader } from "@/lib/ui/scrollUnderHeader";
import { isDrillable } from "@/lib/drill/generate";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Button, Callout, Card, PageTitle } from "@/components/ui";
import { LoadingState, SkillGlyph } from "@/components/progress/shared";
import { resolveContentIds, type ResolvedContent } from "@/components/progress/contentHref";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { attemptSeed } from "@/components/quiz/attempt";
import { addDaysISO, isQueuedError, reviewQuestions, type ContentLinks } from "@/components/study/helpers";

/** `questionIndex` is the packed slim bank (id/level/skill/difficulty/content ids); full records are fetched on demand. */
type Props = { questionIndex: PackedQuestionIndex; contentLinks: ContentLinks };

/** `ids` are bank question ids; `drillIds` are due vocabulary/kanji content ids drilled on the fly with `seed`. */
type Session = { ids: string[]; drillIds: string[]; seed: string; status: "loading" | "ready" | "error"; questions: Question[] };

const SESSION_MAX = 20;
const SESSION_MIN = 5;

function priorityTone(p: number): "warn" | "accent" | "neutral" {
  return p >= 3 ? "warn" : p >= 2 ? "accent" : "neutral";
}

function dueLabel(due: string, today: string): string {
  if (due < today) {
    const days = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${due}T00:00:00`).getTime()) / 86400000);
    return `overdue ${days} day${days === 1 ? "" : "s"}`;
  }
  if (due === today) return "due today";
  if (due === addDaysISO(today, 1)) return "tomorrow";
  return due;
}

export function ReviewClient({ questionIndex: packedIndex, contentLinks }: Props) {
  const questionIndex = useMemo(() => unpackQuestionIndex(packedIndex), [packedIndex]);
  const { user } = useAuth();
  const { userDoc, refresh } = useUserDoc();
  const today = todayISO();

  const [items, setItems] = useState<ReviewItemDoc[] | null>(null);
  const [progress, setProgress] = useState<Map<string, ProgressDoc>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionToken = useRef(0);
  const [sessionItems, setSessionItems] = useState<ReviewItemDoc[]>([]);
  // Titles for ids the server did not pre-link (fetched on demand); the raw id is shown only while loading.
  const [resolved, setResolved] = useState<Record<string, ResolvedContent>>({});

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, all] = await Promise.all([listReviewItems(user.uid), getAllProgress(user.uid).catch(() => [] as ProgressDoc[])]);
      setItems(list);
      setProgress(new Map(all.map((p) => [p.contentId, p])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your review queue.");
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const due = useMemo(() => (items ?? []).filter((i) => i.due <= today).sort((a, b) => b.priority - a.priority || a.due.localeCompare(b.due)), [items, today]);
  const upcoming = useMemo(() => (items ?? []).filter((i) => i.due > today).sort((a, b) => a.due.localeCompare(b.due)), [items, today]);

  useEffect(() => {
    const missing = (items ?? []).map((i) => i.contentId).filter((id) => !contentLinks[id] && !resolved[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    void resolveContentIds(missing).then((r) => {
      if (!cancelled && Object.keys(r).length > 0) setResolved((prev) => ({ ...prev, ...r }));
    });
    return () => {
      cancelled = true;
    };
    // `resolved` is intentionally left out: it only grows, and re-running on every merge would loop on unknown ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, contentLinks]);

  /** Link and title for an item: server-provided link, then the on-demand lookup, then the id while loading. */
  const linkFor = (id: string): { href: string; title: string } | null => contentLinks[id] ?? resolved[id] ?? null;

  const groups = useMemo(() => {
    const g = new Map<Skill, ReviewItemDoc[]>();
    for (const s of SKILLS) g.set(s, []);
    for (const it of due) g.get(it.type)?.push(it);
    return SKILLS.map((s) => ({ skill: s, items: g.get(s) ?? [] })).filter((x) => x.items.length > 0);
  }, [due]);

  const tomorrowCount = useMemo(() => upcoming.filter((i) => i.due === addDaysISO(today, 1)).length, [upcoming, today]);

  const loadSession = async (base: Pick<Session, "ids" | "drillIds" | "seed">) => {
    const token = ++sessionToken.current;
    setSession({ ...base, status: "loading", questions: [] });
    try {
      const [drill, bank] = await Promise.all([
        base.drillIds.length ? fetchDrill(base.drillIds, { seed: base.seed, perItem: 1 }) : Promise.resolve([] as Question[]),
        base.ids.length ? fetchQuestionsByIds(base.ids) : Promise.resolve([] as Question[]),
      ]);
      if (token !== sessionToken.current) return;
      setSession({ ...base, status: "ready", questions: [...drill, ...bank] });
    } catch {
      if (token !== sessionToken.current) return;
      setSession({ ...base, status: "error", questions: [] });
    }
  };

  // Due vocabulary/kanji are drilled directly (one generated question each, so every word is coverable);
  // grammar/reading/listening items draw from the question bank as before. Both run in one session.
  // Same key the QuizRunner persists answers under, so a seed and its answers travel together.
  const reviewStorageKey = `nihongo-path:quiz:${user?.uid ?? "anon"}:${today}:review-session`;

  const startSession = () => {
    if (!user) return;
    const count = Math.min(SESSION_MAX, Math.max(SESSION_MIN, due.length));
    const seed = attemptSeed(reviewStorageKey, () => `${user.uid}-${today}-review-${Date.now()}`);
    const drillIds = due.filter((i) => isDrillable(i.contentId)).slice(0, count).map((i) => i.contentId);
    const others = due.filter((i) => !isDrillable(i.contentId));
    const bankCount = count - drillIds.length;
    const picked = bankCount > 0 ? reviewQuestions(questionIndex, others, bankCount, seed) : [];
    setSessionItems(due);
    setNotice(null);
    void loadSession({ ids: picked.map((q) => q.id), drillIds, seed });
  };

  // Leaving the session swaps the runner for the queue without moving the page, so the learner
  // was left looking at blank space with the notice and the queue above the viewport.
  const queueTopRef = useRef<HTMLDivElement>(null);
  const [returns, setReturns] = useState(0);
  useEffect(() => {
    if (returns === 0) return;
    scrollUnderHeader(queueTopRef.current);
  }, [returns]);

  const closeSession = () => {
    sessionToken.current++;
    setSession(null);
    setReturns((n) => n + 1);
  };

  const onComplete = async (answers: SubmittedAnswer[], seconds: number) => {
    if (!user || !session) return;
    try {
      await completeQuiz({
        uid: user.uid,
        kind: "review",
        title: `Review session · ${sessionItems.length} due`,
        questions: session.questions,
        answers,
        seconds,
        curriculumDay: userDoc ? curriculumDayFor(userDoc) : 1,
      });
      await load();
      await refresh();
    } catch (err) {
      if (!isQueuedError(err)) await load();
      throw err;
    }
  };

  const nothingDue = items !== null && due.length === 0;

  return (
    <div className="pb-16">
      <PageTitle title="Review queue" />
      <div ref={queueTopRef} aria-hidden />

      {error && (
        <div className="mb-4">
          <Callout tone="warn">{error}</Callout>
        </div>
      )}
      {notice && (
        <div className="mb-4 animate-rise">
          <Callout tone="ok">{notice}</Callout>
        </div>
      )}

      {session && session.status === "loading" ? (
        <LoadingState label="Loading your review session…" rows={3} />
      ) : session && session.status === "error" ? (
        <div className="space-y-3 animate-rise">
          <Callout tone="warn">Could not load the review questions. Check your connection and try again.</Callout>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void loadSession(session)}>Retry</Button>
            <Button variant="secondary" onClick={closeSession}>
              Back to queue
            </Button>
          </div>
        </div>
      ) : session ? (
        <QuizRunner
          questions={session.questions}
          title="Review session"
          mode="practice"
          storageKey={reviewStorageKey}
          contentLinks={contentLinks}
          onComplete={onComplete}
          onExit={closeSession}
          resultActions={
            <Button
              onClick={() => {
                closeSession();
                setNotice("Items answered correctly were cleared; missed items stay due.");
              }}
            >
              Back to queue
            </Button>
          }
        />
      ) : items === null ? (
        <LoadingState label="Loading your review queue…" rows={3} />
      ) : nothingDue ? (
        /* One empty state, one button. */
        <Card className="animate-rise">
          <h2 className="text-h2">Nothing due</h2>
          <p className="mt-1 text-sm text-muted">
            {tomorrowCount > 0
              ? `${tomorrowCount} item${tomorrowCount === 1 ? "" : "s"} tomorrow.`
              : upcoming.length > 0
                ? `${upcoming.length} item${upcoming.length === 1 ? "" : "s"} scheduled${upcoming[0] ? ` · next ${dueLabel(upcoming[0].due, today)}` : ""}.`
                : "Wrong answers from quizzes land here automatically."}
          </p>
          <div className="mt-4">
            <Button onClick={startSession} disabled={!user}>
              Start a short mixed review <Arrow />
            </Button>
          </div>
        </Card>
      ) : (
        /* The due list with one button. */
        <Card padding="p-0" className="overflow-hidden animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <h2 className="text-h2">
              {due.length} item{due.length === 1 ? "" : "s"} to review
            </h2>
            <Button onClick={startSession} disabled={!user} size="lg">
              Start review session <Arrow />
            </Button>
          </div>
          {groups.map((g) => (
            <div key={g.skill}>
              <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 border-t border-line bg-bg-elev">
                <SkillGlyph type={g.skill} size="sm" tone="accent" />
                <h3 className="font-semibold text-sm">{skillLabel(g.skill)}</h3>
                <span className="text-xs text-muted tabular-nums">{g.items.length}</span>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {g.items.map((it) => {
                  const p = progress.get(it.contentId);
                  const status = describeStatus(p?.status ?? "learning");
                  const link = linkFor(it.contentId);
                  return (
                    <li key={it.contentId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3">
                      <div className="min-w-0 flex-1 basis-48">
                        {link ? (
                          <Link href={link.href} className="font-medium hover:text-accent transition">
                            <span lang="ja" className="ja">
                              {link.title}
                            </span>
                          </Link>
                        ) : (
                          <span className="font-medium text-muted" aria-busy="true">
                            {it.contentId}
                          </span>
                        )}
                        <p className="text-xs text-muted mt-0.5">
                          {status.label}
                          {p && ` · ${p.correct}/${p.attempts} correct`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {it.priority >= 2 && <Badge tone={priorityTone(it.priority)}>priority {it.priority}</Badge>}
                        {it.due < today && <Badge tone="warn">{dueLabel(it.due, today)}</Badge>}
                        {it.source === "wrong-answer" && <Badge tone="accent">missed</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
