# Nihongo Path — minimalist audit ("every element must earn its place")

Scope: the production build at http://localhost:3000, desktop 1366×850 and mobile 390×844, logged out (`*-out-*`) and logged in with a fresh account (`*-in-*`). Evidence is the PNG + `.txt` dump next to this file (`<screen>-<in|out>-<desktop|mobile>.png/.txt`). The mobile quiz screens were captured in this pass with a temporary account created through the signup form and deleted afterwards; every other screen was reused from the earlier capture.

This audit does not repeat `../REPORT.md` (terminology, copy bugs, N2 defaults, overflow). It only asks one question per block: **does a learner need this, here, now?** Verdicts: **KEEP · CUT · MERGE · HIDE-UNTIL-RELEVANT (HUR) · MOVE (to …) · SHRINK**.

Counting convention: a "primary button" is a filled red button. "Two ways to the same place" counts links, cards and chips that open the same URL from one screen.

---

## 1. Global cut list (ordered by impact)

| # | Cut | Where it shows | Count | Why the learner is better off |
|---|-----|----------------|-------|-------------------------------|
| 1 | **Footer: drop the LEARN / SKILLS / EXAM / ACCOUNT columns**; keep logo line + © + a single row: Foundation · N5 · JLPT · Profile/Log in | every page (`dashboard-in-desktop.png`, `n5-in-desktop.png`, …) | 4 columns, 18–19 links repeated on ~40 screens | Every link is already in the header, the level rail, or the page itself. On mobile it adds ~600 px below each page of a 4,000–9,000 px scroll. |
| 2 | **Zero-value stat tiles on first visit** (`STREAK 0`, `STUDY TIME 0.0 h`, `LESSONS 0`, `DUE REVIEWS 0`, `DUE TODAY 0`, `OVERDUE 0`, `FROM MISTAKES 0`, `MASTERED 0`, `MOCK EXAMS 0`, `BEST EXAM —`, `DAYS COMPLETED 0`, per-skill `0 of 76 · 0%`) | dashboard, review, progress, history, tests-history, profile | 21 tiles across 6 screens show 0 / — on day one | A row of zeros is a failure state the learner did nothing to earn, and it sits above the one thing they should do. Show a tile only when its value is non-zero. |
| 3 | **Second navigation system to the same destinations**: "Shortcuts" / "Quick actions" cards (Review · Tests · Progress · Mock exams) | dashboard, daily-study (right rail), quiz screens, tests page footer links, profile "SHORTCUTS" | 4 screens × 3–4 cards = 14 cards, all duplicating the 5-item header | The header already reads Today · Learn · Review · Tests · Progress. Duplicating it as cards makes the page look like a menu instead of a task. |
| 4 | **Marketing / sign-up copy shown to a signed-in learner** ("Get the daily plan → /signup", "Create a free account", "Sign in to mark lessons learned…", "Signed-in learners get it added…", "Study with a daily plan" card, "Start the 180-day plan" band) | /japanese, /japanese/n5, /japanese/foundation, grammar lesson, home when logged in | 6 blocks on 5 logged-in screens (home logged-in is identical to logged-out: 4,963 px of pitch) | A logged-in learner is being sold what they already have; each block is a dead end (`/signup` while signed in). |
| 5 | **Meta chips the learner cannot act on**: `Full lesson`, `Common · 2/5`, `exp`, `Difficulty 1 of 5`, `Multiple choice`, `203 characters`, `5 lines`, `1 question`, `#12` word numbers, `Set 1` chip on kanji page, `JLPT N5` chip on every N5 page, `Practice`/`FOUNDATION` chips inside the quiz, `x4 1 2 3 4` option numerals | word page, kanji page, grammar lesson, reading index/page, listening index/page, vocab index, quiz | ≥ 12 distinct chip types; reading index alone shows 90 chips (30 cards × 3) | None is a filter or a state. The level is already in the breadcrumb and the H1; "Multiple choice" is obvious from the four options; a character count changes no decision. |
| 6 | **Explanatory boxes that repeat the page or the previous page**: "How to use these lessons", "How to use these passages", "The listening routine" (1–5), "How it works" (1–3) on Review, "Full lesson marks 76 grammar points…", "Answer each question, then read why…", the 1–4 "Teach first, test second" loop, "What each lesson gives you" (6 cards) | foundation, reading index, listening index, review, n5 hub, grammar lesson, home, /japanese | 8 callouts | They describe the UI that is right below them. The listening page already walks the learner through the 7 steps; the review page's empty state already says what lands there. |
| 7 | **Two primary buttons on one screen** | /japanese/n5 (Start from lesson #1 + Create a free account), /tests (3 red Start buttons), grammar/word/kanji/foundation lessons (red "Mark as learned" in the sticky bar before the learner has read anything), review (grey "Start a short mixed review" + red "Continue today's study"), /japanese (Start the 180-day plan + Browse N2), mock start (Start full exam + mode toggle) | 7 screens | The eye has no anchor. One filled button per screen; everything else outlined or text. |
| 8 | **Duplicate CTA to the same URL on one screen**: "Start from lesson #1" hero + "Grammar → Start from #1" card; "Start lesson 1" hero + card 01 + "Start with lesson 1" + "Open Foundation"; "Start with Set 1" + "Start Set 1"; "Test history" pill + "Test history →" link; "Dashboard" header item + "Dashboard" pill + footer "Dashboard"; "Foundation — start here" title link + "Open Foundation" | n5, foundation, /japanese, kanji index, tests, daily-study | 9 pairs | Two ways to do one thing on one screen doubles what must be read for zero gain. |
| 9 | **"Plan summary" rail** (six task names + minutes) and "Today's goal · 4 objectives" accordion | daily-study, quiz | 2 blocks on every daily screen | Both restate the task list that sits 20 px to the left. |
| 10 | **Per-item "Listen" buttons where one would do**: 46 kana tiles each a button plus 10 pair buttons plus 20 word buttons (76 speaker controls on one lesson); 150 speaker buttons on the vocab index; 13 on a reading page (whole passage + each paragraph + each vocab word + each option); "Listen" on quiz options | foundation lesson, vocab index, reading page, quiz, search | 76 / 150 / 13 / 4 / 13 | A tap on the word itself should play it; a separate icon per row is a second target and doubles the interactive count. Keep one player per passage, tap-to-play on tiles and words. |
| 11 | **Level rail chips duplicating the page heading** (`N5 Foundations · You are here` rail under a page whose H1 is "N5"; "Step 1 of 5" chips; "かな → N5 → … → N1" rail on /japanese directly above the same six cards) | /japanese, /n5, home | 3 screens, 6 chips each | Same information twice within one viewport. |
| 12 | **Logged-in home = logged-out home** (9,132 px on mobile: hero, fake "Example day", 4-step loop, 6 level cards, 6 feature cards, sample lesson, exam facts, CTA band) | home-in-* | 8 sections | A signed-in learner who taps the logo should land on Today, not on the pitch. |
| 13 | Sub-headline stat strip in the hero (`707 GRAMMAR POINTS · 6,400 WORDS · 1,607 KANJI · 7,842 QUESTIONS`) and per-level count grids (Grammar/Words/Kanji/Reading/Listening) on every level card | home, /japanese, /n5 cards | 4 + 6×5 numbers | Volume is a supplier's brag, not a learner's decision. |
| 14 | "Upcoming" bar chart (Tomorrow 1 / Within 3 days 1 / Within 7 days 1 / Later 0) for a single scheduled item | review | 1 chart + 1 total row | Four bars to say "one item, tomorrow". |
| 15 | "Jump to a day" form on every daily view | daily-study, quiz | 1 form (H2 + copy + input + Go) | A once-per-account setting; it belongs in Profile next to the daily target. |
| 16 | ON THIS PAGE rail with 12 anchors + section chips + the sticky "Part x of y · Next part · Jump to quick check" bar | grammar lesson (desktop), foundation lesson | 2–3 in-page navigations per lesson | One in-page navigation is enough; the sticky part bar already does the job. |
| 17 | Mode toggle "Full exam / Single section" + Sections table + rules `<details>` before the start button | mock start | 3 blocks | The page is "Start exam A". One button, one "or pick a section" link. |
| 18 | Level filter chips `Your level · N5 / All levels / N4 / N3 / N2 / N1` on mock exams; three near-identical 300-word exam cards A/B/C | mock-exams | 6 chips + 3 cards | Three cards differ by one letter; make it one card with A/B/C buttons. |
| 19 | "Read about the JLPT format and strategy" band + "Preparing for the exam?" box + "About the N5 exam" card + N2 test facts (`180 · 80–100 · 19 · Jul/Dec`) | home, /japanese, /n5 | 4 exam call-outs on learning pages | Exam facts belong on /jlpt only. |
| 20 | "Review recommendation · Come back in 3 days" card and "Usage notes" section that repeats "Simple explanation" | grammar lesson | 2 sections | The review system already schedules the item; the notes duplicate two paragraphs above. |

Totals: ~120 blocks cut or hidden across 30 screens; footer alone removes ~19 links from every page; stat tiles remove 21 zeros; shortcut cards remove 14 duplicates.

---

## 2. Per-screen inventories

Format: block — what it is — who needs it / when — **verdict** — reason.

### Header (all screens)
- Logo "道 Nihongo Path" → / — everyone — **KEEP** (logged in: point it at /dashboard).
- Logged-out nav: Learn · Start here · JLPT · Strategy — visitors — **SHRINK** to Learn · JLPT. "Start here" duplicates the pink Foundation band on every learning page; "Strategy" is a child of JLPT.
- Logged-in nav: Today · Learn · Review · Tests · Progress — learners — **KEEP** (this is the only navigation the app needs; everything else below duplicates it).
- Search icon button, theme toggle — **KEEP**.
- "Log in" (logged out) — **KEEP**; make it the header's only outlined button.
- Account menu: Dashboard · Daily study · Progress · Saved · Profile · Log out — **SHRINK** to Saved · Profile · Log out. Dashboard/Daily study/Progress are already in the nav (`account-menu-in-desktop.txt` shows Progress twice).
- Mobile: second sticky row (Today · Learn · Review · Tests · Progress) + account sheet with the same items again — **MERGE**: one row of five; account sheet only Saved · Profile · Log out (`mobile-menu-in-mobile.txt`).

### Footer (all screens)
- Logo + tagline "Learn Japanese every day…" — **SHRINK** to logo line.
- LEARN column (Foundation, N5, N4, N3, N2, N1) — **CUT** (header Learn + level rail).
- SKILLS column (N5 grammar … N5 listening) — **CUT** (N5 hub has the same six cards).
- EXAM column (About the JLPT, Strategy, Mock exams, Tests) — **CUT** (header JLPT/Tests).
- ACCOUNT column (Dashboard, Today, Profile, Log out / Log in, Sign up) — **CUT** (account menu).
- © line + "Study every day. Understand, practise, review." — **SHRINK** to © only.
- Target footer: one line — `道 Nihongo Path · © 2026 · About the JLPT · Profile`.

### Home (`home-out-desktop.txt`, 4,963 px; `home-in-mobile.txt`, 9,132 px)
- Eyebrow "JAPANESE COURSE · DAILY STUDY SYSTEM · JLPT PREP FOR EVERY LEVEL" — **CUT** (three labels, no decision).
- H1 + one-line sub — **KEEP**.
- Buttons "Start the 180-day plan" (primary) + "Explore the levels" — **KEEP** one primary, one text link.
- Stat strip 707 / 6,400 / 1,607 / 7,842 — **CUT** (#13).
- Decorative kanji tiles 日本語道学試 — **CUT** (decorative).
- "EXAMPLE DAY" card (Day 1 · Hiragana, three rows, "Continue" button that goes nowhere) — **CUT**; a fake dashboard with a dead button confuses more than it sells.
- "HOW IT WORKS · Teach first, test second" 4-step loop — **SHRINK** to one sentence under the H1.
- "THE PATH" six level cards with Grammar/Words/Kanji counts + "All levels" link + per-card "Open N5" — **SHRINK**: six plain rows (name · one line), no counts, no per-card button; card is the link.
- "WHAT YOU GET" six feature cards — **CUT** (repeats the loop and the level cards).
- "SAMPLE LESSON" (heading + copy + "Open this lesson" + full card + "Read the full lesson") — **SHRINK** to the card only; two CTAs to the same URL → one (#8).
- "Built around the real exam" + 4 exam stat tiles + "About the JLPT" — **MOVE** to /jlpt.
- "READY FOR DAY ONE?" band: "Create free account" + "See all levels" — **CUT**; the hero already has both buttons (second primary to /signup on the same page).
- Logged in: entire page — **CUT**; redirect / to /dashboard (#12).
- Primary-button check: two red buttons (hero + band) → keep one.

### /japanese (`japanese-in-desktop.txt`, 2,710 px)
- Breadcrumb Home › Japanese — **KEEP**.
- Chips "N5 → N1", "LEARNING PATH" — **CUT** (labels above an H1 that says the same).
- H1 + sub — **KEEP**.
- Level rail (かな · N5 Step 1 of 5 … N1 Step 5 of 5) — **CUT** (#11; the six cards below are the rail).
- Foundation band (title link, "Start" chip, copy, "8 lessons · …", "Open Foundation") — **SHRINK**: title is the link, one line of copy; drop "Start" chip and "Open Foundation" (title link duplicates it).
- Five level cards (title link, "Step n of 5" chip, paragraph, 5 count tiles, 5 skill links, "Open N5") — **SHRINK**: title + one line + five skill links. Cut counts, chips and "Open Nx" (title is the link). 47 interactive → ~30.
- "FIVE SKILLS · What each lesson gives you" six cards — **CUT** (#6).
- "Preparing for the exam?" box + "Start the 180-day plan" + "Browse N2" — **CUT** (logged in: dead /signup link and second primary; logged out: hero already sells).

### /japanese/foundation (`foundation-in-desktop.txt`, 1,608 px)
- Breadcrumb — **KEEP**.
- Chips "Start here", "BEFORE N5" — **CUT** (H1 says "First the かな, then everything else").
- H1 + paragraph — **KEEP**; SHRINK paragraph to one sentence with the total time.
- "Start lesson 1" (primary) + "Skip to N5" — **KEEP** primary; **CUT** "Skip to N5" (N5 is one tap away in Learn and in the closing line).
- Decorative tiles あカんッ三時 — **CUT**.
- Eight lesson rows (number, category chip, minutes, title, description, "Lesson n of 8") — **SHRINK**: number · title · minutes. Cut the category chip (the title says Hiragana/Katakana) and "Lesson n of 8" (the number says it).
- "How to use these lessons" box (incl. "Sign in to mark lessons learned" while signed in) — **CUT** (#6, #4).
- "After lesson 8, continue to N5" link — **KEEP** as the last line.
- Primary check: OK (one).

### Foundation lesson (`foundation-lesson-in-desktop.txt`, 7,380 px; 90 interactive)
- Breadcrumb — **KEEP**.
- Sticky bar: "1 · Lesson 1 of 8 · Foundation · Hiragana · 30 min · Save · Mark as learned" — **SHRINK** to "Lesson 1 of 8 · Save · Mark as learned"; cut the three chips (they repeat the breadcrumb and title). Style "Mark as learned" as outline until the quick check is done (#7).
- Eyebrow "LESSON 1 · ひらがな" — **CUT** (H1 follows).
- H1 + intro paragraph — **KEEP**.
- Sticky "Part 1 of 5 · Next part · Jump to quick check" bar and "PART n OF 5" labels on each section — **MERGE**: keep the sticky bar, cut the per-section labels.
- Gojūon chart: 46 tiles each with a separate "Play sound" button — **SHRINK**: tile itself plays (#10).
- Stroke-order tips — **KEEP**.
- Ten confused pairs with 10 "Listen" buttons — **KEEP**, tap the pair to play.
- Practice words: 20 numbered rows with 20 "Listen" buttons — **SHRINK**: drop the 01–20 numerals, tap-to-play.
- Quick check ("1 / 20" chip, "Listen: How is ほ read?", 4 options, "CONTINUE" label) — **KEEP**; cut the "Listen" on the question (kana is what is being tested).
- Bottom nav: "All Foundation lessons" + NEXT card — **KEEP** (this is the true primary at the end).

### /japanese/n5 (`n5-in-desktop.txt`, 1,683 px)
- Chips "JLPT N5", "FOUNDATIONS · STEP 1 OF 4" — **CUT** (H1 is "N5"; the step count is also wrong).
- H1 + sub — **KEEP**.
- "Start from lesson #1" (primary) — **KEEP**.
- "Get the daily plan" → /signup — **CUT** when logged in; logged out **MOVE** to the closing line.
- "WHAT YOU'LL BE ABLE TO DO" 4-bullet card — **SHRINK** to the sub-headline (it already says this).
- Level rail "N5 You are here … N1 Step 5" — **CUT** (#11).
- "COURSE CONTENT" label + "Study N5" H2 + "Full lesson marks 76 grammar points…" note — **CUT** the label and the note (the badge no longer exists on the index).
- Seven skill cards, each: kanji glyph, count, description, "Browse" + "Start from #1"/"Open" — **SHRINK**: name · count · one line; whole card = Browse; cut "Start from #1" (hero has it) and "Open" (same as Browse). 7 cards × 2 links → 7 links.
- "About the N5 exam" callout — **MOVE** to /jlpt.
- "Study with a daily plan" pink card with "Create a free account" (second red button) + "Next: N4" — **CUT** when logged in; logged out shrink to one text line. Primary check: two red buttons → one.

### /japanese/n5/grammar (`n5-grammar-in-desktop.txt`, 4,625 px)
- Chip "JLPT N5 · GRAMMAR" — **CUT**.
- H1 "N5 grammar · 76" + "Start with lesson 1" + "N5 overview" pill — **KEEP** H1 + Start; **CUT** "N5 overview" (breadcrumb "N5").
- Intro sentence "Every lesson has a diagram, examples…" — **CUT** (#6).
- "LESSONS" label + jump chips 1–10 … 71–76 — **KEEP** chips (they are a real in-page filter); cut the label.
- Eight groups "Lessons 1–10 · Set 1 of 8" — **SHRINK**: cut "Set n of 8" (the range says it).
- 76 rows (number · headword · one-line meaning) — **KEEP**.

### N5 grammar lesson (`n5-grammar-lesson-in-desktop.txt`, 5,039 px; 60 interactive)
- Sticky bar "1 · Lesson 1 of 76 · JLPT N5 · Full lesson · Save · Mark as learned" — **SHRINK** to "Lesson 1 of 76 · Save · Mark as learned"; cut "JLPT N5" and "Full lesson" chips (100 % of lessons carry them). "Mark as learned" is the only red button on a page whose purpose is reading → outline until Quick check is done (#7).
- ON THIS PAGE rail with 12 anchors (desktop) — **SHRINK** to 5 (Meaning · Formation · Examples · Mistakes · Quick check) or cut; a 12-item TOC for a 5,000 px page is a second page.
- Eyebrow "GRAMMAR · LESSON 1" — **CUT** (sticky bar says it).
- Headword + reading + Listen — **KEEP**.
- Meaning · Simple explanation · When it's used — **MERGE** into Meaning + one explanation paragraph ("When it's used" is one sentence that fits in the explanation).
- Formation (4 rows each with a Listen button) — **KEEP**, tap-to-play.
- Visual diagram — **KEEP**.
- Natural examples (5, each with Listen) — **KEEP**.
- Similar grammar (3 cards, each with Listen) — **KEEP**; cut the Listen on a one-word card.
- Common mistakes — **KEEP**; cut the Listen on the wrong sentence (do not voice the error).
- Usage notes — **CUT** (verbatim overlap with Simple explanation).
- JLPT N5 tips — **KEEP** (unique content).
- Quick check: "Answer each question, then read why…" copy, "PRACTICE QUESTIONS 1 / 4", "Multiple choice", "Difficulty 1 of 5" chips; "JLPT-STYLE QUESTIONS 1 / 1" — **SHRINK**: cut the copy line, "Multiple choice" and "Difficulty n of 5"; merge the two question groups into one "Quick check 1 / 5".
- "Review recommendation · Come back in 3 days" + "Signed-in learners get it added…" — **CUT** (#20, #4).
- "CONTINUE" label + "All N5 grammar" + NEXT card — **KEEP** NEXT; cut label.

### /japanese/n5/vocabulary (`n5-vocabulary-in-desktop.txt`, 4,275 px; 321 interactive)
- Chip "JLPT N5 · VOCABULARY · PAGE 1 OF 5" — **CUT** (pager says page).
- H1 + "Start with word 1" — **KEEP**.
- Intro "700 words in study order, 150 per page. This page: words 1–150 across 4 themes…" — **CUT**.
- Pager (Prev 1 2 3 4 5 Next) + "Jump to" select with the same five pages, shown top AND bottom — **MERGE**: one pager at the bottom, no select (two controls for one job, twice).
- "Filter vocabulary" box + note "Filtering this page — use search for all N5 words" — **CUT**; the header search covers it, and a filter that only filters the visible page misleads.
- Theme chips (Greetings & Basics 40 …) — **KEEP** as in-page anchors.
- 150 cards, each with "#n" and a Listen button — **SHRINK**: cut "#n" (already ordered), tap-to-play (#10). 321 interactive → ~160.

### Word page (`n5-word-in-desktop.txt`)
- Sticky bar "1 · Word 1 of 700 · JLPT N5 · Save · Mark as learned" — **SHRINK**: cut "JLPT N5".
- Chips "exp", "Common · 2/5", "Greetings & Basics" — **CUT** all three ("exp" is meaningless; a 2/5 frequency changes nothing; the theme is in the index).
- Headword + Listen + meaning — **KEEP**.
- Examples (1) — **KEEP**.
- Quick check: "Two quick questions on this word." + "Answers here don't count toward your schedule — use Drills on your Daily study page for that." + "1 / 1 · Multiple choice · Difficulty 1 of 5" — **SHRINK** to the question; cut all three lines of framing (and the "Daily study" link inside it).
- "CONTINUE" label · All N5 vocabulary · NEXT — **KEEP** NEXT.

### /japanese/n5/kanji (`n5-kanji-in-desktop.txt`, 2,227 px)
- Chip "JLPT N5 · KANJI" — **CUT**.
- H1 + "Start with Set 1" — **KEEP**.
- Intro sentence — **CUT**.
- "Jump to set" chips Set 1–10 — **KEEP** (real anchors).
- Ten sections each "Set n · 10 kanji · Start Set n" + 10 tiles — **SHRINK**: cut "10 kanji" and the ten "Start Set n" links (the first tile of the set is the start; hero has Set 1). 127 interactive → 116.

### Kanji page (`n5-kanji-page-in-desktop.txt`)
- Sticky bar "1 · Kanji 1 of 103 · JLPT N5 · Set 1 · Save · Mark as learned" — **SHRINK**: cut "JLPT N5" and "Set 1".
- Eyebrow "KANJI #1" — **CUT**.
- Big glyph · meaning · Listen · ON-YOMI / KUN-YOMI with a Listen per reading — **KEEP**; tap reading to play.
- "Common words" table (2 rows, sentence "The fastest way to remember a kanji is…") — **MERGE** into the vocabulary list below (both are "words using this kanji").
- "Vocabulary using this kanji" (12 links incl. N4/N3 items) — **KEEP**; cut N4/N3 items for an N5 learner or collapse behind "More".
- Quick check framing (3 lines) — **CUT** as on the word page.
- NEXT — **KEEP**.

### /japanese/n5/reading (`n5-reading-index-in-desktop.txt`, 2,893 px)
- Chip "N5 · 読解" — **CUT**.
- H1 + intro — **KEEP** H1; **CUT** intro.
- "How to use these passages" box — **CUT** (#6; the passage page repeats it as "Strategy notes").
- Kind chips (短文 · 情報検索) — **KEEP** (anchors).
- 30 cards, each "N5 · 2 min 30 s · 3 questions · title · 203 characters · Open" — **SHRINK** to title · 2½ min. Cut "N5" (all are), "3 questions" (all are), "characters" (#5), "Open" (card is the link). 90 chips → 30.

### N5 reading page (`n5-reading-page-in-desktop.txt`, 2,910 px)
- Eyebrow "N5 · 短文 · SHORT PASSAGES" + chips "N5 · Time limit 2 min 30 s · 3 questions · 111 characters" — **SHRINK** to "2 min 30 s" beside the timer; cut the rest (#5).
- Strategy notes (3 bullets) — **KEEP**.
- Passage: "About 200 characters, one question each…" line + whole-passage Listen + per-paragraph Listen — **SHRINK**: cut the kind description; one Listen for the passage.
- Vocabulary list (11 rows, each with Listen) — **KEEP**, tap-to-play.
- Timer block "READY · 2:30 of 2:30 · Start timer · Press Start timer, read…" — **SHRINK**: one "Start timer" button with the time; cut the three-line instruction.
- Questions (each "Question 1" + numeral chip + "QUESTION 1 · CHOOSE THE BEST ANSWER" + Listen on the stem and on every option) — **SHRINK**: one label per question; cut the uppercase repeat and the 16 option Listens (this is *reading*).
- "Check answers" + "0 / 3 answered…" — **KEEP** (the primary).
- All N5 reading + NEXT — **KEEP** NEXT.

### /japanese/n5/listening (`n5-listening-index-in-desktop.txt`, 3,295 px)
- Chip "N5 · 聴解" — **CUT**.
- Intro + "The listening routine" 1–5 — **CUT** both (#6; the exercise page is the routine).
- Kind chips — **KEEP**.
- 30 cards "N5 · 5 lines · 1 question · title · setting sentence · Open" — **SHRINK** to title + setting; cut "N5", "n lines", "1 question", "Open".

### N5 listening page (`n5-listening-page-in-desktop.txt`, 897 px)
- Eyebrow + chips "N5 · 5 lines · 1 question" — **CUT**.
- H1 + "SETTING …" + kind hint sentence — **KEEP** H1 + setting; **CUT** the kind hint (index had it).
- 7-step stepper — **KEEP** (real state).
- "STEP 1 OF 7 · Listen" + instruction + "LISTEN ONCE" label — **SHRINK**: stepper already says step 1; cut the two labels.
- Player: Play · 0.75× 1× 1.25× · Replay · Shadowing · "I have listened" — **SHRINK**: Play + speed; hide "Replay"/"Shadowing" until step 5–6 (HUR).
- All N5 listening + NEXT — **KEEP** NEXT.

### /jlpt (`jlpt-in-desktop.txt`, 3,879 px)
- Chips "日本語能力試験" (×2) — **CUT**.
- ON THIS PAGE rail (6) — **KEEP** (long reference page).
- Disclaimer paragraph — **SHRINK** to one sentence at the end.
- Five levels (each "On this site"/"Not covered" chip + "Study Nx") — **SHRINK**: cut the chips; the link presence says it.
- N2 structure table, scoring tiles, dates, "What N2 certifies" — **KEEP** but make level follow the learner (out of scope here).
- Exam strategy (6 guide cards) — **MOVE** to /jlpt/strategy; leave one link.
- Closing "Start the N2 course · N2 mock exams · Tests and quizzes" — **SHRINK** to one link.

### /jlpt/strategy (`jlpt-strategy-in-desktop.txt`)
- Chips "JLPT · STRATEGY", "GUIDES" — **CUT**.
- Side rail with the same six guide titles as the cards next to it — **CUT** (#11: rail duplicates the list in the same viewport).
- PASS MARK 90 / PER SECTION 19 tiles — **CUT** (copied from /jlpt).
- Disclaimer — **CUT** (already on /jlpt).
- Six guide cards with "GUIDE n · 4 sections" chips + "Read guide" — **SHRINK**: title + one line; cut chips and "Read guide" (card is the link).
- Closing links (About the JLPT · N2 reading · N2 listening) — **CUT**.

### /search?q=学校 (`search-in-desktop.txt`)
- Chip "SEARCH" + H1 "Find anything across N5–N1" + intro — **SHRINK** to the input.
- Search form — **KEEP**.
- Results grouped Vocabulary 3 / Reading 3 / Listening 7 with a Listen per row — **KEEP** groups; cut the 13 Listen buttons (tap the word; a reading passage title does not need audio).

### /dashboard fresh (`dashboard-in-desktop.png`)
- Date eyebrow + "Good evening, Min Walker" + welcome sentence — **SHRINK** to the greeting.
- "YOUR FIRST SESSION" card: label, H2, paragraph, "Start Day 1" (primary), "See the whole path" — **KEEP** H2 + primary; cut label and "See the whole path" (Learn is in the header).
- Four stat tiles STREAK 0 · STUDY TIME 0.0 h · LESSONS 0 · DUE REVIEWS 0 — **HUR** (#2).
- Four quick-action cards Review · Take a test · Mock exams · View progress — **CUT** (#3).
- "After your first session you'll see your weekly review here." — **CUT** (a placeholder for a placeholder).
- Primary check: OK (one). Target: greeting · Day-1 card · nothing else.

### /daily-study Day 1 (`daily-study-in-desktop.png`, 1,190 px desktop / 3,261 px mobile)
- Eyebrow "PHASE 1 · FOUNDATION · N5" — **CUT**.
- H1 "Day 1 / 180" + "Day 1 — Hiragana: the basic 46" — **MERGE** into one line.
- "Dashboard" pill — **CUT** (header).
- Sticky progress bar "Day 1 · 0 / 110 min · 0 / 6 tasks" — **KEEP** (real state), shrink to tasks only.
- "Today's goal · 4 objectives" accordion — **CUT** (#9).
- Six task cards (number, kanji glyph, title, minutes chip, "15 questions", status chip, chevron) — **KEEP**; cut the kanji glyph (decorative) and the "To do" chip on unopened tasks (absence of a tick is the state).
- Expanded task 1: instruction paragraph, "Open lesson: …" (primary), "Mark done (40 min)", "Open the lesson first, then mark it done." — **KEEP** primary; HUR "Mark done" until the lesson was opened; cut the helper sentence once it is hidden.
- Right rail "Plan summary" (6 rows + "Target 125 min/day · change in profile") — **CUT** (#9).
- "Jump to a day" form — **MOVE** to /profile (#15).
- "Shortcuts" (Review queue 0 due · Take a test · Progress) — **CUT** (#3).
- Primary check: OK (one).

### Quiz mid-way (`quiz-midway-in-desktop.txt`, `quiz-midway-in-mobile.png`)
- Everything from the daily page stays on screen around the quiz (five other tasks, plan summary, jump-to-day, shortcuts) — **HIDE** while a quiz is in progress; show only the quiz card. On mobile the question sits 1,500 px down a 3,843 px page.
- Quiz header "Daily quiz · Practice · 8 / 15 · 0s · 0s · Multiple choice · FOUNDATION · difficulty 1/5" — **SHRINK** to "8 / 15". Six chips, none actionable (#5).
- Question + 4 options each with a "Listen" button — **KEEP** options; **CUT** the Listen buttons on a "which hiragana is 'so'" question (audio gives the answer away and doubles targets).
- "Press 1–4 to choose, Enter to continue." — **HUR** desktop only, once.
- Feedback "Not quite · …" — **KEEP**.
- "Next question" (primary) + "Exit quiz" — **KEEP**.

### Quiz result (`quiz-result-in-desktop.txt`, 2,772 px)
- "5 of 15 · DAILY QUIZ · RESULT · Keep going · Re-read the lessons linked below…" — **KEEP** score + one line.
- Tiles ACCURACY 33 % · TIME 1 s · PER QUESTION 0.1 s — **CUT** (accuracy = the score already shown; sub-second timings mean nothing).
- "Result saved. Progress, review queue and streak updated." — **SHRINK** to "Saved".
- "Questions to revisit · 10" + ten full cards each with question, both answers, explanation, one "Review: Hiragana: the basic 46" link on top — **SHRINK**: one link + compact rows (question · your answer → correct).
- "Back to today's plan" — **KEEP** as the primary (make it the red one; nothing else on the card is red).
- Surrounding plan, summary, jump, shortcuts — **HIDE** as above.

### /review (`review-in-desktop.png`)
- Chip "SPACED REVIEW" + intro paragraph — **CUT**.
- Four tiles DUE TODAY 0 · OVERDUE 0 · FROM MISTAKES 0 · SCHEDULED 1 — **HUR** (#2); the one non-zero fact ("1 due tomorrow") becomes a sentence.
- Card "Nothing due right now" + "Start a short mixed review" — and a second empty-state card "空 Nothing to review today" + red "Continue today's study" — **MERGE** into one empty state with one primary. Today the screen says "nothing to do" twice and offers two buttons (#7).
- "Upcoming" chart (4 bars for 1 item) + "Total scheduled 1" + row "Hiragana: the basic 46 · tomorrow" — **SHRINK** to the row (#14).
- "How it works" 1–3 — **CUT** (#6).

### /tests (`tests-in-desktop.png`)
- Chip "PRACTICE & TESTS" — **CUT**.
- H1 + "Test history" pill + sentence — **KEEP** H1; cut the pill (same link at the bottom, #8).
- Three cards Daily quiz / Weekly test / Level test, each with two chips ("10 questions", "instant feedback") + paragraph + red button — **SHRINK**: one line each, chips folded into the title ("Daily quiz · 10 q · instant feedback"); one red button (Daily quiz), the other two outlined (#7).
- "Practice quiz by skill" (6 tiles) — **KEEP**.
- "Drills" (2 tiles + explanatory paragraph) — **KEEP** tiles, cut the paragraph.
- Footer links "Test history → Mock exam history → Today's plan →" — **SHRINK** to "Test history".

### /progress (`progress-in-desktop.txt`, 2,477 px)
- Chip "MY LEARNING" + intro paragraph — **CUT**.
- "0 % LEARNED · OVERALL PROGRESS" ring + "Roadmap content learned · N5" + 3-line explanation + "N5 only / All levels" toggle — **SHRINK** to ring + toggle.
- Tiles STUDIED 1m · ITEMS TRACKED 2 · MASTERED 0 · MOCK EXAMS 0 — **HUR** zeros; keep "Studied 1 m" only when > 0.
- "By skill" six cards each with LEARNED/MASTERED/TOTAL sub-tiles (18 numbers, 16 zeros) — **SHRINK** to six rows "Kana 2 / 8"; show MASTERED only when > 0.
- "Mock exams" section (empty state + "Browse mock exams") — **HUR** until one exam exists.
- "Progress over time" chart + duplicate data table below it — **MERGE**: chart or table, not both; HUR until ≥ 2 weeks.
- "Memory status" (New 0 · Learning 1 · Review 0 …) — **HUR** until ≥ 10 items.

### /history (`history-in-desktop.txt`)
- Chip + intro — **CUT**.
- Tiles STUDY DAYS 1 · STUDY TIME 1m · DAYS COMPLETED 0 · QUIZ ACCURACY 33 % — **HUR** zeros; the day list already shows time and accuracy per day (#2).
- Day card (STUDY TIME · LESSONS · QUIZ · TOPICS) — **KEEP**.

### /tests/history (`tests-history-in-desktop.txt`)
- Chip + intro — **CUT**.
- Tiles QUIZZES 1 · AVERAGE ACCURACY 33 % · MOCK EXAMS 0 · BEST EXAM — — **HUR** (#2); one attempt makes an "average" meaningless.
- "NEWEST FIRST" label + H2 "Quizzes and tests" — **CUT** both (H1 is "Test history").
- Attempt row (33 % · Day 1 · Daily quiz · date · 1 s · SCORE 5/15) — **SHRINK**: "33 %" and "5/15" are the same fact; drop "1 s".

### /saved (`saved-in-desktop.txt`)
- Chip + intro — **CUT**.
- Empty state 空 + 3-line how-to — **KEEP**, one line.
- "Browse N2 grammar · N2 vocabulary · N2 kanji" — **CUT** (wrong level and three links to do one thing).

### /mock-exams (`mock-exams-in-desktop.txt`)
- Chip "TESTS" — **CUT**.
- "My exam history" pill — **HUR** until one exam exists.
- "SHOW · Your level · N5 / All levels / N4 / N3 / N2 / N1" chips — **SHRINK** to "Your level (N5) · All levels".
- Three cards A/B/C: chips "N5 · 90 min · 55 questions", H2, kanji title, 60-word structure paragraph, 4-row section list, "Start exam" — **MERGE** into one card: "N5 mock exam · 90 min · 55 questions" + section list once + three buttons A · B · C (#18). Cut the paragraph (it repeats the section list).

### Mock start (`mock-start-in-desktop.txt`)
- Eyebrow "MOCK EXAM · N5" + H1 + kanji title + structure paragraph — **SHRINK** to H1.
- Tiles SECTIONS 4 · QUESTIONS 55 · TIME 90 min — **SHRINK** to one line "4 sections · 55 questions · 90 min".
- "Choose a mode" toggle Full exam / Single section — **SHRINK**: primary "Start full exam" + text link "Start one section instead" (#17).
- Sections table — **KEEP** (shows what is coming), merge the tiles into its total row.
- "Exam rules" `<details>` — **KEEP** collapsed.
- "Back to exams" — **CUT** (breadcrumb/back button).

### /profile (`profile-in-desktop.txt`)
- Chip "ACCOUNT" + sub "Your details, study settings and streak." — **CUT**.
- Avatar + name + email + "N5" chip + "Joined Sep 19" — **KEEP**; cut the N5 chip if there is no level setting to change here.
- Tiles CURRENT DAY 1 / 180 · STREAK 1 · STUDY TIME 0 h · LAST STUDIED — **SHRINK** to "Day 1 of 180 · started Sep 19"; the rest lives on Progress (STUDY TIME 0 h is a zero tile).
- Settings (display name, daily target + explanation, furigana toggle + example, Save changes) — **KEEP**; make "Save changes" the page's only primary (it is currently a 48×28 unlabeled primary button — `PRIMARY button | | 48x28` — which is the furigana switch styled as a CTA; give it switch styling).
- "SESSION" card (two-line explanation + Log out) — **SHRINK** to the Log out button.
- "SHORTCUTS" (Today's study · Progress · Saved items) — **CUT** (#3).
- Add here: "Jump to a day" (moved from /daily-study).

### Account menu / mobile menu — see Header.

---

## 3. Target layouts (top to bottom)

**Home, logged out** — Header · H1 + one line · [Start the 180-day plan] + "Explore the levels" · six level rows · sample lesson card · footer line. (6 blocks; was 8 sections + band.)

**Home, logged in** — redirect to /dashboard.

**/japanese** — Breadcrumb · H1 + one line · Foundation row (title = link, one line) · five level rows (title, one line, five skill links) · footer line. (4)

**/japanese/foundation** — Breadcrumb · H1 + total time · [Start lesson 1] · eight rows (nº · title · min) · "After lesson 8, continue to N5". (5)

**Lesson (foundation / grammar / word / kanji)** — Breadcrumb · sticky "Lesson n of N · Save · Mark as learned (outline until checked)" · headword + Listen · content sections · Quick check · NEXT card. (6)

**/japanese/n5** — Breadcrumb · H1 + one line · [Start from lesson #1] · seven skill rows (name · count · one line, row = link) · footer line. (4)

**Index pages (grammar / vocabulary / kanji / reading / listening)** — Breadcrumb · H1 + [Start with #1] · anchor chips · list · pager (vocab only). (4–5)

**Reading page** — Breadcrumb · H1 · strategy notes · passage + one Listen · vocabulary · timer button · questions · [Check answers] · NEXT. (8, at the ceiling; questions and timer are the work.)

**Listening page** — Breadcrumb · H1 + setting · stepper · player · [I have listened] · NEXT. (6)

**/dashboard (fresh)** — Header · greeting · Day-1 card with [Start Day 1] · (later: streak/due tiles when non-zero) · footer line. (3)

**/daily-study** — sticky "Day 1 · 0/6 tasks" · six task cards, first expanded with [Open lesson] · footer line. (3)

**Quiz** — sticky progress "8 / 15" · question + options · feedback · [Next question] / Exit. (4). Result: score + one line · compact revisit list · [Back to today's plan]. (3)

**/review** — H1 · one state card ("Nothing due · 1 item tomorrow" + one button, or the queue with [Start review]) · footer line. (2–3)

**/tests** — H1 · three test rows (one primary) · practice-by-skill tiles · drills · "Test history". (5)

**/progress** — H1 · ring + level toggle · six skill rows · sections that appear when data exists (weekly, mock, memory). (3 on day one)

**/mock-exams** — H1 · level toggle · one exam card with sections + A/B/C. (3). Start: H1 · one line of totals · sections table · [Start full exam] · "Start one section" link · rules (collapsed). (5)

**/profile** — H1 · identity · settings (name, target, furigana, current day) + [Save] · Log out. (4)

---

## 4. Rules for the codebase

1. **One primary button per screen.** Filled red = the single next step. Everything else is outlined or a text link. "Mark as learned" is outlined until the lesson's quick check is answered; on /tests only "Start daily quiz" is filled; on /review the empty state has one button.
2. **No stat tile with a zero, dash or "none yet" on first visit.** A tile renders only when its value is > 0 (or the row is hidden entirely). Streak, due reviews, mastered, mock exams, best exam, days completed, average accuracy with n = 1 all fall under this.
3. **No badge or chip that is not a filter or a state.** Allowed: anchor/filter chips (Set 1–10, 1–10 … 71–76, 短文/情報検索, level toggle), status (To do / In progress / Done, step n of 7). Forbidden: `JLPT N5` on an N5 page, `Full lesson`, `Common · 2/5`, `exp`, `Multiple choice`, `Difficulty n of 5`, `n characters`, `n lines`, `n questions` when every item has the same value, `Step n of 5`, `PHASE 1 · FOUNDATION · N5`, uppercase eyebrows that restate the H1.
4. **One navigation system.** The header is the navigation. No "Shortcuts", "Quick actions", "SHORTCUTS", footer link columns, "Dashboard" pills or "N5 overview" pills that duplicate a header item or a breadcrumb. Account menu = Saved · Profile · Log out.
5. **One link per destination per screen.** A card is its own link; no "Browse" + "Start from #1" + title link in one card. A hero CTA is not repeated as a card link or a bottom link on the same page.
6. **No marketing on a signed-in screen.** Nothing that links to /signup or /login, no "Sign in to …" sentence, no feature grids, no "Start the 180-day plan" band. Logged-in `/` redirects to `/dashboard`.
7. **No block that explains the block below it.** "How to use these lessons", "The listening routine", "How it works", "Answer each question, then read why…", "Full lesson marks…" and intro paragraphs under H1s are removed; the UI has to be self-explanatory or it is redesigned.
8. **Audio: tap the text, not a button beside it.** Kana tiles, vocabulary rows, readings and examples play on tap; one Listen control per passage; no Listen on quiz options, wrong-example sentences or reading-comprehension options.
9. **Hide until relevant.** Weekly chart (< 2 weeks), memory status (< 10 items), mock-exam summary (0 exams), "My exam history", "Replay"/"Shadowing" before the transcript step, "Mark done" before the lesson was opened, keyboard hints after first use.
10. **Meta lives in one place.** Lesson number and Save/Mark live in the sticky bar only; no eyebrow, no per-section "PART n OF 5" label when a sticky part bar exists; no ON THIS PAGE rail longer than five items.
11. **Counts are for decisions, not decoration.** Show a count when it changes what the learner does (8 lessons, 4 hours, 10 / 15 questions); never as a hero stat strip (707 · 6,400 · 1,607 · 7,842) or per-level grids.
12. **While a quiz or exam is running, the rest of the page is hidden.** No plan summary, jump-to-day, shortcuts or other tasks around an in-progress question.
13. **Footer is one line.** Logo · © · About the JLPT · Profile (or Log in). No columns.
14. **Settings are set once, in Profile.** "Jump to a day" and daily target live only there.
