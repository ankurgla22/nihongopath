"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Arrow, Button, Card, Section } from "@/components/ui";
import { listSaved, unsaveItem } from "@/lib/firestore/repo";
import type { SavedItemDoc } from "@/lib/firestore/types";
import { EmptyState, ErrorState, LoadingState, SignedOutState, SkillGlyph, errMessage, formatDate, skillLabel } from "./shared";

const TYPE_ORDER = ["grammar", "vocabulary", "kanji", "reading", "listening", "question"];

function typeLabel(t: string): string {
  return t === "question" ? "Questions" : skillLabel(t);
}

export function SavedClient() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedItemDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    listSaved(user.uid)
      .then((s) => !cancelled && setItems(s))
      .catch((err) => !cancelled && setError(errMessage(err, "Could not load your saved items.")));
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const groups = useMemo(() => {
    const g = new Map<string, SavedItemDoc[]>();
    for (const it of items ?? []) (g.get(it.type) ?? g.set(it.type, []).get(it.type)!).push(it);
    return Array.from(g.entries()).sort(([a], [b]) => {
      const ia = TYPE_ORDER.indexOf(a);
      const ib = TYPE_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [items]);

  async function remove(item: SavedItemDoc) {
    if (!user) return;
    setBusy((b) => new Set(b).add(item.contentId));
    setNotice(null);
    try {
      await unsaveItem(user.uid, item.contentId);
      setItems((prev) => (prev ?? []).filter((x) => x.contentId !== item.contentId));
      setNotice(`Removed “${item.title}” from your saved items.`);
    } catch (err) {
      setNotice(errMessage(err, "Could not remove that item."));
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(item.contentId);
        return n;
      });
    }
  }

  if (!authLoading && !user) return <SignedOutState />;
  if (error) return <ErrorState message={error} />;
  if (!items) return <LoadingState label="Loading your saved items…" rows={4} />;

  return (
    <div className="pb-12">
      {/* The slot keeps its height whether or not there is a notice: growing from nothing to a
          bordered box after a Remove would push the list down and slide the next Remove button
          under the finger that just tapped. */}
      <div className="mb-4 min-h-[2.75rem]">
        <p role="status" aria-live="polite" className={`text-sm text-muted ${notice ? "rounded-xl border border-line bg-surface-2 px-4 py-2.5 animate-rise" : "sr-only"}`}>
          {notice ?? ""}
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          action={
            <Button href="/japanese" variant="secondary" size="sm">
              Browse lessons
            </Button>
          }
        >
          Press <strong>Save</strong> on any lesson or question and it will appear here.
        </EmptyState>
      ) : (
        <>
          {groups.map(([type, list]) => (
            <Section key={type} title={`${typeLabel(type)} · ${list.length}`}>
              <Card padding="p-0" className="overflow-hidden">
                <ul className="divide-y divide-line" aria-label={`Saved ${typeLabel(type).toLowerCase()}`}>
                  {list.map((it) => {
                    const isBusy = busy.has(it.contentId);
                    return (
                      <li key={it.contentId} className="flex items-center gap-3 sm:gap-4 p-3 sm:px-5 sm:py-3.5 hover:bg-surface-2/60 transition">
                        <SkillGlyph type={type} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link href={it.href} lang={type === "question" ? undefined : "ja"} className={`group inline-flex items-center gap-1.5 font-medium hover:text-accent transition ${type === "question" ? "" : "ja"}`}>
                            <span className="truncate">{it.title}</span>
                            <Arrow className="h-3.5 w-3.5 text-muted group-hover:text-accent shrink-0" />
                          </Link>
                          <p className="text-xs text-muted mt-0.5">
                            Saved <time dateTime={it.savedAt}>{formatDate(it.savedAt.slice(0, 10))}</time>
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => remove(it)} disabled={isBusy} ariaLabel={`Remove ${it.title} from saved items`}>
                          {isBusy ? "Removing…" : "Remove"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </Section>
          ))}
        </>
      )}
    </div>
  );
}
