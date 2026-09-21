"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { todayISO, type ProgressDoc, type Skill } from "@/lib/firestore/types";

// Firestore is loaded on demand so public lesson pages do not ship the SDK for signed-out visitors.
const repo = () => import("@/lib/firestore/repo");

type Props = { contentId: string; type: Skill; level: ProgressDoc["level"]; href: string };

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return todayISO(d);
}

function CheckCircle({ filled }: { filled: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" fill={filled ? "currentColor" : "none"} className={filled ? "opacity-20" : ""} />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

const base = "inline-flex items-center gap-1.5 rounded-full h-9 px-3.5 text-sm font-medium transition active:scale-[0.98]";
// Outline, never filled: the lesson's one filled control is the quick check / NEXT card, not this.
const outline = "border border-ink/20 text-ink hover:bg-surface-2";

export function MarkComplete({ contentId, type, level, href }: Props) {
  const { user } = useAuth();
  const [done, setDone] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    repo()
      .then(({ getProgress }) => getProgress(user.uid, contentId))
      .then((p) => alive && setDone(Boolean(p?.completed)))
      .catch(() => alive && setDone(false));
    return () => {
      alive = false;
    };
  }, [user, contentId]);

  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(href)}`} className={`${base} ${outline}`}>
        <CheckCircle filled={false} /> Sign in to track
      </Link>
    );
  }

  const mark = async () => {
    if (busy || done) return;
    setBusy(true);
    try {
      const today = todayISO();
      const { getProgress, setProgressBatch } = await repo();
      const prev = await getProgress(user.uid, contentId);
      const doc: ProgressDoc = {
        contentId,
        type,
        level,
        status: prev?.status && prev.status !== "new" ? prev.status : "learning",
        firstLearned: prev?.firstLearned ?? today,
        lastReviewed: today,
        attempts: prev?.attempts ?? 0,
        correct: prev?.correct ?? 0,
        incorrect: prev?.incorrect ?? 0,
        ease: prev?.ease ?? 2.5,
        intervalDays: prev?.intervalDays ?? 1,
        nextReview: prev?.nextReview && prev.nextReview > today ? prev.nextReview : tomorrowISO(),
        completed: true,
      };
      await setProgressBatch(user.uid, [doc]);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <span className={`${base} border border-ok/25 bg-ok-soft text-ok`} role="status" title="Marked as learned. Review scheduled for tomorrow.">
        <CheckCircle filled />
        Learned <span className="hidden sm:inline text-ok/80 font-normal">· review tomorrow</span>
      </span>
    );
  }

  return (
    <button type="button" onClick={mark} disabled={busy || done === null} className={`${base} ${outline} disabled:opacity-60 disabled:cursor-wait`}>
      <CheckCircle filled={false} /> Mark as learned
    </button>
  );
}
