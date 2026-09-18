/**
 * Helpers for learner-facing per-option notes (Question.distractorExplanations).
 *
 * Content stores one note per option, and the entry for the correct option carries a
 * marker prefix such as "(correct answer)" or "Correct: …". Those markers are for
 * authors, never for learners: the UI highlights the right option already.
 */
const MARKER_RE = /^\s*(?:\(correct answer\)|correct:)\s*/i;

/** True when the note is (or starts with) an author marker for the correct option. */
export function isCorrectMarker(text: string | undefined | null): boolean {
  return typeof text === "string" && MARKER_RE.test(text);
}

/** Strip a leading "(correct answer)" / "Correct:" marker and any dash left behind. */
export function cleanNote(text: string): string {
  return text
    .replace(MARKER_RE, "")
    .replace(/^[\s—–\-:]+/, "")
    .trim();
}

/**
 * Notes to show under "Why the other options are wrong": drops the correct option
 * (by index when the list is aligned with the options, and by marker otherwise),
 * strips markers, and removes empty notes.
 */
export function wrongOptionNotes(notes: readonly string[], answerIndex: number, optionCount: number): { index: number; text: string }[] {
  const aligned = notes.length === optionCount;
  const out: { index: number; text: string }[] = [];
  notes.forEach((raw, index) => {
    if (aligned && index === answerIndex) return;
    if (isCorrectMarker(raw)) return;
    const text = cleanNote(raw);
    if (text) out.push({ index, text });
  });
  return out;
}
