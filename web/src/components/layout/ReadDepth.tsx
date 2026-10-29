"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const MARKS = [25, 50, 75, 100] as const;

/**
 * Reports how far down each page the visitor reads, as read_depth at 25/50/75/100%.
 *
 * GA's own scroll event only fires at 90% and has never shown up for this site, which left no way
 * to tell a lesson people finish from one they abandon halfway. Each mark is sent once per page
 * view and only from a real scroll, so a page that fits the screen reports nothing rather than
 * 100%. Keyed on the pathname, so client-side navigation starts a fresh count.
 */
export function ReadDepth() {
  const pathname = usePathname();
  useEffect(() => {
    const sent = new Set<number>();
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Next fires a scroll event at the top on load and on navigation, while the page can still be
      // a short loading state; measured then, it reads as 75% read before anything has been seen.
      if (window.scrollY <= 0) return;
      const doc = document.documentElement;
      const pct = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
      for (const m of MARKS) {
        // 98 for the last mark: a footer margin or rounding can keep the bottom a few pixels away.
        if (sent.has(m) || pct < (m === 100 ? 98 : m)) continue;
        sent.add(m);
        track("read_depth", { depth: m });
      }
      if (sent.size === MARKS.length) window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return null;
}
