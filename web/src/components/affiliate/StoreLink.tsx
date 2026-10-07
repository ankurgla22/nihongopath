"use client";
/**
 * The buy link on a book card. Server-rendered for amazon.com, then switched in the browser to
 * the visitor's store (see lib/affiliate/stores), with a picker to override it. Every click is
 * reported to Analytics as affiliate_click, which is how we learn which pages and books earn —
 * the question an admin console would not have answered.
 */
import { useEffect, useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { bookUrl, DEFAULT_STORE, inferStore, isStoreId, STORE_IDS, STORE_STORAGE_KEY, STORES, type BookStoreEntry, type StoreId } from "@/lib/affiliate/stores";

type Props = { bookId: string; stores: Partial<Record<StoreId, BookStoreEntry>>; title: string };

function readStored(): StoreId | null {
  try {
    const v = localStorage.getItem(STORE_STORAGE_KEY);
    return isStoreId(v) ? v : null;
  } catch {
    return null;
  }
}

export function StoreLink({ bookId, stores, title }: Props) {
  const [store, setStore] = useState<StoreId>(DEFAULT_STORE);
  const pathname = usePathname();

  // After hydration only, so the server and first client render agree.
  useEffect(() => {
    const stored = readStored();
    if (stored) return setStore(stored);
    try {
      setStore(inferStore(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages ?? [navigator.language]));
    } catch {
      /* keep the default */
    }
  }, []);

  // A store with no entry for this book falls back to amazon.com rather than a dead search.
  const active: StoreId = stores[store] ? store : DEFAULT_STORE;
  const entry = stores[active] ?? stores[DEFAULT_STORE];
  if (!entry) return null;
  const s = STORES[active];
  const href = bookUrl(entry, s);
  const available = STORE_IDS.filter((id) => stores[id]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <a
        href={href}
        rel="sponsored nofollow noopener"
        target="_blank"
        onClick={() => sendGAEvent("event", "affiliate_click", { book: bookId, store: active, page: pathname })}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
      >
        Buy on {s.name}
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
      {available.length > 1 && (
        <label className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className="sr-only">Amazon store for {title}</span>
          <select
            value={active}
            onChange={(e) => {
              const next = e.target.value;
              if (!isStoreId(next)) return;
              setStore(next);
              try {
                localStorage.setItem(STORE_STORAGE_KEY, next);
              } catch {
                /* storage unavailable */
              }
            }}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink-2 focus:border-accent focus:outline-none"
            aria-label="Choose an Amazon store"
          >
            {available.map((id) => (
              <option key={id} value={id}>
                {STORES[id].name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
