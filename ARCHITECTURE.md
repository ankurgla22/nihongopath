# Architecture Plan — JLPT N2 Learning Platform

Written against `tasks.md`. Repository inspected: it contains only the study materials (now in `study-materials/`) and `tasks.md`. No existing framework or dependencies, so the app is a fresh Next.js project in `web/`.

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript, `src/` layout |
| Rendering | Server Components by default. Public lesson pages are statically generated at build time from content files (`generateStaticParams`), so all lesson text is in the initial HTML. Client Components only for quiz, timer, audio, auth forms, dashboard widgets. |
| Styling | Tailwind CSS with a small design-token layer (fonts, spacing, colour) |
| Auth | Firebase Authentication (Google + email/password). Client SDK for sign-in; session cookie set via a Route Handler and verified server-side with Firebase Admin, so private routes are protected in `middleware.ts` and server components can read the user. |
| Data | Cloud Firestore for per-user state only. Curriculum is never stored in Firestore. |
| Hosting | Firebase App Hosting (supports Next.js SSR). `firebase.json`, `apphosting.yaml`, `firestore.rules`, `firestore.indexes.json` at repo root of `web/`. |
| Validation | Zod schemas for every content type; a `npm run validate:content` script fails the build on invalid content. |
| Tests | Vitest for pure logic (scoring, SRS, daily plan, progress), Firestore rules unit tests with `@firebase/rules-unit-testing`, Playwright smoke test that fetches a lesson URL with JS disabled and asserts the lesson text is present. |

## 2. Repository layout

```
japanese/
  study-materials/          source curriculum (markdown) — imported by scripts, not served
  tasks.md
  ARCHITECTURE.md
  web/
    content/                structured curriculum (JSON/TS), validated by Zod
      curriculum/           180-day roadmap: phases → days → tasks
      n5/ n4/ n3/ n2/
        grammar/*.json
        vocabulary/*.json
        kanji/*.json
        reading/*.json
        listening/*.json
      questions/            question bank, keyed by id, tagged to content ids
      exams/                mock exam blueprints referencing question ids
      strategy/             JLPT strategy articles
    scripts/
      import-study-materials.ts   converts study-materials/*.md → content/*.json
      validate-content.ts
      build-sitemap.ts (or Next's app/sitemap.ts)
    src/
      app/
        (public)/           SSR/SSG pages: /, /japanese/[level]/..., /jlpt, /search
        (auth)/             /login /signup /forgot-password
        (private)/          /dashboard /daily-study /progress /history /tests/history
                            /mock-exams/... /review /saved /profile
        api/                route handlers: session cookie, progress sync
        sitemap.ts, robots.ts
      components/
        ui/                 Button, Card, Badge, Tabs, Progress, Furigana, JapaneseText
        diagrams/           ConjugationTree, ParticleMap, SentenceStructure, ComparisonTable, PolitenessScale
        lesson/             LessonLayout, LessonNav (Where am I / Continue), ExampleList, MistakeList
        quiz/               QuizRunner (client), Question types, ResultReview
        audio/              AudioPlayer (client; speed, replay, shadowing loop)
      lib/
        content/            loaders (server-only) + Zod schemas + slug helpers
        firebase/           client.ts, admin.ts (server-only), session.ts
        firestore/          typed repositories per collection
        engine/             scoring.ts, srs.ts, dailyPlan.ts, progress.ts, weakAreas.ts
        seo/                metadata builders, JSON-LD
      types/
    firebase.json, firestore.rules, firestore.indexes.json, apphosting.yaml
    .env.example
```

## 3. Content model (Zod-validated)

- `GrammarLesson`: id, slug, level, title, romajiTitle, meaning, simpleExplanation, formation[], diagram (typed: `conjugation-tree` | `comparison` | `sentence-structure` | `none` with data), examples[{ja, reading, en, note?}], similarGrammar[{id, difference}], commonMistakes[{wrong, right, why}], usageNotes[], jlptTips[], practiceQuestionIds[], jlptQuestionIds[], miniTestQuestionIds[], reviewAfterDays.
- `VocabItem`: id, level, word, reading, pos, meaning, examples[], collocations[], related[], synonyms[], antonyms[], difficulty, memoryTip?, kanjiIds[].
- `KanjiItem`: id, character, level, meanings[], onyomi[], kunyomi[], words[{word, reading, meaning}], examples[], similarKanji[], commonMistakes[], memoryAid?, strokeCount.
- `ReadingPassage`: id, level, kind (短文/中文/長文/統合理解/情報検索), title, body (paragraph array), vocab[], questionIds[], strategyNotes[], timeLimitSeconds.
- `ListeningExercise`: id, level, kind, script[{speaker, line}], audioSrc? (null → browser TTS fallback via Web Speech API), vocab[], questionIds[].
- `Question`: id, type (mc | ordering | cloze | reading | listening), level, difficulty, topic, tags{grammarIds, vocabIds, kanjiIds, readingId, listeningId}, prompt, options[], answerIndex, explanation, distractorExplanations[].
- `Curriculum`: phases[{id, name, dayRange}], days[{day, phase, objectives[], tasks[{type, contentIds, minutes}], weeklyTestId?, phaseTestId?}].
- `ExamBlueprint`: id, level, sections[{name, timeLimitSeconds, questionIds}].

Content ids are stable strings (`n2-grammar-wake-dewa-nai`). Questions reference content by id, so daily quizzes, weekly tests, phase tests, mock exams and review quizzes are all generated from the same bank.

## 4. Firestore data model

```
users/{uid}                          profile, settings, currentDay, streak, lastStudyDate, totals
users/{uid}/progress/{contentId}     status: new|learning|review|strong|mastered, firstLearned, lastReviewed, attempts, correct, incorrect, ease, nextReview
users/{uid}/dailyProgress/{YYYY-MM-DD}  planned tasks, completed tasks, minutes, accuracy per skill
users/{uid}/studySessions/{sessionId}   start, end, minutes, contentIds, skill
users/{uid}/quizResults/{resultId}      questionIds, answers, score, accuracy, seconds, kind (daily|weekly|phase|review)
users/{uid}/examResults/{resultId}      exam id, per-section scores, scaled estimate, answers, seconds
users/{uid}/reviewItems/{contentId}     due date, priority, source (wrong answer | SRS)
users/{uid}/saved/{contentId}           type, savedAt
```

Rules: every path under `users/{uid}` requires `request.auth.uid == uid`. No public collections. Client writes are validated by rules (field types, uid match). No client-supplied uid is trusted anywhere.

## 5. Engines (pure TypeScript, unit-tested)

- **scoring**: score a submitted answer set against the question bank; per-section and per-tag breakdown; N2 scaled estimate (raw → 180 scale; 90 total / 19 per section).
- **srs**: SM-2 variant. States new → learning → review → strong → mastered. Wrong answer resets to learning and enqueues a review item.
- **dailyPlan**: given curriculum day + user weak areas (rolling accuracy per skill), builds today's task list with minutes; boosts weak skills, trims strong ones. Deterministic and testable.
- **progress**: rolls up progress collection into per-skill percentages and weekly series.

## 6. Routes

Public (SSG/SSR): `/`, `/japanese`, `/japanese/[level]`, `/japanese/[level]/grammar`, `/japanese/[level]/grammar/[slug]`, `/japanese/[level]/vocabulary`, `/japanese/[level]/vocabulary/[slug]`, `/japanese/[level]/kanji`, `/japanese/[level]/kanji/[slug]`, `/japanese/[level]/reading`, `/japanese/[level]/reading/[slug]`, `/japanese/[level]/listening`, `/japanese/[level]/listening/[slug]`, `/japanese/[level]/tests`, `/japanese/[level]/mock-exams`, `/jlpt`, `/jlpt/strategy`, `/search`, `/sitemap.xml`, `/robots.txt`.

Auth: `/login`, `/signup`, `/forgot-password`.

Private (middleware-protected): `/dashboard`, `/daily-study`, `/progress`, `/history`, `/history/[date]`, `/tests/history`, `/tests/history/[id]`, `/mock-exams/[id]`, `/mock-exams/history`, `/review`, `/saved`, `/profile`.

## 7. Content pipeline from study-materials

`scripts/import-study-materials.ts` parses the markdown tables (kanji, vocabulary) and grammar sections into base JSON. Base records are then enriched by hand/LLM into the full lesson schema (simple explanation, diagram, mistakes, questions). The MVP ships the enriched set required by tasks.md §55 (20+ grammar lessons, 100+ vocab, 50+ kanji, 5+ reading, 5+ listening, 50+ questions, 1 mock exam) plus the full imported base lists so all 1,007 kanji and 4,900 words are browsable from day one.

## 8. Implementation order (mirrors tasks.md §58)

1. Scaffold, design tokens, layout shell, UI primitives.
2. Content schemas + loaders + importer; generate base JSON from study-materials.
3. Public lesson pages (grammar, vocab, kanji, reading, listening, level hubs), SEO metadata, sitemap, robots.
4. Firebase client/admin setup, session cookie auth, login/signup/forgot/profile, middleware.
5. Firestore repositories + rules + rules tests.
6. Engines: scoring, srs, dailyPlan, progress (with Vitest).
7. Quiz runner, lesson mini tests, result review with "Review this grammar" links.
8. Curriculum data (180 days) + daily study page + dashboard.
9. Progress, history, test history, saved, review queue.
10. Mock exam runner (timed sections, full mode) + exam history.
11. Search (server-rendered results over a prebuilt index).
12. Deployment config, .env handling, App Hosting, docs.
