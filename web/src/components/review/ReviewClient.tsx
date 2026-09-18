"use client";
/**
 * Review queue: due items grouped by type with SRS status, due date and priority, plus a
 * review session (QuizRunner) whose correct answers clear items via completeQuiz(kind "review").
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Question, QuestionIndexEntry } from "@/lib/content/schemas";
import { SKILLS, todayISO, type ProgressDoc, type ReviewItemDoc, type Skill } from "@/lib/firestore/types";
import { getAllProgress, listReviewItems } from "@/lib/firestore/repo";
import { completeQuiz } from "@/lib/study/service";
import { describeStatus } from "@/lib/engine/srs";
import { skillLabel } from "@/lib/engine/dailyPlan";
import type { SubmittedAnswer } from "@/lib/engine/scoring";
import { curriculumDayFor } from "@/lib/engine/progress";
import { fetchDrill, fetchQuestionsByIds } from "@/lib/questions/client";
import { isDrillable } from "@/lib/drill/generate";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Button, Callout, Card, EmptyState, PageTitle, Stat } from "@/components/ui";
import { LoadingState, SkillGlyph } from "@/components/progress/shared";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { addDaysISO, isQueuedError, reviewQuestions, type ContentLinks } from "@/components/study/helpers";

/** `questionIndex` is the slim bank (id/level/skill/difficulty/tags); full records are fetched on demand. */
type Props = { questionIndex: QuestionIndexEntry[]; contentLinks: ContentLinks };

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

export function ReviewClient({ questionIndex, contentLinks }: Props) {
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

  const groups = useMemo(() => {
    const g = new Map<Skill, ReviewItemDoc[]>();
    for (const s of SKILLS) g.set(s, []);
    for (const it of due) g.get(it.type)?.push(it);
    return SKILLS.map((s) => ({ skill: s, items: g.get(s) ?? [] })).filter((x) => x.items.length > 0);
  }, [due]);

  const upcomingBuckets = useMemo(() => {
    const in3 = addDaysISO(today, 3);
    const in7 = addDaysISO(today, 7);
    const tomorrow = addDaysISO(today, 1);
    return {
      tomorrow: upcoming.filter((i) => i.due === tomorrow).length,
      within3: upcoming.filter((i) => i.due <= in3).length,
      within7: upcoming.filter((i) => i.due <= in7).length,
      later: upcoming.filter((i) => i.due > in7).length,
    };
  }, [upcoming, today]);

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
  const startSession = () => {
    if (!user) return;
    const count = Math.min(SESSION_MAX, Math.max(SESSION_MIN, due.length));
    const seed = `${user.uid}-${today}-review-${Date.now()}`;
    const drillIds = due.filter((i) => isDrillable(i.contentId)).slice(0, count).map((i) => i.contentId);
    const others = due.filter((i) => !isDrillable(i.contentId));
    const bankCount = count - drillIds.length;
    const picked = bankCount > 0 ? reviewQuestions(questionIndex, others, bankCount, seed) : [];
    setSessionItems(due);
    setNotice(null);
    void loadSession({ ids: picked.map((q) => q.id), drillIds, seed });
  };

  const closeSession = () => {
    sessionToken.current++;
    setSession(null);
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

  const overdue = due.filter((i) => i.due < today).length;
  const missed = due.filter((i) => i.source === "wrong-answer").length;

  return (
    <div className="pb-16">
      <PageTitle
        eyebrow="Spaced repetition"
        title="Review queue"
        description="Items you missed or that are due by schedule. Answer them correctly to push them further out; miss them and they come back tomorrow."
      />

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
          storageKey={`nihongo-path:quiz:${user?.uid ?? "anon"}:${today}:review-session`}
          contentLinks={contentLinks}
          onComplete={onComplete}
          onExit={closeSession}
          resultActions={
            <>
              <Button
                onClick={() => {
                  closeSession();
                  setNotice("Items answered correctly were cleared; missed items stay due.");
                }}
              >
                Back to queue
              </Button>
              <Button variant="secondary" href="/daily-study">
                Continue today&apos;s study
              </Button>
            </>
          }
        />
      ) : (
        <>
          {/* Stat row */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 animate-rise">
            <Stat label="Due today" value={items === null ? <span className="skeleton inline-block h-7 w-12" /> : due.length} tone={due.length > 0 ? "accent" : "ok"} hint={items === null ? undefined : due.length === 0 ? "queue is clear" : "highest priority first"} />
            <Stat label="Overdue" value={items === null ? <span className="skeleton inline-block h-7 w-12" /> : overdue} hint="past their due date" />
            <Stat label="From mistakes" value={items === null ? <span className="skeleton inline-block h-7 w-12" /> : missed} hint="added by wrong answers" />
            <Stat label="Scheduled" value={items === null ? <span className="skeleton inline-block h-7 w-12" /> : upcoming.length} hint={`${upcomingBuckets.tomorrow} tomorrow`} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4 min-w-0">
              <Card className="relative overflow-hidden animate-rise-2">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-soft opacity-70 blur-3xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-h2">{items === null ? "Preparing your session…" : due.length === 0 ? "Nothing due right now" : `${due.length} item${due.length === 1 ? "" : "s"} to review`}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {due.length === 0 && items !== null ? "A short mixed review is still available." : `A session draws up to ${SESSION_MAX} questions, highest priority first.`}
                    </p>
                  </div>
                  <Button onClick={startSession} disabled={items === null || !user} size="lg">
                    Start review session <Arrow />
                  </Button>
                </div>
              </Card>

              {items === null && <LoadingState label="Loading your review queue…" rows={3} />}

              {groups.map((g) => (
                <Card key={g.skill} padding="p-0" className="overflow-hidden">
                  <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-line bg-bg-elev">
                    <SkillGlyph type={g.skill} size="sm" tone="accent" />
                    <h3 className="font-semibold">{skillLabel(g.skill)}</h3>
                    <Badge>{g.items.length}</Badge>
                  </div>
                  <ul className="divide-y divide-line">
                    {g.items.map((it) => {
                      const p = progress.get(it.contentId);
                      const status = describeStatus(p?.status ?? "learning");
                      const link = contentLinks[it.contentId];
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
                              <span className="font-medium">{it.contentId}</span>
                            )}
                            <p className="text-xs text-muted mt-0.5">
                              <span className="font-medium text-ink-2">{status.label}</span> — {status.description}
                              {p && ` · ${p.correct}/${p.attempts} correct`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <Badge tone={priorityTone(it.priority)}>priority {it.priority}</Badge>
                            <Badge tone={it.due < today ? "warn" : "neutral"}>{dueLabel(it.due, today)}</Badge>
                            <Badge tone={it.source === "wrong-answer" ? "accent" : "neutral"}>{it.source === "wrong-answer" ? "missed" : "scheduled"}</Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}

              {items !== null && due.length === 0 && (
                <EmptyState title="Your queue is clear" action={<Button href="/daily-study" variant="secondary">Continue today&apos;s study</Button>}>
                  Wrong answers from quizzes and tests land here automatically, and correctly answered items return on their SRS schedule.
                </EmptyState>
              )}
            </div>

            <aside className="space-y-4 min-w-0">
              <Card padding="p-4 sm:p-5">
                <h2 className="font-semibold">Upcoming</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  {[
                    { k: "Tomorrow", v: upcomingBuckets.tomorrow },
                    { k: "Within 3 days", v: upcomingBuckets.within3 },
                    { k: "Within 7 days", v: upcomingBuckets.within7 },
                    { k: "Later", v: upcomingBuckets.later },
                  ].map((r) => (
                    <div key={r.k} className="flex items-center gap-3">
                      <dt className="flex-1 text-ink-2">{r.k}</dt>
                      <div className="h-1.5 w-20 rounded-full bg-surface-2 border border-line/60 overflow-hidden" aria-hidden>
                        <div className="h-full bg-info rounded-full" style={{ width: `${upcoming.length ? (r.v / upcoming.length) * 100 : 0}%` }} />
                      </div>
                      <dd className="w-6 text-right tabular-nums text-muted">{r.v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-line pt-2 font-medium">
                    <dt>Total scheduled</dt>
                    <dd className="tabular-nums">{upcoming.length}</dd>
                  </div>
                </dl>
                {upcoming.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-xs text-muted border-t border-line pt-3">
                    {upcoming.slice(0, 5).map((it) => (
                      <li key={it.contentId} className="flex justify-between gap-2">
                        <span className="truncate ja" lang="ja">
                          {contentLinks[it.contentId]?.title ?? it.contentId}
                        </span>
                        <span className="shrink-0 tabular-nums">{dueLabel(it.due, today)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card padding="p-4 sm:p-5">
                <h2 className="font-semibold">How it works</h2>
                <ol className="mt-3 space-y-2.5 text-sm text-ink-2">
                  {["New → Learning → Review → Strong → Mastered.", "A correct answer lengthens the interval; a miss resets it to tomorrow.", "Items with a higher priority are overdue or have a low ease."].map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold text-muted tabular-nums">{i + 1}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
