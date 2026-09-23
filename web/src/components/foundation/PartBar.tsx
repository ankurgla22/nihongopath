"use client";
/**
 * Sticky "Part x of N · Jump to quick check" mini-bar for long foundation lessons.
 * Tracks which part is in view with an IntersectionObserver; hidden until the reader
 * scrolls past the lesson header so it never competes with the title.
 */
import { useEffect, useState } from "react";

export function PartBar({ parts, quickCheckId }: { parts: { id: string; label: string }[]; quickCheckId?: string }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const els = parts.map((p) => document.getElementById(p.id)).filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const first = els[0];
    const onScroll = () => setVisible(first.getBoundingClientRect().top < 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = els.indexOf(e.target as HTMLElement);
            if (i >= 0) setCurrent(i);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, [parts]);

  if (parts.length === 0) return null;
  const part = parts[Math.min(current, parts.length - 1)];

  return (
    <div
      aria-hidden={!visible}
      className={`sticky top-[4.5rem] sm:top-20 z-30 -mx-4 px-4 sm:mx-0 sm:px-0 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="glass border border-line rounded-full shadow-md px-3.5 py-2 flex items-center gap-3 text-sm">
        <span className="inline-flex h-6 min-w-[1.5rem] px-1.5 items-center justify-center rounded-full accent-gradient text-white text-[11px] font-semibold tabular-nums" aria-hidden>
          {current + 1}
        </span>
        <p className="min-w-0 flex-1 truncate text-muted">
          Part <span className="text-ink font-semibold tabular-nums">{current + 1}</span> of <span className="tabular-nums">{parts.length}</span>
          <span className="hidden sm:inline"> · <span className="text-ink-2">{part.label}</span></span>
        </p>
        <span className="inline-flex items-center gap-1">
          {current + 1 < parts.length && (
            <a
              href={`#${parts[current + 1].id}`}
              // The bar is aria-hidden while invisible, but opacity and pointer-events leave an
              // anchor focusable, so keyboard focus disappeared into it and screen readers
              // announced nothing for two stops.
              tabIndex={visible ? undefined : -1}
              className="hidden sm:inline text-xs font-medium text-ink-2 hover:text-accent px-2 py-1 rounded-full"
            >
              Next part
            </a>
          )}
          {quickCheckId && (
            <a href={`#${quickCheckId}`} tabIndex={visible ? undefined : -1} className="text-xs font-medium text-accent hover:underline whitespace-nowrap px-2 py-1 rounded-full">
              Jump to quick check
            </a>
          )}
        </span>
      </div>
    </div>
  );
}
