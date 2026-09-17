"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isSaved, saveItem, unsaveItem } from "@/lib/firestore/repo";
import type { SavedItemDoc } from "@/lib/firestore/types";

type Props = { contentId: string; type: SavedItemDoc["type"]; title: string; href: string };

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

const base = "inline-flex items-center gap-1.5 rounded-full border h-9 px-3.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait";
const idle = "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:border-line-strong hover:text-ink";
const on = "border-accent/30 bg-accent-soft text-accent-ink";

export function SaveButton({ contentId, type, title, href }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    isSaved(user.uid, contentId)
      .then((s) => alive && setSaved(s))
      .catch(() => alive && setSaved(false));
    return () => {
      alive = false;
    };
  }, [user, contentId]);

  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(href)}`} className={`${base} ${idle}`} title="Sign in to save">
        <BookmarkIcon filled={false} /> Save
      </Link>
    );
  }

  const toggle = async () => {
    if (busy || saved === null) return;
    setBusy(true);
    try {
      if (saved) {
        await unsaveItem(user.uid, contentId);
        setSaved(false);
      } else {
        await saveItem(user.uid, { contentId, type, title, href, savedAt: new Date().toISOString() });
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={busy || saved === null} aria-pressed={saved === true} className={`${base} ${saved ? on : idle}`} title={saved ? "Remove from saved" : "Save for later"}>
      <BookmarkIcon filled={saved === true} />
      {saved ? (
        <span className="inline-flex items-center gap-1">
          Saved <CheckIcon />
        </span>
      ) : (
        "Save"
      )}
    </button>
  );
}
