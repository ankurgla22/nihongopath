import { sendGAEvent } from "@next/third-parties/google";

/**
 * The custom Analytics events, in one place so their names and parameters stay consistent.
 *
 * They record that something happened, never how well: no scores, answers or study data, which
 * the privacy page promises never reach Google Analytics. Page address is attached by GA itself.
 * Mark sign_up, quiz_complete, lesson_complete and exam_complete as key events in GA (Admin →
 * Events) to see them as conversions.
 */
type Events = {
  sign_up: { method: "google" | "email" };
  login: { method: "google" | "email" };
  /** The first answer of a quiz: with quiz_complete, the drop-off between starting and finishing. */
  quiz_start: { quiz: "quick" | "lesson" };
  quiz_complete: { quiz: "quick" | "lesson" | "practice" | "test" };
  /** A reading or listening exercise's answers checked. */
  exercise_complete: Record<string, never>;
  lesson_complete: { type: string; level: string };
  exam_complete: { mode: "full" | "single" };
  affiliate_click: { book: string; store: string; page: string };
};

// Without a measurement id GoogleAnalytics is never mounted (see app/layout), and sendGAEvent
// would warn on every call.
const enabled = Boolean(process.env.NEXT_PUBLIC_GA_ID);

export function track<E extends keyof Events>(name: E, params: Events[E]): void {
  if (!enabled || typeof window === "undefined") return;
  sendGAEvent("event", name, params);
}
