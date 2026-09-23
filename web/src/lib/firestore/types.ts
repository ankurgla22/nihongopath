/**
 * Firestore document shapes. All documents live under users/{uid}.
 * Timestamps are stored as ISO strings for portability between client SDK and Admin SDK.
 */
export type Skill = "kana" | "grammar" | "vocabulary" | "kanji" | "reading" | "listening";
export const SKILLS: Skill[] = ["kana", "grammar", "vocabulary", "kanji", "reading", "listening"];

export type ProgressStatus = "new" | "learning" | "review" | "strong" | "mastered";

/** users/{uid} */
export type UserDoc = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  /** 1-based day in the daily curriculum (270 days: 180 to N2, 90 to N1) the learner is currently on. */
  currentDay: number;
  currentPhase: number;
  currentLevel: "n5" | "n4" | "n3" | "n2" | "n1";
  streak: number;
  longestStreak: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  totalStudyMinutes: number;
  totalLessonsCompleted: number;
  /** Rolling accuracy per skill (0..1), updated after each quiz. */
  skillAccuracy: Partial<Record<Skill, number>>;
  settings: { dailyMinutesTarget: number; showFurigana: boolean };
};

/** users/{uid}/progress/{contentId} — one per grammar/vocab/kanji/reading/listening item. */
export type ProgressDoc = {
  contentId: string;
  type: Skill;
  level: "foundation" | "n5" | "n4" | "n3" | "n2" | "n1";
  status: ProgressStatus;
  firstLearned: string;
  lastReviewed: string;
  attempts: number;
  correct: number;
  incorrect: number;
  /** SM-2 style ease factor, 1.3 .. 3.0 */
  ease: number;
  intervalDays: number;
  nextReview: string; // YYYY-MM-DD
  completed: boolean; // lesson marked complete
};

/** users/{uid}/dailyProgress/{YYYY-MM-DD} */
export type DailyProgressDoc = {
  date: string;
  curriculumDay: number;
  plannedTasks: { id: string; type: string; minutes: number; contentIds: string[] }[];
  completedTaskIds: string[];
  minutes: number;
  accuracyBySkill: Partial<Record<Skill, { correct: number; total: number }>>;
  completed: boolean;
};

/** users/{uid}/studySessions/{sessionId} */
export type StudySessionDoc = {
  id: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  skill: Skill | "review" | "test";
  contentIds: string[];
  date: string; // YYYY-MM-DD
};

export type AnswerRecord = {
  questionId: string;
  selectedIndex: number | null;
  correct: boolean;
  seconds: number;
};

export type QuizKind = "lesson" | "daily" | "weekly" | "phase" | "review" | "practice";

/** users/{uid}/quizResults/{resultId} */
export type QuizResultDoc = {
  id: string;
  kind: QuizKind;
  title: string;
  createdAt: string;
  date: string;
  questionIds: string[];
  answers: AnswerRecord[];
  score: number;
  total: number;
  accuracy: number; // 0..1
  seconds: number;
  /** Content ids the learner got wrong, for "Review this grammar" links. */
  weakContentIds: string[];
  skillBreakdown: Partial<Record<Skill, { correct: number; total: number }>>;
};

/** users/{uid}/examResults/{resultId} */
export type ExamResultDoc = {
  id: string;
  examId: string;
  title: string;
  createdAt: string;
  date: string;
  sections: { id: string; name: string; skill: "language" | "reading" | "listening"; score: number; total: number; seconds: number; scaled: number }[];
  answers: AnswerRecord[];
  totalScaled: number; // out of 180
  passedEstimate: boolean;
  seconds: number;
  weakContentIds: string[];
};

/** users/{uid}/reviewItems/{contentId} */
export type ReviewItemDoc = {
  contentId: string;
  type: Skill;
  due: string; // YYYY-MM-DD
  priority: number; // higher = review sooner
  source: "wrong-answer" | "srs";
  addedAt: string;
  questionIds: string[];
};

/** users/{uid}/saved/{contentId} */
export type SavedItemDoc = {
  contentId: string;
  type: Skill | "question";
  title: string;
  href: string;
  savedAt: string;
};

export function todayISO(d = new Date()): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
