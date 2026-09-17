# JLPT N2 Learning Platform (web)

Next.js 14 (App Router, TypeScript, Tailwind) app that serves a structured JLPT curriculum (N5 to N2) as server-rendered public lesson pages, plus a private, Firebase-backed study tracker (180-day plan, quizzes, SRS review, mock exams).

See `../ARCHITECTURE.md` for the full design and `../tasks.md` for the product requirements.

## Contents

- [Quick start](#quick-start)
- [Environment and Firebase setup](#environment-and-firebase-setup)
- [Scripts](#scripts)
- [Testing](#testing)
- [Content authoring guide](#content-authoring-guide)
- [Architecture summary](#architecture-summary)
- [Deployment (Firebase App Hosting)](#deployment-firebase-app-hosting)
- [Security notes](#security-notes)

## Quick start

Requirements: Node 20+, npm. For the Firestore rules tests and emulators you also need the Firebase CLI (`npm i -g firebase-tools`) and a Java 11+ runtime.

```bash
cd web
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run validate:content       # sanity-check content/*.json
npm run dev                    # http://localhost:3000
```

Public pages (`/japanese/...`, `/jlpt`, `/search`, sitemap, robots) work without any Firebase configuration. Sign-in and every private page (`/dashboard`, `/daily-study`, ...) need the Firebase values in `.env.local`.

## Environment and Firebase setup

All variables are listed in `.env.example`. Copy it to `.env.local` (git-ignored).

| Variable | Where it is used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Server | Canonical URLs, sitemap, Open Graph. `http://localhost:3000` locally. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `..._APP_ID` | Browser + server | Firebase web app config. Safe to expose; access is governed by Firestore rules, not by secrecy of these values. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server only | Service account JSON as a single line. Used by the Admin SDK to verify session cookies. Leave empty on App Hosting (Application Default Credentials are used). |

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com>, click **Add project**, pick a name, finish the wizard (Analytics is optional).
2. **Project settings > General > Your apps > Add app > Web**. Register the app (no Hosting needed here). Copy the `firebaseConfig` values into the `NEXT_PUBLIC_FIREBASE_*` variables.
3. **Build > Firestore Database > Create database**. Choose *production mode* (rules are deployed from this repo) and a region close to your users. Note the region for App Hosting later.

### 2. Enable authentication providers

**Build > Authentication > Get started > Sign-in method**:

- **Email/Password**: enable. (Email link sign-in is not used.)
- **Google**: enable, set a public-facing name and support email.

Under **Authentication > Settings > Authorized domains** add every domain the app will run on (`localhost` is pre-authorized; add your App Hosting domain and any custom domain).

The app exchanges the Firebase ID token for an HTTP-only `__session` cookie via `POST /api/auth/session`; that cookie is what `middleware.ts` and server components check. Password reset (`/forgot-password`) uses Firebase's built-in email templates, which you can customize under **Authentication > Templates**.

### 3. Service account (local development only)

The server needs Admin credentials to verify session cookies:

1. **Project settings > Service accounts > Generate new private key**. Download the JSON.
2. Minify it to one line and put it in `.env.local`:

   ```bash
   # macOS / Linux
   echo "FIREBASE_SERVICE_ACCOUNT_JSON=$(tr -d '\n' < service-account.json)" >> .env.local
   ```

   ```powershell
   # Windows PowerShell
   "FIREBASE_SERVICE_ACCOUNT_JSON=$((Get-Content service-account.json -Raw) -replace \"`r?`n\",'')" | Add-Content .env.local
   ```

3. Delete the downloaded file. Never commit it and never reference it from client code.

`GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json` is also honoured if you prefer a file path.

### 4. Firebase CLI and emulators

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # select the project, alias "default"
firebase emulators:start      # Auth 9099, Firestore 8080, Emulator UI 4000
```

Ports are configured in `firebase.json`. To point the running app at the emulators, export `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` before `npm run dev` (the Admin SDK picks these up automatically). The rules tests use `firebase emulators:exec` so they need no manual start.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port 3000. |
| `npm run build` | Production build. Public lesson pages are statically generated from `content/`. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint (next/core-web-vitals). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run check` | `validate:content` + `typecheck` + `lint` + `vitest run`; the pre-push gate. |
| `npm run import:content` | Parses `../study-materials/*.md` and (re)writes the base lists: `content/<level>/kanji.json`, `vocabulary.json`, `grammar-base.json`. Safe to rerun; hand-written enriched files are not touched. |
| `npm run validate:content` | Validates every `content/**/*.json` against the Zod schemas and checks cross-references (question ids, duplicate ids, curriculum). Exit code 1 on any problem. Run before committing content. |
| `npm run gen:questions` | Regenerates `content/questions/generated-<level>.json` (N5/N4/N3 practice questions) from the base lists; deterministic. |
| `npm run gen:curriculum` | Regenerates `content/curriculum/curriculum.json` (180 days, 6 phases) from the current content. Rerun after adding lessons that should be scheduled. |
| `npm test` | Vitest: engine unit tests + content integrity tests. Fast; no network, no emulator. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:rules` | Firestore security-rules tests inside `firebase emulators:exec` (needs Firebase CLI + Java). |
| `npm run test:ssr` | SSR smoke test: starts `next dev` on a free port, fetches public pages with a plain HTTP client (no JavaScript executed) and checks the HTML. |

## Testing

```
src/lib/engine/*.test.ts       scoring, SRS, daily plan, progress roll-ups (pure functions)
tests/content.test.ts          content integrity (ids, cross-refs, curriculum minutes)
tests/firestore.rules.test.ts  security rules against the emulator (self-skips if no emulator)
tests/ssr.test.ts              SSR/SEO smoke test (opt-in via RUN_SSR_TESTS=1)
```

- `npm test` runs everything that needs no external process. The rules suite probes `FIRESTORE_EMULATOR_HOST` (default `127.0.0.1:8080`) and skips itself with a warning when nothing is listening; the SSR suite skips unless `RUN_SSR_TESTS=1`.
- `npm run test:rules` starts the Firestore emulator, runs the rules suite, shuts the emulator down. Covered: owner read/write of `users/{uid}` (uid field must match), cross-user denial, append-only `quizResults`/`examResults`, unauthenticated denial, and denial of every unrelated collection.
- `npm run test:ssr` asserts, from the raw HTML only, that a grammar lesson contains its title, a Japanese example and "Meaning"; the vocabulary index lists words; the N2 grammar sitemap part and `/robots.txt` are correct; `/dashboard` redirects to `/login` without a cookie; `/login` returns 200. It takes roughly 15-60 s and kills the server on exit (`taskkill /T` on Windows).

## Content authoring guide

Curriculum content lives in `content/` as JSON and is validated by the Zod schemas in `src/lib/content/schemas.ts`. Nothing about the curriculum is stored in Firestore, and no lesson text lives inside React components.

### Folder layout

```
content/
  curriculum/curriculum.json      180-day plan (generated; see gen:curriculum)
  exams/<exam-id>.json            mock exam blueprints (ExamBlueprint)
  questions/*.json                question bank, arrays of Question
  strategy/*.json                 JLPT strategy articles (StrategyArticle)
  n5/ n4/ n3/ n2/
    grammar-base.json             imported base list (GrammarLesson[], enriched=false)
    vocabulary.json               imported base list (VocabItem[])
    kanji.json                    imported base list (KanjiItem[])
    grammar/<slug>.json           one enriched GrammarLesson per file
    vocabulary/*.json             enriched VocabItem[] (merged onto the base list by word)
    kanji/*.json                  enriched KanjiItem[] (merged onto the base list by character)
    reading/<slug>.json           ReadingPassage
    listening/<slug>.json         ListeningExercise
```

Every file may contain either a single record or an array of records.

### How ids and slugs work

- **id**: stable, never changes once published, and prefixed by level and type: `n2-grammar-164`, `n2-vocab-1`, `n2-kanji-党`, `n2-reading-1`, `n2-listening-3`. The prefix is what `resolveContentId()` uses to turn an id into a URL, so keep the `<level>-<type>-` convention.
- **slug**: the URL segment (`/japanese/n2/grammar/<slug>`). Lowercase ASCII, hyphen separated, romaji for grammar (`wake-dewa-nai`). Imported base entries get a numeric prefix (`164-wakedehanai-wakedemonai`); when you enrich a lesson you may give it a cleaner slug, but do not change the slug of a page that is already indexed.
- **order**: position within the level's list. An enriched grammar file **replaces** the base entry with the same `order`. Enriched vocabulary merges by `word`, enriched kanji by `character`.
- **Question ids**: `q-<level>-<skill>-<topic>-<n>`, e.g. `q-n2-g-164-1` for the first question on grammar 164. Questions reference content through `tags.grammarIds` / `vocabIds` / `kanjiIds` / `readingId` / `listeningId`, and lessons reference questions through `practiceQuestionIds`, `jlptQuestionIds` and `questionIds`. Both directions are checked by `validate:content`.

### Adding a grammar lesson

1. Find the base entry in `content/<level>/grammar-base.json` and note its `id`, `order` and `title`.
2. Create `content/<level>/grammar/<slug>.json` with the same `id` and `order`:

   ```json
   {
     "id": "n2-grammar-164",
     "slug": "wake-dewa-nai",
     "level": "n2",
     "order": 164,
     "title": "〜わけではない / 〜わけでもない",
     "romaji": "wake dewa nai",
     "meaning": "It's not that... / It doesn't necessarily mean that...",
     "simpleExplanation": "One or two plain paragraphs a beginner can follow.",
     "whenUsed": "Optional: register and typical situations.",
     "formation": ["普通形 + わけではない", "な形容詞 + な/である + わけではない"],
     "diagram": { "kind": "sentence-structure", "parts": [{ "text": "高い", "role": "claim" }, { "text": "わけではない", "role": "partial denial", "highlight": true }], "translation": "It's not that it's expensive." },
     "examples": [{ "ja": "高いわけではないが、安くもない。", "reading": "たかいわけではないが、やすくもない。", "en": "It's not that it's expensive, but it isn't cheap either." }],
     "similarGrammar": [{ "id": "n2-grammar-162", "pattern": "〜わけがない", "difference": "Strong denial of possibility, not a partial denial." }],
     "commonMistakes": [{ "wrong": "高いわけがないが、安くもない。", "right": "高いわけではないが、安くもない。", "why": "わけがない denies possibility completely." }],
     "usageNotes": ["..."],
     "jlptTips": ["..."],
     "practiceQuestionIds": ["q-n2-g-164-1", "q-n2-g-164-2"],
     "jlptQuestionIds": ["q-n2-g-164-5"],
     "reviewAfterDays": 3
   }
   ```

   Diagram kinds: `conjugation-tree`, `comparison`, `sentence-structure`, `transformation`, `scale` (see `DiagramSchema`). At least one example is required.

3. Add the referenced questions (next section).
4. `npm run validate:content`, then `npm test`.

### Adding questions

Append to an existing array in `content/questions/` (or create a new `*.json` file there):

```json
{
  "id": "q-n2-g-164-1",
  "type": "mc",
  "level": "n2",
  "difficulty": 3,
  "skill": "grammar",
  "topic": "wake-dewa-nai",
  "tags": { "grammarIds": ["n2-grammar-164"] },
  "prompt": "彼は日本語が話せない（　　）が、あまり得意ではない。",
  "options": ["わけではない", "わけがない", "わけにはいかない", "はずがない"],
  "answerIndex": 0,
  "explanation": "Partial denial: it's not that he can't speak, but he isn't good at it.",
  "distractorExplanations": ["", "わけがない = there is no way; contradicts the second clause.", "わけにはいかない = cannot (for social reasons).", "はずがない = it cannot be the case."]
}
```

Rules enforced by tests: unique `id`; `answerIndex < options.length`; `distractorExplanations` has 0 entries, one per option, or one per wrong option; `type` is `mc`, `ordering` (options shown shuffled, `answerIndex` marks the ★ item) or `cloze`. Reading and listening questions use `context` for the passage/script excerpt and `tags.readingId` / `tags.listeningId`.

### Adding reading and listening

- `content/<level>/reading/<slug>.json`: `kind` is `short | medium | long | integrated | info`; `paragraphs` (and `paragraphsB` for integrated comprehension), `vocab`, `questionIds` (at least one), `strategyNotes`, `timeLimitSeconds`.
- `content/<level>/listening/<slug>.json`: `kind` is `task | point | summary | integrated | quick-response`; `setting`, `script` as `{speaker, line}` turns, `vocab`, `questionIds`. `audioSrc` is optional and points under `public/audio/`; without it the player falls back to browser speech synthesis.

### Scheduling new content

The daily plan comes from `content/curriculum/curriculum.json`. After adding lessons that should appear on specific days, either edit the day's `tasks[].contentIds` by hand or rerun `npm run gen:curriculum`. `tests/content.test.ts` requires exactly 180 days with 90-240 minutes each.

### Always finish with

```bash
npm run validate:content && npm test
```

## Architecture summary

- **Rendering**: Server Components by default. Public lesson pages use `generateStaticParams` so all lesson text is in the initial HTML (verified by `tests/ssr.test.ts`). Client components are limited to the quiz runner, timers, audio player, auth forms and dashboard widgets.
- **Content**: `src/lib/content/index.ts` (server-only) reads and validates `content/*.json` with the schemas in `schemas.ts`, merges enriched records over imported base lists, and exposes `getGrammar`, `getVocabulary`, `getKanji`, `getReading`, `getListening`, `getQuestions`, `getExams`, `getCurriculum`, `resolveContentId`.
- **Auth**: Firebase Auth in the browser (`src/lib/firebase/client.ts`). The ID token is exchanged for an HTTP-only `__session` cookie by `src/app/api/auth/session/route.ts`. `src/middleware.ts` redirects private routes to `/login` when the cookie is missing; `src/lib/firebase/session.ts` verifies the cookie with the Admin SDK (`admin.ts`, server-only) for server components.
- **Data**: Firestore holds only per-user state under `users/{uid}` (profile, `progress`, `dailyProgress`, `studySessions`, `quizResults`, `examResults`, `reviewItems`, `saved`), accessed through the typed repositories in `src/lib/firestore/`. Curriculum is never stored in Firestore.
- **Engines** (`src/lib/engine/`, pure TypeScript, unit-tested): `scoring` (per-section breakdown and N2 scaled estimate), `srs` (SM-2 variant with new/learning/review/strong/mastered), `dailyPlan` (curriculum day + weak areas -> task list), `progress` (roll-ups and weekly series).
- **SEO**: `src/lib/seo/` builds metadata and JSON-LD; `src/app/sitemap.ts` and `robots.ts` are generated from content. The sitemap is split into 17 parts (`/sitemap/0.xml` = core pages, then grammar / vocabulary / kanji / reading+listening per level; see `src/lib/seo/sitemaps.ts`), all listed in `robots.txt`.

Routes: public `/`, `/japanese/[level]/{grammar,vocabulary,kanji,reading,listening,tests,mock-exams}[/slug]`, `/jlpt`, `/jlpt/strategy`, `/search`; auth `/login`, `/signup`, `/forgot-password`; private `/dashboard`, `/daily-study`, `/progress`, `/history`, `/tests/history`, `/mock-exams/...`, `/review`, `/saved`, `/profile`.

## Deployment (Firebase App Hosting)

App Hosting runs the Next.js server (SSR + static pages) on Cloud Run. Configuration is in `apphosting.yaml`, `firebase.json`, `firestore.rules` and `firestore.indexes.json`.

1. **Prerequisites**: Firebase project on the Blaze plan, Firebase CLI 13.15+ (`firebase --version`), the repo pushed to GitHub (App Hosting builds from a connected GitHub repository).

2. **Create the backend**:

   ```bash
   cd web
   firebase login
   firebase use <project-id>
   firebase init apphosting
   ```

   Pick a region (same as Firestore if possible), connect the GitHub repository, set the root directory to `web`, and choose the live branch (for example `main`). This creates the backend and a rollout on every push to that branch.

3. **Environment variables**: `apphosting.yaml` declares every variable as a plain `value:` (the `NEXT_PUBLIC_*` web-app config is public, not secret). Replace the `REPLACE-ME` placeholders with the values from Project settings > Your apps and commit. If the backend is linked to the Firebase web app, App Hosting injects `FIREBASE_WEBAPP_CONFIG` and `next.config.mjs` derives any missing `NEXT_PUBLIC_FIREBASE_*` value from it.

   Do **not** set `FIREBASE_SERVICE_ACCOUNT_JSON`: on App Hosting (Cloud Run) the Admin SDK uses the backend's service account through Application Default Credentials (`adminConfigured()` treats `FIREBASE_CONFIG`/`K_SERVICE` as configured). If you must override it, add it as a Secret Manager secret with `availability: [RUNTIME]` only (see the commented block in `apphosting.yaml`).

4. **Firestore rules and indexes** are not deployed by App Hosting rollouts. Deploy them explicitly, and again whenever they change:

   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```

   Run `npm run test:rules` first.

5. **Deploy**: push to the live branch, or trigger a rollout manually:

   ```bash
   firebase apphosting:rollouts:create <backend-id> --git-branch main
   ```

   Watch progress in the console under **Build > App Hosting**. After the first rollout set `NEXT_PUBLIC_SITE_URL` to the final public URL so canonical links, the sitemap and the `Secure` cookie flag are correct.

6. **Firebase Auth production checklist** (console, once per project):

   - [ ] Project is on the **Blaze** plan (required by App Hosting).
   - [ ] **Authentication > Sign-in method**: Email/Password (and Google, if used) enabled.
   - [ ] **Authentication > Settings > Authorized domains**: add the `*.hosted.app` URL and every custom domain (otherwise sign-in fails with `auth/unauthorized-domain`).
   - [ ] **OAuth consent screen** (Google Cloud console, Google sign-in only): app name, support email, authorized domain; publish it so non-test users can sign in.
   - [ ] **Email templates**: sender name and, optionally, an action URL on your domain.
   - [ ] Backend service account has **Firebase Authentication Admin** and **Cloud Datastore User** roles (needed for session cookies and server-side Firestore reads).
   - [ ] Firestore rules and indexes deployed (`firebase deploy --only firestore:rules,firestore:indexes`).

7. **Production build check** before pushing (also run by `.github/workflows/ci.yml`):

   ```bash
   npm run check && npm run build     # check = validate:content + tsc + lint + vitest
   ```

The full runbook (backend creation, env, custom domain, rollback) is in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Security notes

- **Server-side only secrets**: `FIREBASE_SERVICE_ACCOUNT_JSON` and everything in `src/lib/firebase/admin.ts` / `session.ts` are guarded by `import "server-only"`; importing them from a client component fails the build. `NEXT_PUBLIC_*` values are the only ones that reach the browser, and they are not secrets.
- **Session cookie**: `__session` is HTTP-only, `Secure` in production, `SameSite=Lax`, 14-day lifetime, created only from a freshly minted ID token and verified with `verifySessionCookie(token, true)` (revocation checked). The middleware only checks presence; real verification happens in server components before any user data is read.
- **Never trust client-supplied uids**: every Firestore path is derived from `request.auth.uid` (client) or the verified session (server). `firestore.rules` requires `request.auth.uid == uid` for every document under `users/{uid}`, requires `uid` field to match on profile writes, makes `quizResults`/`examResults` append-only, forbids profile deletion, and denies every other collection. `npm run test:rules` locks this in.
- **No public Firestore data**: curriculum is served from the app bundle, so the rules default to deny-all and there is nothing anonymous clients can enumerate.
- **Env hygiene**: `.env*.local`, `.firebase/`, emulator debug logs and `node_modules` are git-ignored. Rotate the service account key if it is ever exposed (Project settings > Service accounts > Manage service account permissions).
- **Rate limiting / abuse**: Firebase Auth applies its own throttling to sign-in and password reset. The `/api/auth/session` route only accepts a valid ID token and sets a cookie; it stores nothing else. It also rejects cross-site requests (Origin / Sec-Fetch-Site check, JSON content-type required) so a third-party page cannot log a visitor into an attacker's account (login CSRF).
- **Session fallback**: when the Admin SDK actively rejects an ID token (revoked, disabled, expired, wrong project) the request fails with 401; the public-key verifier is used only when Admin credentials are unavailable. With Admin credentials present, a legacy raw ID-token cookie is honoured only until its own one-hour expiry.
- **Security headers** (`next.config.mjs`): `Content-Security-Policy` (allows Firebase Auth popups, Identity Toolkit, Firestore; `'unsafe-inline'` scripts because Next 14 has no nonce plumbing here), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, a minimal `Permissions-Policy`, HSTS in production. `Cross-Origin-Opener-Policy` is deliberately not set because `same-origin` breaks `signInWithPopup`. If you use a custom auth domain, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is added to `frame-src`/`connect-src` automatically.
- **JSON-LD**: all `application/ld+json` blocks go through `jsonLdString()` (`src/components/content/JsonLd.tsx`), which escapes `<`, `>`, `&` so content text can never close the `<script>` tag.
- **Open redirect**: `?next=` is validated by `safeNext()` (must be a same-origin path; protocol-relative, backslash, control-character and scheme tricks fall back to `/dashboard`).
