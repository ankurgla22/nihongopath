"use client";
import { useEffect } from "react";

/**
 * Publishes the site header's real height as `--header-h` on the document element.
 *
 * Everything that sticks or scrolls into place sits under that header, and its height is not a
 * constant. On a phone the header is the 64px bar plus a nav row that collapses away as you
 * scroll down and comes back as you scroll up, so it moves between roughly 64px and 108px while
 * the page is being read. Anything pinned at a hard-coded `top-16` is therefore correct on
 * desktop and covered by the nav row on mobile, and any anchor with a hard-coded `scroll-mt`
 * lands its heading underneath that row.
 *
 * Measuring once is not enough for the same reason, so a ResizeObserver keeps the value current.
 * `globals.css` defines a 4rem fallback for first paint and for anyone running without JS.
 */
export function HeaderHeight() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const apply = () => {
      const h = Math.round(header.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty("--header-h", `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return null;
}
