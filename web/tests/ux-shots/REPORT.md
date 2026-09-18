# Nihongo Path — first-time learner UX review

Method: `node tests/ux-walk.mjs` against the production build (http://localhost:3000) drove a brand-new account through the 21-step journey at desktop 1366×850 and mobile 390×844, light and dark (toggled via the header button). 170 screenshots plus a `.txt` text/heading/tap-target dump per shot live in this folder (`<step>-<name>-<desktop|mobile>-<light|dark>.png`). Two temp users were created through the real signup form and deleted afterwards. Findings are written from the point of view of a learner who has never seen the product; they were checked against the live pages, not only the images.

Note on the images: full-page captures repeat the sticky header (and the daily-study progress bar) somewhere mid-page. That is a capture artefact, not something a user sees.

Severity: **blocker** = a new user is misled or cannot complete a core step; **major** = noticeably hurts trust, orientation or comfort; **minor** = polish. No blockers were found: every step of the journey could be completed.

---

## Top 10 (ordered)

1. **Major — "Log in" in the footer while you are logged in** (every private page, e.g. `06-dashboard-fresh-desktop-light.png`, `19-profile-desktop-light.png`). The Account column of the footer still lists "Log in" after signup. A newcomer wonders whether the signup worked. → Swap for "Profile / Log out" when a session exists, or drop the auth link from the footer.
2. **Major — The product presents itself as an N2 product to an absolute beginner** (header "N2" tab on every page; footer column "N2 SKILLS"; tagline "Pass the JLPT N2"; 404 chips "N2 course / N2 grammar"; no-results chips all N2 — `01-home-loggedout-desktop-light.png`, `21-404-desktop-light.png`, `20b-search-noresults-mobile-light.png`). A Day-1 kana learner is told to start at Foundation but every shortcut points at N2. → Make the level tab and footer/suggestion chips follow the user's current level (N5 for a new account); keep the "N2" tab only for logged-out marketing.
3. **Major — Wrong counts on the level overview** (`02-japanese-desktop-light.png`): heading "Four levels, one road" / "From zero to N2" while six cards are shown, and the N1 card says "Step 5 of 4". Home says "four levels" too. It is the first content page a newcomer reads and it looks unfinished. → "Five levels plus Foundation", steps "1 of 5 … 5 of 5".
4. **Major — Copy tells a signed-in user to sign in** (`11b-n5-word-mobile-light.png`, `12b-n5-kanji-desktop-light.png`): the "Quick check" on every word and kanji page says "Sign in and use the daily drills to have answers count toward your review schedule." while the user is signed in. → Render that sentence only when logged out; when logged in say "Answers here do not count; use Drills to schedule reviews", or make them count.
5. **Major — Progress page overflows horizontally on mobile** (`16-progress-mobile-light.png`; measured 541 px in a 390 px viewport). The page pans sideways, the chart and stat cards do not fit, the page feels broken on a phone. → Let the weekly chart scroll inside its own container and cap card grids at 100 %.
6. **Major — Terminology for the same thing changes on every screen**: "Mini Test" (daily plan, result card), "Start mini test", "Daily quiz" (Tests page, dashboard shortcut "Daily quiz, weekly & phase t…"), "mini tests" (dashboard weak areas), "Quick check" (lessons), "Drills", "Practice by skill", "Test yourself" (foundation lesson), "Take a test" (`07-daily-study-day1-desktop-light.png`, `17-tests-desktop-light.png`, `06-dashboard-fresh-desktop-light.png`). A newcomer cannot tell whether these are one activity or six. → One word per activity: *Quiz* (10–15 q, instant feedback), *Test* (exam-style), *Drill* (word/kanji flash), *Quick check* (in-lesson). Rename the Day task to "Daily quiz" to match Tests and Dashboard.
7. **Major — Day 1 plan has two tasks both called "Kana", and task 1's text tells you to take a quiz that is actually task 5** (`07-daily-study-day1-desktop-light.png`; Plan summary "Kana 40 min / Kana 15 min"). The user cannot tell what the second Kana task is, and "Mark done (40 min)" lets you finish a task without opening the lesson. → Name tasks by content ("Hiragana rows あ–な", "Pronunciation basics"); make "Open lesson" the primary action and show "Mark done" only after the lesson link was visited.
8. **Major — Dashboard for a brand-new user speaks as if they have history** (`06-dashboard-fresh-desktop-light.png`): "Pick up where you left off", "0 days" streak flame, an empty "Weekly review" with six "no questions yet" bars, "Recent tests → My exam history". The one thing a new user needs ("Do Day 1: learn hiragana, ~110 min") competes with five empty widgets. → First-visit variant: hero "Start Day 1 — Hiragana: the basic 46 (about 110 min)", hide or collapse Weekly review / Recent tests until data exists, CTA "Start Day 1" instead of "Continue today's study".
9. **Major — Internal ids and jargon leak into learner-facing text**: Review page lists the upcoming item as `foundation-1` and explains "return on their SRS schedule" / "have a low ease" (`15-review-desktop-light.png`); listening pages show a "Browser speech" chip and "LISTEN ONCE · browser speech" (`14b-n5-listening-step1-1-listen-desktop-light.png`); mock rules say "hear them through your browser's text-to-speech"; the listening Check step lists "(correct answer)" as one of the "Why the other options are wrong" bullets (`14d-n5-listening-step3-3-check-desktop-dark.png`). → Show the lesson title instead of the slug; "spaced review" instead of SRS/ease; "Synthetic voice" or no chip; skip the correct option in the "why wrong" list.
10. **Major — Mock exams list is ordered N1 → N5 and titled in kanji** (`18-mock-exams-desktop-dark.png`, `18b-mock-start-mobile-light.png`). An N5 learner scrolls past twelve N1–N4 cards to reach theirs and cannot read "N5 模擬試験 A" or the section names (言語知識, 読解, 聴解) yet. → Sort by the user's level first, add English glosses ("Mock exam A", "Reading", "Listening"), add a "Your level: N5" filter.

---

## All findings

### 1. First-visit clarity (home, /japanese, foundation)

| # | Sev | Where | What the user experiences | Why it hurts | Recommendation |
|---|-----|-------|---------------------------|--------------|----------------|
| 1.1 | minor | Home, `01-home-loggedout-desktop-light.png` | Hero card shows "Today's study · Day 42 · Phase 2 · N2" with progress bars. | Looks like real data; a newcomer may think the app already knows them or that it is N2-only. | Label it "Example" or show the Day 1 card instead. |
| 1.2 | minor | Home | "Four levels, one road" heading over six cards (Foundation, N5–N1). | Contradiction on the first screen. | See Top 3. |
| 1.3 | minor | Home mobile, `01-home-loggedout-mobile-light.png` | Page is ~9,000 px tall; "Start the 180-day plan" exists only at the top and in the red banner at the very bottom. | On a phone the CTA disappears after one flick. | Sticky compact "Start free" bar on mobile once the hero scrolls out. |
| 1.4 | ok | /japanese, /foundation | Pink "Foundation — start here" band, "Start lesson 1 →" and "Skip to N5". | A newcomer knows where to begin in under 5 seconds. | — |
| 1.5 | minor | /japanese path rail | "かな → N5 → … → N1" clips N1 on desktop and needs horizontal scroll with no affordance. | N1 reads as "A…". | Wrap to two rows or shrink the chips. |
| 1.6 | minor | Foundation lesson, `04-foundation-lesson-desktop-light.png` | ~7,800 px lesson with the 20-question "Test yourself" at the very end; no sticky part indicator. | A first lesson that looks endless is intimidating; users do not know how far they are. | Sticky "Part x of 6" mini-bar (as grammar lessons have) plus "Jump to test". |

### 2. Signup and onboarding

| # | Sev | Where | What | Why | Recommendation |
|---|-----|-------|------|-----|----------------|
| 2.1 | ok | /signup, `05b-signup-empty-submit-desktop-light.png`, `05c-signup-weak-password-mobile-light.png` | Empty submit → "Could not create the account · Please enter your name"; weak password → "Password must be at least 6 characters"; hint under the field. | Clear, inline, no jargon. | Put the message under the offending field and focus it. |
| 2.2 | minor | /signup mobile | The benefit panel (180-day plan, progress follows you) is desktop-only. | Value proposition is thinner on mobile. | Show the three benefit bullets above the form on mobile. |
| 2.3 | major | /dashboard fresh | See Top 8. | | |
| 2.4 | minor | /dashboard | Streak chip "0 days" with a flame at the top right on the very first visit. | A zero streak reads as a failure state. | Hide the chip until the first study day is logged. |
| 2.5 | minor | Account menu, `06c-account-menu-mobile-light.png` | The avatar is a plain "U" circle with no caret; the menu is the only mobile route to Saved and Profile. | New users may not know it opens a menu. | Add a chevron or the first name next to the avatar. |

### 3. Daily study (Day 1) and the kana quiz

| # | Sev | Where | What | Why | Recommendation |
|---|-----|-------|------|-----|----------------|
| 3.1 | major | /daily-study | Two "Kana" tasks; task 1 copy points to a quiz that is task 5 — Top 7. | | |
| 3.2 | major | /daily-study | "Mark done (40 min)" is the primary red button; the actual lesson is a small white link "Hiragana: the basic 46  kana →". | The most prominent action logs 40 minutes without learning anything. | Lesson link as primary button, "Mark done" as outline, shown after the lesson was opened. |
| 3.3 | minor | /daily-study | "Today's goal · 4 objectives" duplicates the task list in different words. | Doubles the reading before the first action. | Collapse by default or merge into task headers. |
| 3.4 | minor | Kana quiz, `08c-quiz-question-answered-mobile-light.png` | The Day-1 quiz asks "Which hiragana is 'to'?" even if the user skipped the lesson; result 5/15 "Keep going". | 33 % on the first ever activity is demotivating. | Gate the quiz behind tasks 1–2 or warn "Finish the kana lessons first". |
| 3.5 | minor | Quiz result, `08d-quiz-result-desktop-dark.png` | Stats "TIME 4s · PER QUESTION 0s". | "0s per question" is nonsense to a user. | Show tenths or hide when under 1 s. |
| 3.6 | minor | Quiz in progress | "Exit quiz" is a small grey text link beside the red "Next question" button; no confirmation. | Easy mis-tap on mobile loses the attempt. | Secondary button with confirm, or keep partial progress. |
| 3.7 | minor | Quiz result | "Questions to revisit" shows ten cards each with the same "Review: Hiragana: the basic 46 →" link. | Noise; mistakes are hard to scan. | Group by lesson: one link, compact rows. |
| 3.8 | ok | Jump to a day, `08e-daily-jump-to-day-mobile-light.png` | "Joining mid-way or repeating a day? Set your current day here." + number + Go. | Discoverable and explained. | Add "of 180" after the input. |
| 3.9 | minor | Sticky bars, mobile | Header is two rows (120 px) and the day progress bar adds ~40 px: ~20 % of the screen is chrome. | Less room for content. | Collapse the second nav row on scroll. |

### 4. Content pages (grammar, vocabulary, kanji, reading, listening)

| # | Sev | Where | What | Why | Recommendation |
|---|-----|-------|------|-----|----------------|
| 4.1 | ok | N5 grammar lesson, `10a-n5-grammar-lesson-top-mobile-light.png`, `10b-n5-grammar-lesson-middle-desktop-dark.png` | Sticky lesson bar (Lesson 1 of 76, Save, Mark as learned), section chips, desktop "On this page" rail, ~30 px headword and ~18 px body Japanese, listen buttons on every example, common-mistake cards with strikethrough. | Reading comfort, hierarchy and dark contrast are good. | — |
| 4.2 | minor | N5 grammar index, `09-n5-grammar-index-desktop-light.png` | All 76 cards carry a green "Full lesson" badge; the intro explains "Full lesson marks the 76 with a diagram…". | When 100 % qualify the badge carries no information and is a content-ops distinction. | Drop the badge. |
| 4.3 | minor | Grammar index | Nothing shows which lessons Day 1–10 cover or which are learned. | The index does not connect to the plan. | "Day n" chips (as kanji pages do) and a learned tick. |
| 4.4 | major | Word & kanji pages | "Sign in and use the daily drills…" shown to a signed-in user — Top 4. | | |
| 4.5 | major | Kanji index, `12-n5-kanji-index-mobile-dark.png`; kanji page "Day 1" chip | Kanji are grouped "Day 1 … Day 10 · Start day 1 →" while the plan uses "Day 1 / 180". | Two different "Day 1"s; a plan-Day-1 user expects kanji "Day 1" to be today's. | Rename to "Set 1 … Set 10". |
| 4.6 | minor | Vocabulary index, `11-n5-vocabulary-index-desktop-light.png` | 150 cards per page, tiny "#12" numbers, 28–32 px speaker targets at the card edge. | Dense; listen targets are small on mobile. | 40 px targets; hide "#n" on mobile. |
| 4.7 | minor | Reading page, `13b-n5-reading-timer-running-desktop-light.png` | Furigana is inline in parentheses ("中国（ちゅうごく）から来（き）ました") while Profile has "Show furigana — readings above kanji". | Parentheses break the reading rhythm; the toggle promises ruby text. | Render `<ruby>` in passages, honouring the toggle. |
| 4.8 | minor | Reading page mobile, `13b-n5-reading-timer-running-mobile-dark.png` | Timer is a fixed bottom bar (~90 px). | Can cover the last answers / "Check answers" at the end of the page and sits over the footer. | Bottom padding equal to the bar, or dock the timer in the header on mobile. |
| 4.9 | ok | Reading timer | "Running 2:27 of 2:30 · Pause · Reset", "Aim to finish within 2 min 30 s", answering without the timer allowed. | Clear and non-punitive. | — |
| 4.10 | ok | Listening steps, `14b`–`14f` | 7 locked steps with one-line instructions, speed controls, shadowing toggle, per-option explanations. | Excellent structure for a first-timer. | — |
| 4.11 | major | Listening Check | "(correct answer)" bullet — Top 9. "Not quite. The answer is 2." duplicates the green highlight. | | Skip the correct item. |
| 4.12 | minor | Listening step 2 (Answer), `14c-n5-listening-step2-2-answer-mobile-light.png` | Copy says "You can play the audio again if you must" but there is no player on this step. | Users hunt for a play button. | Small "Replay" control on the Answer step. |
| 4.13 | minor | Listening | Chip "Browser speech", "LISTEN ONCE · browser speech". | Jargon; sets no expectation that the voice is synthetic. | "Synthetic voice" tooltip or drop. |

### 5. Navigation and orientation

| # | Sev | Where | What | Why | Recommendation |
|---|-----|-------|------|-----|----------------|
| 5.1 | major | Header, all pages | Primary nav is Learn · N2 · JLPT · Strategy; no "Today / Daily study" item. | Today's plan is reachable only via Dashboard or the avatar menu. See Top 2. | Signed-in header: Today · Learn · Review · Tests · Progress. |
| 5.2 | minor | Breadcrumbs | "Home › N5 › Grammar › です" vs "Home › Japanese › N5 › Reading › …" vs "Home › Learn Japanese › N5 › Vocabulary". | Inconsistent. | One scheme. |
| 5.3 | ok | Item pages | "Next →" card and "All N5 …" pill at the bottom of every item page. | Always a forward path. | Add "Previous". |
| 5.4 | minor | Daily study | "Dashboard" pill top-right is the only way back. | On mobile it is above the fold only. | Keep, plus a header "Today" item. |

### 6. Review, progress, tests, mock exams, profile

| # | Sev | Where | What | Why | Recommendation |
|---|-----|-------|------|-----|----------------|
| 6.1 | major | /review, `15-review-desktop-light.png` | "Nothing due right now" next to a big red "Start review session"; "Your queue is clear" card below; "Upcoming: foundation-1 · tomorrow"; "SRS schedule", "low ease". | Contradictory state, a raw id, jargon. | Secondary "Start a short mixed review" when nothing is due; lesson title; plain-English "How it works". |
| 6.2 | major | /progress mobile | Horizontal overflow — Top 5. | | |
| 6.3 | major | /progress, `16-progress-desktop-light.png` | Weekly chart labels read "Week 1 · Jul 27, Week 1 · Aug 3 … Week 1 · Sep 14". | Visible bug; undermines trust in the numbers. | Date only, or real week numbers. |
| 6.4 | minor | /progress | "Roadmap content learned 0 %" over 6,400 words / 1,607 kanji N5–N2; every skill 0 % except Kana 25 %. | A wall of zeros on Day 1 is discouraging and the denominator spans levels not chosen yet. | Default to the current level with an "All levels" toggle. |
| 6.5 | minor | /progress Memory status | Segmented bar is 100 % blue/red for two items. | Looks alarming with tiny n. | Chips until ≥ 10 items. |
| 6.6 | minor | /tests, `17-tests-desktop-light.png` | "Phase 1 test", chips "test mode"/"practice", "drawn from N5 and below (your current level, Day 1)". | "Phase" is plan-internal; "N5 and below" is odd at the lowest level. | "Level test (N5)"; chips "instant feedback" / "exam style". |
| 6.7 | major | /mock-exams | N1-first order and kanji-only titles — Top 10. | | |
| 6.8 | minor | Mock start, `18b-mock-start-mobile-light.png` | Five long rule paragraphs precede "Choose a mode". | Long read before the first decision. | Mode chooser first; rules collapsed. |
| 6.9 | minor | /profile, `19-profile-desktop-light.png` | "Current day 1 / 180" with an unexplained sub-line "1"; "Last studied 2026-09-18" (ISO); avatar and name overlap the red banner edge. | Small trust dents. | "Started Sep 18"; friendly dates; pad the banner. |
| 6.10 | ok | /profile | Daily target hint and furigana toggle with example. | Clear. | — |

### 7. Search and 404

| # | Sev | Where | What | Why | Recommendation |
|---|-----|-------|------|-----|----------------|
| 7.1 | ok | `/search?q=学校`, `20-search-desktop-light.png` | 13 grouped results with level badges, readings, listen icons. | Good. | Level filter; 28 px chevron/speaker targets are tight on mobile. |
| 7.2 | minor | No results, `20b-search-noresults-mobile-light.png` | Helpful message, but suggestion chips are all N2. | See Top 2. | Use the current level. |
| 7.3 | ok | 404, `21-404-desktop-light.png` | 迷 "mayou · to get lost", search box, chips. | Charming and useful. | Same N2 chip issue. |

### 8. Mobile ergonomics

| # | Sev | Where | What | Recommendation |
|---|-----|-------|------|----------------|
| 8.1 | major | /progress | Horizontal scroll (Top 5). No other page overflowed. | |
| 8.2 | minor | Header | Two-row sticky header = 120 px of an 844 px screen. | Collapse row 2 on scroll. |
| 8.3 | minor | Speaker/chevron buttons in lists | 28–32 px measured (vocab index, search, reading options). | 40–44 px hit areas via padding. |
| 8.4 | minor | Reading timer | Fixed bottom bar — see 4.8. | |
| 8.5 | ok | Forms | 48 px inputs, labels above, 16 px font (no zoom on focus), autocomplete set. | — |

### 9. Accessibility basics

| # | Sev | Where | What | Recommendation |
|---|-----|-------|------|----------------|
| 9.1 | ok | Keyboard focus, `22-keyboard-focus-desktop-light.png` | Visible red ring on the focused nav item. | Add a "Skip to content" link. |
| 9.2 | ok | Headings | Exactly one `h1` on every captured page; sane h2/h3 order (see `.txt` dumps). | — |
| 9.3 | minor | Dark mode | 11 px uppercase muted labels ("ON-YOMI", "STEP 1 OF 7", stat labels) sit near 3:1 on dark cards. | Lift the muted token in dark mode or use 12 px. |
| 9.4 | ok | Theme toggle | aria-label + aria-pressed; persists across pages. | — |

### 10. Performance feel

| # | Sev | Where | What | Recommendation |
|---|-----|-------|------|----------------|
| 10.1 | minor | Right after signup | Console: "Failed to fetch RSC payload … Falling back to browser navigation" (dashboard, daily-study, progress). The user sees a full reload/flash instead of a smooth transition. | Fix the failing prefetch (SSL error on fetch) so client navigation works after auth. |
| 10.2 | ok | Private pages | Skeletons with `aria-busy`; "Saving your result…" / "Result saved." callouts. | — |

---

## Five things that work well

1. **"Start here" is unmistakable on the learning pages** — the pink Foundation band on /japanese, "Start lesson 1 → / Skip to N5" on /foundation and the "Before N5" badge give a beginner one obvious entry.
2. **Grammar lessons are a pleasure to read** — large headword with audio, Meaning → Simple explanation → Formation → Diagram → Examples → Common mistakes (strikethrough) → Test yourself, section chips, sticky Save / Mark as learned, good contrast in both themes.
3. **The listening flow teaches exam technique, not just content** — seven locked steps with one-line instructions, speed and shadowing controls, per-option explanations after checking.
4. **Reading pages set expectations** — strategy notes before the passage, time-limit and length chips, a pre-passage vocabulary list, and a non-punitive timer with a target.
5. **Error, empty and not-found states are humane** — inline signup errors in plain English, "Your queue is clear" with a next action, "Nothing matched …" with suggestions, and the 迷 404 with a search box.
