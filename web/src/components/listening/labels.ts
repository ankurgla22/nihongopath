import type { ListeningExercise } from "@/lib/content/schemas";

export const LISTENING_KIND_LABEL: Record<ListeningExercise["kind"], { ja: string; en: string; hint: string }> = {
  task: { ja: "課題理解", en: "Task-based comprehension", hint: "What will the person do next? Listen for the final decision, not the first suggestion." },
  point: { ja: "ポイント理解", en: "Point comprehension", hint: "You hear the question first. Listen only for that one piece of information." },
  summary: { ja: "概要理解", en: "Summary comprehension", hint: "No question beforehand. Catch the speaker's main point or purpose." },
  integrated: { ja: "統合理解", en: "Integrated comprehension", hint: "Longer talks with several conditions. Take short notes and compare." },
  "quick-response": { ja: "即時応答", en: "Quick response", hint: "A short utterance and three replies. React instantly; do not dwell on a missed item." },
};

export const LISTENING_KIND_ORDER: ListeningExercise["kind"][] = ["task", "point", "summary", "integrated", "quick-response"];
