"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Card, ProgressBar, Section, Stat } from "@/components/ui";
import { LEVELS, type Level } from "@/lib/content/levels";
import { summarizeProgress, weeklySeries } from "@/lib/engine/progress";
import { STATUS_ORDER, describeStatus } from "@/lib/engine/srs";
import { getAllProgress, listDaily, listExamResults } from "@/lib/firestore/repo";
import { SKILLS, type DailyProgressDoc, type ExamResultDoc, type ProgressDoc, type ProgressStatus, type Skill } from "@/lib/firestore/types";
import { WeeklyChart } from "./WeeklyChart";
import { ErrorState, LoadingState, Ring, SignedOutState, SkillGlyph, errMessage, formatDate, formatMinutes, skillLabel } from "./shared";

type Data = { progress: ProgressDoc[]; daily: DailyProgressDoc[]; exams: ExamResultDoc[] };

type Props = {
  /** Catalog totals per skill over the whole roadmap. */
  totals: Record<Skill, number>;
  /** Catalog totals per skill for each JLPT level (kana is counted under N5). */
  totalsByLevel: Record<Level, Record<Skill, number>>;
};

const LEVEL_NAME: Record<Level, string> = { n5: "N5", n4: "N4", n3: "N3", n2: "N2", n1: "N1" };

/** Memory status is shown only once this many items are tracked. */
const STATUS_BAR_MIN_ITEMS = 10;
/** The weekly chart is shown only once this many weeks have study minutes. */
const WEEKLY_MIN_WEEKS = 2;

const STATUS_TONES = ["bg-line-strong", "bg-info", "bg-accent", "bg-ok/70", "bg-ok"];

export function ProgressClient({ totals, totalsByLevel }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { userDoc } = useUserDoc();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Roadmap totals default to the learner's current level; "All levels" widens them to the whole roadmap.
  const [allLevels, setAllLevels] = useState(false);
  const rawLevel = userDoc?.currentLevel;
  const level: Level = rawLevel && (LEVELS as string[]).includes(rawLevel) ? rawLevel : "n5";

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [progress, daily, exams] = await Promise.all([getAllProgress(user.uid), listDaily(user.uid, 90), listExamResults(user.uid, 50)]);
        if (!cancelled) setData({ progress, daily, exams });
      } catch (err) {
        if (!cancelled) setError(errMessage(err, "Could not load your progress."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const summary = useMemo(() => {
    if (!data) return null;
    if (allLevels) return summarizeProgress(data.progress, totals);
    // Kana (Foundation) items belong with N5, the level they lead into.
    const scoped = data.progress.filter((p) => p.level === level || (level === "n5" && p.level === "foundation"));
    return summarizeProgress(scoped, totalsByLevel[level] ?? totals);
  }, [data, totals, totalsByLevel, allLevels, level]);
  const series = useMemo(() => (data ? weeklySeries(data.daily, 8) : []), [data]);
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ProgressStatus, number>;
    for (const p of data?.progress ?? []) if (counts[p.status] !== undefined) counts[p.status] += 1;
    return counts;
  }, [data]);
  const totalMinutes = useMemo(() => (data?.daily ?? []).reduce((a, d) => a + Math.max(0, d.minutes || 0), 0), [data]);

  if (!authLoading && !user) return <SignedOutState />;
  if (error) return <ErrorState message={error} />;
  if (!data || !summary) return <LoadingState label="Loading your progress…" rows={4} />;

  const best = data.exams.reduce<ExamResultDoc | null>((b, e) => (b === null || e.totalScaled > b.totalScaled ? e : b), null);
  const latest = data.exams[0] ?? null;
  const mastered = data.progress.filter((p) => p.status === "mastered").length;
  const statusTotal = Math.max(1, data.progress.length);
  const scopeName = allLevels ? "All levels" : LEVEL_NAME[level];
  const activeWeeks = series.filter((w) => w.minutes > 0).length;

  // Stat tiles render only with a non-zero value.
  const stats: { label: string; value: string; hint?: string; tone?: "neutral" | "accent" | "ok" }[] = [];
  if (totalMinutes > 0) stats.push({ label: "Studied", value: formatMinutes(totalMinutes), hint: "last 90 days" });
  if (data.progress.length > 0) stats.push({ label: "Items tracked", value: String(data.progress.length) });
  if (mastered > 0) stats.push({ label: "Mastered", value: String(mastered), hint: `${Math.round((mastered / statusTotal) * 100)}% of tracked`, tone: "ok" });
  if (data.exams.length > 0 && best) stats.push({ label: "Mock exams", value: String(data.exams.length), hint: `best ${Math.round(best.totalScaled)} / 180`, tone: best.passedEstimate ? "ok" : "neutral" });

  const scopeToggle = (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-xs font-medium" role="group" aria-label="Roadmap scope">
      {[
        { key: false, label: `${LEVEL_NAME[level]} only` },
        { key: true, label: "All levels" },
      ].map((o) => (
        <button
          key={String(o.key)}
          type="button"
          aria-pressed={allLevels === o.key}
          onClick={() => setAllLevels(o.key)}
          className={`rounded-full px-3 py-1.5 transition ${allLevels === o.key ? "bg-ink text-surface shadow-sm" : "text-ink-2 hover:bg-surface-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pb-12 max-w-full min-w-0">
      {/* Overall: ring + scope toggle */}
      <Card className="animate-rise" padding="p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Ring value={summary.overallPercent} size={136} stroke={11} label={`Learned, ${scopeName}`}>
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight leading-none">{Math.round(summary.overallPercent)}%</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted mt-1">learned</p>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <h2 className="text-h2">{scopeName}</h2>
            <div className="mt-3">{scopeToggle}</div>
          </div>
        </div>
      </Card>

      {stats.length > 0 && (
        <div className={`mt-4 grid grid-cols-2 gap-3 sm:gap-4 animate-rise-2 max-w-full ${stats.length >= 3 ? "lg:grid-cols-4" : ""}`}>
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} hint={s.hint} tone={s.tone} />
          ))}
        </div>
      )}

      {/* Per skill: six rows */}
      <Section title="By skill">
        <Card padding="p-0" className="overflow-hidden">
          <ul className="divide-y divide-line" aria-label="Progress by skill">
            {SKILLS.map((s) => {
              const b = summary.bySkill[s];
              return (
                <li key={s} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <SkillGlyph type={s} size="sm" tone={b.learned > 0 ? "accent" : "neutral"} />
                  <span className="w-28 shrink-0 font-medium">{skillLabel(s)}</span>
                  <div className="min-w-0 flex-1 hidden sm:block">
                    <ProgressBar value={b.percent} size="sm" />
                  </div>
                  <span className="ml-auto text-sm tabular-nums whitespace-nowrap">
                    {b.learned} / {b.total}
                    {b.mastered > 0 && <span className="text-ok"> · {b.mastered} mastered</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </Section>

      {/* Mock exams: only once one exists */}
      {data.exams.length > 0 && (
        <Section
          title="Mock exams"
          actions={
            <Link href="/mock-exams/history" className="text-sm text-accent hover:underline whitespace-nowrap">
              All results
            </Link>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Best", r: best },
              { label: "Latest", r: latest },
            ].map(({ label, r }) =>
              r ? (
                <Card key={label} hover>
                  <div className="flex items-center gap-4">
                    <Ring value={(r.totalScaled / 180) * 100} size={84} stroke={8} tone={r.passedEstimate ? "ok" : "warn"} label={`${label} scaled score`}>
                      <span className="text-lg font-semibold tabular-nums leading-none">{Math.round(r.totalScaled)}</span>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
                        <Badge tone={r.passedEstimate ? "ok" : "warn"}>{r.passedEstimate ? "Pass estimate" : "Below pass line"}</Badge>
                      </div>
                      <p className="mt-1 font-semibold truncate" lang="ja">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted">{formatDate(r.date)}</p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {r.sections.map((sec) => (
                      <li key={sec.id}>
                        <div className="flex justify-between gap-2 mb-1">
                          <span lang="ja" className="truncate">
                            {sec.name}
                          </span>
                          <span className="tabular-nums text-muted shrink-0">
                            {Math.round(sec.scaled)} / 60 · {sec.score}/{sec.total} raw
                          </span>
                        </div>
                        <ProgressBar value={(sec.scaled / 60) * 100} size="sm" tone={sec.scaled >= 19 ? "ok" : "accent"} />
                      </li>
                    ))}
                  </ul>
                  <Link href={`/mock-exams/history/${encodeURIComponent(r.id)}`} className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                    Review this exam <Arrow className="h-3.5 w-3.5" />
                  </Link>
                </Card>
              ) : null
            )}
          </div>
        </Section>
      )}

      {/* Over time: only once two weeks have data */}
      {activeWeeks >= WEEKLY_MIN_WEEKS && (
        <Section title="Progress over time">
          <Card className="min-w-0 max-w-full">
            <WeeklyChart series={series} />
          </Card>
        </Section>
      )}

      {/* Memory status: only once enough items are tracked */}
      {data.progress.length >= STATUS_BAR_MIN_ITEMS && (
        <Section title="Memory status">
          <Card padding="p-0" className="overflow-hidden">
            <div className="flex h-2.5 w-full overflow-hidden bg-surface-2" aria-hidden>
              {STATUS_ORDER.map((s, i) => {
                const w = (statusCounts[s] / statusTotal) * 100;
                const tone = STATUS_TONES[i] ?? "bg-ok";
                return w > 0 ? <span key={s} className={`${tone} h-full transition-[width] duration-700`} style={{ width: `${w}%` }} title={describeStatus(s).label} /> : null;
              })}
            </div>
            <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5 p-5 sm:p-6">
              {STATUS_ORDER.map((s, i) => {
                const d = describeStatus(s);
                const dot = STATUS_TONES[i] ?? "bg-ok";
                return (
                  <li key={s} className="flex gap-3 items-start">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {d.label} <span className="text-muted font-normal tabular-nums">· {statusCounts[s]}</span>
                      </p>
                      <p className="text-xs text-muted mt-0.5">{d.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>
      )}
    </div>
  );
}
