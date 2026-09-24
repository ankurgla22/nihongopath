/**
 * Bring an element to rest just below the sticky header, and keep it there.
 *
 * Every screen that swaps content in place needs this: advancing a quiz question, moving between
 * exam questions, stepping through a listening exercise, revealing answers. Without it the page
 * keeps the scroll position it had, and the new content renders above the fold or underneath the
 * header, so the user sees answer options with nothing saying what they answer.
 *
 * Two things make a single scrollTo insufficient.
 *
 * The header is not a fixed height. On a phone it is the 64px bar plus a nav row that collapses
 * on scroll-down and returns on scroll-up. `--header-h` tracks it (components/layout/HeaderHeight),
 * but reading it once is not enough, because scrolling *up* is precisely what makes that row come
 * back: the header grows by roughly 50px after the scroll has been computed, and lands the target
 * underneath it. So this re-measures once the scroll has settled and nudges again if the element
 * ended up covered.
 *
 * A sticky bar may also sit between the header and the content — a quiz progress bar, an exam
 * timer — so callers pass that element and its height is added to the clearance.
 */

const GAP = 12; // a little breathing room under the last sticky bar

function headerBottom(): number {
  const header = document.querySelector("header");
  if (header) {
    const r = header.getBoundingClientRect();
    // Only counts while it is actually pinned at the top of the viewport.
    if (r.top <= 1) return r.bottom;
  }
  const declared = getComputedStyle(document.documentElement).getPropertyValue("--header-h").trim();
  const px = declared.endsWith("rem") ? parseFloat(declared) * 16 : parseFloat(declared);
  return Number.isFinite(px) ? px : 64;
}

/**
 * @param target the element that should end up visible, usually the question or step body
 * @param under  a sticky bar between the header and the target, whose height must also be cleared
 */
export function scrollUnderHeader(target: HTMLElement | null, under?: HTMLElement | null): void {
  if (!target || typeof window === "undefined") return;

  const place = (behavior: ScrollBehavior) => {
    const offset = headerBottom() + (under?.offsetHeight ?? 0) + GAP;
    const top = target.getBoundingClientRect().top;
    if (Math.abs(top - offset) < 8) return false; // already where it should be
    window.scrollTo({ top: Math.max(0, window.scrollY + top - offset), behavior });
    return true;
  };

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!place(reduce ? "auto" : "smooth")) return;

  // The header can expand while that scroll is running. Check once it has settled and correct
  // without animation, so the fix reads as part of the same movement rather than a second jump.
  let ticks = 0;
  let lastY = window.scrollY;
  const settle = window.setInterval(() => {
    const y = window.scrollY;
    const moving = Math.abs(y - lastY) > 1;
    lastY = y;
    if (moving && ++ticks < 40) return; // still animating, keep waiting (max ~800ms)
    window.clearInterval(settle);
    const offset = headerBottom() + (under?.offsetHeight ?? 0) + GAP;
    const top = target.getBoundingClientRect().top;
    if (top < offset - 2) window.scrollTo({ top: Math.max(0, window.scrollY + top - offset), behavior: "auto" });
  }, 20);
}
