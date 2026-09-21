"use client";
import { useEffect, useState } from "react";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { levelForPhase } from "@/components/study/helpers";
import { phaseOf } from "@/lib/study/service";
import { LEVELS, LEVEL_LABEL, type Level } from "@/lib/content/levels";
import { Arrow, Button, Card } from "@/components/ui";
import { sectionGloss } from "@/components/exam/examLabels";

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

/** "A" from "n5-mock-a"; falls back to the position in the level's list. */
function variantOf(id: string, index: number): string {
  const m = /-([a-z0-9]+)$/i.exec(id);
  return m ? m[1].toUpperCase() : String.fromCharCode(65 + index);
}

/** Mock exam list: "Your level / All levels" toggle and one card per level with the A/B/C variants as buttons. */
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
  // One card per level; the exams of a level differ only by their A/B/C variant.
  const byLevel = LEVELS.map((l) => ({ level: l, exams: shown.filter((e) => e.level === l) })).filter((g) => g.exams.length > 0);

  return (
    <div className="pb-16">
      <div className="mb-5 inline-flex rounded-full border border-line bg-surface p-0.5 text-xs font-medium" role="group" aria-label="Filter by level">
        {yourLevel && (
          <FilterChip active={active === yourLevel} onClick={() => setFilter(yourLevel)}>
            Your level ({LEVEL_LABEL[yourLevel]})
          </FilterChip>
        )}
        <FilterChip active={active === "all"} onClick={() => setFilter("all")}>
          All levels
        </FilterChip>
      </div>

      {byLevel.length === 0 ? (
        <p className="text-sm text-muted">No exams for this level yet.</p>
      ) : (
        <ul className="grid gap-4 animate-rise">
          {byLevel.map((g) => {
            const first = g.exams[0];
            return (
              <Card as="li" key={g.level} padding="p-0" className="overflow-hidden">
                <div className="p-5 sm:p-6">
                  <h2 className="text-h2">
                    {LEVEL_LABEL[g.level]} mock exam <span className="text-muted font-normal tabular-nums">· {first.minutes} min · {first.questions} questions</span>
                  </h2>
                </div>
                <ul className="border-t border-line divide-y divide-line text-sm">
                  {first.sections.map((s, i) => (
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
                <div className="border-t border-line bg-bg-elev px-5 sm:px-6 py-4 flex flex-wrap gap-2">
                  {g.exams.map((e, i) => (
                    <Button key={e.id} href={`/mock-exams/${e.id}`} variant="outline">
                      Start exam {variantOf(e.id, i)} <Arrow />
                    </Button>
                  ))}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-full px-3 py-1.5 transition ${active ? "bg-ink text-surface shadow-sm" : "text-ink-2 hover:bg-surface-2"}`}>
      {children}
    </button>
  );
}
