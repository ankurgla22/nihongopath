"use client";

/**
 * Seed for one attempt at a test or review session.
 *
 * QuizRunner persists in-progress answers under `storageKey`, but only restores them when the
 * question ids match exactly. The tests hub and review screen seeded their question pick with
 * `Date.now()`, so every launch drew a different set and the saved answers were always thrown
 * away: answer 18 of 25, refresh, and all 18 were gone. (Daily study was unaffected; its seed
 * is already per day and task.)
 *
 * Keeping the seed next to the answers fixes that without freezing the question set forever:
 * while an attempt is unfinished the same seed comes back, so the same questions do; once the
 * attempt is finished or abandoned the record is cleared and the next launch rolls a new one.
 */

const seedKeyFor = (storageKey: string) => `${storageKey}:seed`;

/** The seed for the attempt in progress under `storageKey`, or a fresh one stored for next time. */
export function attemptSeed(storageKey: string, makeSeed: () => string): string {
  try {
    const inProgress = localStorage.getItem(storageKey) !== null;
    const saved = localStorage.getItem(seedKeyFor(storageKey));
    if (inProgress && saved) return saved;
    const seed = makeSeed();
    localStorage.setItem(seedKeyFor(storageKey), seed);
    return seed;
  } catch {
    // Private mode or blocked storage: no resume, but the quiz must still start.
    return makeSeed();
  }
}

/** Drop both the answers and the seed, so the next attempt is a fresh draw. */
export function clearAttempt(storageKey: string | undefined): void {
  if (!storageKey) return;
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(seedKeyFor(storageKey));
  } catch {
    /* ignore */
  }
}
