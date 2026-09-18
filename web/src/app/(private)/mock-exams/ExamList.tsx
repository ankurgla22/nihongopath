"use client";
import { useEffect, useState } from "react";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { levelForPhase } from "@/components/study/helpers";
import { phaseOf } from "@/lib/study/service";
import { LEVELS, LEVEL_LABEL, type Level } from "@/lib/content/levels";
import { Arrow, Badge, Button, Card } from "@/components/ui";
import { examTitle, sectionGloss } from "@/components/exam/examLabels";

export type ExamCard = {
  id: string;
  level: Level;
  title: string;
  description: string;
  minutes: number;
  questions: number;
  sections: { id: string; name: string; skill: "language" | "reading" | "listening"; questions: number; minutes: number }[];
};

type Filter = Level | "all";

/** Mock exam list with a "Your level" filter that defaults to the learner's current level. */
export function ExamList({ exams }: { exams: ExamCard[] }) {
  const { userDoc, loading } = useUserDoc();
  const yourLevel: Level | null = userDoc ? levelForPhase(phaseOf(userDoc.currentDay)) : null;
  const [filter, setFilter] = useState<Filter | null>(null);

  // Default to the learner's level once it is known; "all" if the profile does not load.
  useEffect(() => {
    if (filter !== null || loading) return;
    setFilter(yourLevel ?? "all");
  }, [filter, loading, yourLevel]);

  const active: Filter = filter ?? yourLevel ?? "all";
  const shown = active === "all" ? exams : exams.filter((e) => e.level === active);

  return (
    <div className="pb-16">
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by level">
        <span className="text-xs uppercase tracking-[0.14em] text-muted mr-1">Show</span>
        {yourLevel && (
          <FilterChip active={active === yourLevel} onClick={() => setFilter(yourLevel)}>
            Your level · {LEVEL_LABEL[yourLevel]}
          </FilterChip>
        )}
        <FilterChip active={active === "all"} onClick={() => setFilter("all")}>
          All levels
        </FilterChip>
        {LEVELS.filter((l) => l !== yourLevel).map((l) => (
          <FilterChip key={l} active={active === l} onClick={() => setFilter(l)}>
            {LEVEL_LABEL[l]}
          </FilterChip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted">No exams for this level yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 animate-rise">
          {shown.map((e) => (
            <Card as="li" key={e.id} hover padding="p-0" className="flex flex-col overflow-hidden">
              <div className="p-5 sm:p-6 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{LEVEL_LABEL[e.level]}</Badge>
                  <Badge>{e.minutes} min</Badge>
                  <Badge>{e.questions} questions</Badge>
                </div>
                <h2 className="mt-3 text-h2">{examTitle(e)}</h2>
                <p lang="ja" className="ja text-sm text-muted mt-0.5">
                  {e.title}
                </p>
                <p className="mt-2 text-sm text-muted">{e.description}</p>
              </div>
              <ul className="border-t border-line divide-y divide-line text-sm">
                {e.sections.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 sm:px-6 py-2">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold tabular-nums">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{sectionGloss(s)}</span>
                        <span lang="ja" className="ja block text-xs text-muted truncate">
                          {s.name}
                        </span>
                      </span>
                    </span>
                    <span className="text-muted whitespace-nowrap tabular-nums text-xs">
                      {s.questions} q · {s.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line bg-bg-elev px-5 sm:px-6 py-4">
                <Button href={`/mock-exams/${e.id}`}>
                  Start exam <Arrow />
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center h-8 rounded-full border px-3 text-sm transition ${active ? "bg-accent-soft border-accent/30 text-accent-ink font-medium" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}
