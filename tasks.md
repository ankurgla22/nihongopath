# Build a High-Quality Japanese Learning Platform for JLPT N2

## 1. Product Vision

Build a serious, high-quality Japanese learning platform whose primary goal is:

> Help a motivated learner study Japanese every day and prepare for the JLPT N2 exam in approximately 6 months.

The website should aim to be **one of the easiest Japanese-learning websites to understand and use**, with exceptionally clear explanations, visual learning, progressive exercises, frequent testing, and a structured daily study plan.

This must NOT be just:

* a vocabulary website
* a grammar dictionary
* a collection of quizzes
* a static JLPT information website

It should feel like a **complete Japanese course + personal study system + exam preparation platform**.

The learner should be able to log in, study every day, return later, and continue exactly where they stopped.

---

# 2. Core Technology

Use:

* Next.js
* React
* TypeScript
* App Router
* Server-Side Rendering (SSR)
* Server Components by default
* Client Components only where interaction is required
* Tailwind CSS
* Firebase Authentication
* Cloud Firestore
* Firebase Hosting / Firebase App Hosting as appropriate for the Next.js SSR architecture

IMPORTANT:

Do NOT turn the entire application into a client-side SPA.

Public learning content must be server-rendered.

Important lesson text must exist in the initial HTML response.

---

# 3. Firebase Requirements

Use Firebase for user accounts and persistent learning data.

## Authentication

Implement Firebase Authentication.

Initially support:

* Google Login
* Email/password login

Architecture should allow adding additional providers later.

Users should be able to:

* Sign up
* Log in
* Log out
* Stay logged in
* Reset password
* View their profile

Create:

/login

/signup

/forgot-password

/profile

---

# 4. User Progress Must Persist

A user should be able to:

1. Study today.
2. Close the browser.
3. Return tomorrow.
4. Log in.
5. Continue from where they stopped.

Persist progress in Firestore.

Store information such as:

* User ID
* Current level
* Current phase
* Current day
* Completed lessons
* Completed grammar
* Learned vocabulary
* Learned kanji
* Reading progress
* Listening progress
* Quiz results
* Exam results
* Mock exam results
* Incorrect questions
* Review items
* Study time
* Daily streak
* Last study date
* Overall progress

---

# 5. Firestore Data Model

Design a scalable Firestore schema.

For example:

users/{userId}

users/{userId}/progress/{itemId}

users/{userId}/studySessions/{sessionId}

users/{userId}/quizResults/{resultId}

users/{userId}/examResults/{resultId}

users/{userId}/reviewItems/{itemId}

users/{userId}/dailyProgress/{date}

Do NOT put everything into one huge user document.

Keep the data model scalable.

Use Firestore security rules so users can only access their own private learning data.

Public curriculum content should not require authentication.

---

# 6. Public vs Private Architecture

Separate the application into:

## Public

These pages should be accessible without login:

* Home
* Japanese learning guides
* N5
* N4
* N3
* N2
* Grammar
* Vocabulary
* Kanji
* Reading
* Listening
* Public lessons
* Sample exercises
* JLPT information
* Sample mock exams

These pages should be SSR/SEO-friendly.

## Private

Authentication required:

* Dashboard
* Daily Study
* Personal progress
* Study history
* Test history
* Mock exam results
* Review queue
* Saved items
* Personal statistics

---

# 7. Most Important Requirement: CONTENT QUALITY

Do not optimize only for the number of pages.

The quality of the educational content is more important than the number of pages.

Every lesson should answer:

1. What does this mean?
2. When do Japanese people use it?
3. How is it formed?
4. Why is it used?
5. What does it sound like in natural Japanese?
6. What are common mistakes?
7. What similar grammar should I not confuse it with?
8. How will this appear in the JLPT?
9. Can I recognize it in reading?
10. Can I use it in a sentence?

The learner should understand the concept instead of memorizing a definition.

---

# 8. Teaching Philosophy

Use the following learning progression:

CONCEPT
↓
SIMPLE EXPLANATION
↓
VISUAL EXPLANATION
↓
EXAMPLES
↓
GUIDED PRACTICE
↓
INDEPENDENT PRACTICE
↓
QUIZ
↓
REALISTIC JLPT QUESTION
↓
REVIEW
↓
SPACED REPETITION

Do not immediately throw difficult exam questions at beginners.

Teach first, test second.

---

# 9. Make Difficult Japanese Easy

The website should explain difficult concepts in extremely simple language.

For example, instead of saying:

"～わけではない expresses partial negation."

Explain:

> ～わけではない means "It doesn't necessarily mean that..." or "It's not that..."

Then show:

私は日本料理が嫌いなわけではない。

"I don't mean that I dislike Japanese food."

Then visually explain:

嫌い
↓
"dislike"

嫌いなわけではない
↓
"not necessarily dislike"

Then compare:

～わけではない
vs
～わけがない
vs
～はずがない

The learner should immediately understand the difference.

---

# 10. Visual Learning

Use diagrams wherever they improve understanding.

Create reusable diagram components for:

* Sentence structure
* Verb conjugation
* Particles
* Tenses
* Politeness levels
* Passive
* Causative
* Causative-passive
* Potential
* Conditionals
* Giving/receiving
* Time expressions
* Grammar relationships
* JLPT question strategies

Example:

Verb

食べる
│
├── ない → 食べない
├── ます → 食べます
├── て → 食べて
├── た → 食べた
├── れる → 食べられる
└── させる → 食べさせる

Make diagrams responsive and readable on mobile.

---

# 11. Grammar Content Standard

Every grammar lesson should include:

### 1. Grammar Point

### 2. JLPT Level

### 3. Meaning

### 4. Simple Explanation

### 5. Formation

### 6. Visual Diagram

### 7. Natural Examples

### 8. English Meaning

### 9. Similar Grammar

### 10. Difference From Similar Grammar

### 11. Common Mistakes

### 12. Natural Usage Notes

### 13. JLPT Tips

### 14. Practice Questions

### 15. JLPT-style Questions

### 16. Mini Test

### 17. Review Recommendation

---

# 12. Vocabulary Quality

Do not teach isolated vocabulary whenever possible.

Teach words in context.

For each word provide:

* Kanji
* Hiragana
* Meaning
* Part of speech
* Natural example
* Common collocations
* Related words
* Synonyms
* Antonyms where useful
* JLPT level
* Difficulty
* Memory tip where useful

Example:

影響（えいきょう）

Meaning:
Influence / effect

Common patterns:

～に影響を与える
～の影響を受ける

This is much more useful than simply:

影響 = influence

---

# 13. Kanji Learning

Teach kanji through vocabulary and context, not only isolated memorization.

For each kanji show:

* Meaning
* Readings
* Common words
* Example sentences
* Similar-looking kanji
* Common mistakes
* Visual memory aid where useful

Include:

Kanji
↓
Vocabulary
↓
Sentence
↓
Reading
↓
Quiz

---

# 14. Reading Training

Reading should progressively become harder.

Begin with:

Short sentences

↓

Short paragraphs

↓

N3 passages

↓

N2 passages

↓

Long N2 passages

↓

Timed JLPT reading

Teach reading strategies.

For example:

* Find the topic
* Identify contrast
* Identify author's opinion
* Identify supporting evidence
* Identify conclusion
* Understand reference words
* Ignore unnecessary details
* Manage time

After each question explain WHY the answer is correct.

Also explain why the other choices are incorrect when practical.

---

# 15. Listening Training

Create a proper listening-learning architecture.

Each exercise should support:

* Audio
* Transcript
* Vocabulary
* Questions
* Answer
* Explanation
* Replay
* Playback speed
* Shadowing

Learning flow:

Listen once
↓
Answer
↓
Check answer
↓
Read transcript
↓
Listen again
↓
Shadow
↓
Review vocabulary

---

# 16. Daily Study System

This is one of the most important features.

When the user logs in, show:

# Today's Japanese Study

Day 43 / 180

### Today's Goal

Grammar — 25 min

Vocabulary — 20 min

Kanji — 15 min

Reading — 20 min

Listening — 20 min

Review — 15 min

Mini Test — 10 min

Total: ~125 minutes

The user should simply follow the recommended sequence.

---

# 17. Adaptive Daily Learning

The daily plan should eventually become adaptive.

For example:

If the user repeatedly gets grammar questions wrong:

Grammar review time increases.

If vocabulary accuracy is high:

Reduce basic vocabulary review.

If reading performance is weak:

Recommend additional reading.

If listening performance is weak:

Recommend additional listening.

Do not make the user manually manage everything.

---

# 18. 180-Day N2 Curriculum

Create a structured 6-month curriculum.

### Phase 1

Foundation

Days 1–30

### Phase 2

Intermediate

Days 31–60

### Phase 3

N3 → N2 Transition

Days 61–90

### Phase 4

N2 Core

Days 91–135

### Phase 5

N2 Intensive

Days 136–165

### Phase 6

Exam Preparation

Days 166–180

Every day should have specific learning objectives.

---

# 19. Weekly Review

At the end of each week:

Show:

* Lessons completed
* Grammar accuracy
* Vocabulary accuracy
* Kanji accuracy
* Reading accuracy
* Listening accuracy
* Study time
* Weak areas
* Recommended review

Then provide:

## Weekly Test

The weekly test should cover the material learned during that week.

---

# 20. Phase Tests

At the end of each phase:

Create a larger assessment.

Example:

Phase 1 Test

Grammar
Vocabulary
Kanji
Reading
Listening

Then provide detailed analysis.

---

# 21. Mock Exams

Create realistic JLPT-style mock exams.

Support:

* Vocabulary
* Grammar
* Reading
* Listening
* Timed sections
* Full exam mode

Results should be saved to Firebase.

Users should later see:

## My Exam History

Mock Exam #1
Score
Date
Time
Accuracy

Mock Exam #2
Score
Date
Time
Accuracy

etc.

---

# 22. Test Review

After every test:

Show:

Score

Accuracy

Time

Correct answers

Incorrect answers

Question explanations

Weak grammar

Weak vocabulary

Weak reading areas

Weak listening areas

Recommended lessons

The user should be able to click:

"Review this grammar"

and go directly to the relevant lesson.

---

# 23. Question Bank

Create a reusable question bank.

Every question should have metadata:

* Question ID
* Type
* JLPT level
* Difficulty
* Topic
* Grammar
* Vocabulary
* Kanji
* Reading
* Listening
* Correct answer
* Explanation
* Distractor explanations

This allows the system to generate:

* Daily quizzes
* Weekly tests
* Phase tests
* Mock exams
* Review quizzes

from the same content.

---

# 24. Spaced Repetition

Create a review engine.

Track:

* First learned
* Last reviewed
* Number of attempts
* Correct attempts
* Incorrect attempts
* Difficulty
* Next review date

Prioritize weak items.

Example:

New
↓
Learning
↓
Review
↓
Strong
↓
Mastered

Incorrect answers should return to the review queue.

---

# 25. User Dashboard

After login:

# Welcome Back

Continue today's study.

Show:

180-Day Progress

████████░░░░ 43%

Current Day:
43 / 180

Current Streak:
12 days

Study Time:
42 hours

Then:

Today's Study

Continue Learning

Review Mistakes

Take Daily Test

View Progress

---

# 26. Progress Page

Show:

Overall Progress

Grammar

Vocabulary

Kanji

Reading

Listening

Mock Exams

Also show progress over time.

Example:

Week 1
Week 2
Week 3
Week 4

Allow the learner to see improvement.

---

# 27. Study History

Create a study history page.

Show:

Date
Study time
Lessons
Quiz score
Topics studied

Example:

September 17
1h 42m
Grammar + Vocabulary + Reading
87%

The learner should be able to click a date and see what they studied.

---

# 28. Test History

Create:

/tests/history

Show all previous tests.

Each result should be stored in Firestore.

Clicking a test should show:

* Score
* Questions
* Answers
* Mistakes
* Explanations
* Recommended review

---

# 29. Saved / Bookmark System

Allow users to save:

* Grammar
* Vocabulary
* Kanji
* Reading
* Questions

Create:

"My Saved Items"

This should also persist in Firebase.

---

# 30. Search

Create site-wide search.

Search:

Japanese grammar
Vocabulary
Kanji
Lessons
Reading
JLPT topics

Search results should be SEO-friendly and server-rendered where possible.

---

# 31. SEO

SEO is a major requirement.

Public lesson pages must have:

* SSR
* Unique title
* Meta description
* Canonical URL
* Open Graph metadata
* Breadcrumbs
* Semantic HTML
* Structured data where appropriate
* Internal links

Example:

/japanese/n2/grammar/wake-dewa-nai

Important lesson content must exist in initial HTML.

---

# 32. AI / LLM Crawlability

Make public learning content easy for search engines and AI crawlers to understand.

Do NOT hide important educational content behind JavaScript.

A crawler that does not execute JavaScript should still be able to read:

* Lesson title
* Grammar explanation
* Examples
* Vocabulary
* Headings
* Main article content

Use clean semantic HTML.

---

# 33. Sitemap

Generate:

/sitemap.xml

Include public learning pages.

Do not include private user dashboard pages.

---

# 34. Robots

Generate:

/robots.txt

Allow public learning content.

Do not accidentally block important educational pages.

Block private user-specific areas where appropriate.

---

# 35. URL Architecture

Use clean URLs.

Examples:

/japanese

/japanese/n5

/japanese/n4

/japanese/n3

/japanese/n2

/japanese/n2/grammar

/japanese/n2/grammar/wake-dewa-nai

/japanese/n2/vocabulary

/japanese/n2/kanji

/japanese/n2/reading

/japanese/n2/listening

/japanese/n2/tests

/japanese/n2/mock-exams

---

# 36. Authentication Routes

Private routes:

/dashboard

/daily-study

/progress

/history

/tests/history

/mock-exams/history

/review

/saved

/profile

Protect these routes with authentication.

---

# 37. Firebase Security

Create proper Firestore security rules.

Users must NOT be able to read or modify another user's:

* Progress
* Test results
* Study history
* Saved items
* Review items

Never trust user IDs supplied by the client.

Use authenticated Firebase user identity.

---

# 38. Content Storage

Do NOT put the entire curriculum directly inside React components.

Use structured content.

Possible approach:

content/
n5/
n4/
n3/
n2/

grammar/
vocabulary/
kanji/
reading/
listening/
questions/
exams/

The system should make it easy to add new content.

---

# 39. Content Authoring

Make content easy for a human content editor to create.

For example:

Grammar lesson:

{
"id": "wake-dewa-nai",
"level": "N2",
"title": "～わけではない",
"meaning": "...",
"formation": "...",
"examples": [],
"similarGrammar": [],
"commonMistakes": [],
"questions": []
}

Use TypeScript types/schema validation.

---

# 40. UI Design

The website should look like a premium educational product.

Design principles:

* Very clean
* Minimal clutter
* Excellent typography
* Large readable Japanese
* Clear English explanations
* Good spacing
* Friendly visual hierarchy
* Responsive
* Mobile-first learning experience

Do not overload every page with cards.

Use visual hierarchy intelligently.

---

# 41. Learning Page UX

Every lesson should clearly show:

WHERE AM I?

WHAT AM I LEARNING?

WHY DO I NEED THIS?

HOW DOES IT WORK?

TRY IT

TEST YOURSELF

REVIEW

CONTINUE

The learner should never feel lost.

---

# 42. Beginner-Friendly Explanations

Even when teaching N2 grammar, explanations should be understandable to someone who is not a Japanese linguistics expert.

Avoid unnecessarily complicated terminology.

When terminology is necessary, explain it.

Example:

"Transitive verb"

Then:

> A verb where someone/something performs an action on something else.

Then give examples.

---

# 43. English Support

English should be the primary explanation language initially.

Japanese examples should remain natural Japanese.

Architecture should allow additional explanation languages later.

Do not mix unnatural machine-translated English into lessons.

Educational content should be written in clear, natural English.

---

# 44. Japanese Naturalness

Examples should use natural Japanese.

Avoid strange textbook-only sentences unless specifically teaching a grammar structure.

Where useful, distinguish:

"Grammatically correct"

from:

"Natural Japanese"

This is especially important for intermediate and advanced learners.

---

# 45. Exam Strategy

Include a dedicated JLPT strategy section.

Teach:

* How to approach vocabulary questions
* Grammar question strategies
* Reading time management
* How to identify the author's opinion
* Listening strategies
* How to handle unknown vocabulary
* How to eliminate wrong answers
* How to manage exam time

Keep these as factual educational strategies rather than guarantees of passing.

---

# 46. Quality Control

Before considering content complete, check:

* Is the explanation correct?
* Is the Japanese natural?
* Is the English clear?
* Are examples useful?
* Is the grammar distinction accurate?
* Are the quiz answers correct?
* Are distractors plausible?
* Does the explanation explain WHY?
* Is the difficulty appropriate for the JLPT level?

Avoid generating large amounts of low-quality content just to increase page count.

---

# 47. Performance

Keep JavaScript minimal.

Prefer:

Server Components
↓
SSR
↓
Static generation where appropriate
↓
Client Components only for interactive features

Interactive features such as:

* Quiz
* Timer
* Audio player
* Progress interaction
* Login
* Dashboard

can use client-side JavaScript.

But public lesson content should remain accessible without requiring JavaScript execution.

---

# 48. Firebase Hosting / Deployment

Prepare the project for Firebase deployment.

Include:

* Firebase configuration
* Environment variable handling
* Firebase Authentication configuration
* Firestore configuration
* Firestore security rules
* Deployment configuration
* Production build configuration

Do NOT expose private Firebase/Admin credentials in browser code.

If Firebase Admin SDK is required, keep it server-side.

---

# 49. Error Handling

Handle:

* Firebase unavailable
* User not logged in
* Expired session
* Network errors
* Failed quiz submission
* Firestore errors

The user should never lose test results because of a temporary UI error.

Where appropriate, save locally first and synchronize safely.

---

# 50. Offline-Friendly Design

Where practical, support temporary offline access for learning content.

At minimum, do not lose quiz progress because of a temporary network problem.

Design the architecture so offline/PWA functionality can be added later.

---

# 51. Analytics

Prepare architecture for anonymous/product analytics later.

Potential metrics:

* Lesson completion
* Quiz completion
* Average accuracy
* Study sessions
* Drop-off points
* Most difficult lessons

Do not collect unnecessary personal information.

---

# 52. Accessibility

Follow accessibility best practices:

* Keyboard navigation
* Semantic HTML
* Proper labels
* Focus states
* Accessible buttons
* Readable font sizes
* Screen-reader-friendly content

---

# 53. Testing

Test:

* Authentication
* Firestore operations
* Security rules
* Quiz scoring
* Progress calculation
* Daily study generation
* Review algorithm
* SSR
* SEO metadata
* Sitemap
* robots.txt
* Mobile layout

Most importantly:

Verify that public lesson content appears in the initial server-rendered HTML.

---

# 54. Initial MVP

Build a genuinely usable MVP.

Include:

### Authentication

Google login
Email/password

### Curriculum

180-day roadmap

### Learning

Grammar
Vocabulary
Kanji
Reading
Listening

### Practice

Daily exercises
Quizzes
Weekly tests
Phase tests

### Exams

N2-style mock exam

### Personalization

Dashboard
Progress
Study history
Test history
Saved items
Review items

### Infrastructure

Firebase Authentication
Firestore
SSR
SEO
Sitemap
robots.txt
Firebase deployment

---

# 55. Sample Content

Do not use lorem ipsum.

Create realistic educational sample content.

At minimum:

20+ grammar lessons

100+ vocabulary items

50+ kanji

5+ reading passages

5+ listening exercise structures

50+ quiz questions

1 complete sample mock exam structure

The content should demonstrate the quality expected from the finished product.

---

# 56. IMPORTANT: Do Not Fake Features

Do not create buttons that only look functional.

If a button says:

"Start Quiz"

it should actually start the quiz.

If a user completes a quiz:

* Calculate the score
* Save the result
* Update progress
* Update review items
* Show explanations

If a user returns tomorrow:

Their previous progress must still exist.

---

# 57. Development Process

Before coding:

1. Inspect the existing repository.
2. Identify the current framework.
3. Identify existing dependencies.
4. Create an architecture plan.
5. Create the data model.
6. Create the route structure.
7. Create reusable UI components.
8. Then implement incrementally.

Do not rewrite working code unnecessarily.

---

# 58. Implementation Order

### Step 1

Project architecture

### Step 2

Next.js + SSR

### Step 3

UI system

### Step 4

Firebase Authentication

### Step 5

Firestore data model + security rules

### Step 6

Curriculum

### Step 7

Grammar/Vocabulary/Kanji

### Step 8

Reading/Listening

### Step 9

Quiz engine

### Step 10

Daily Study

### Step 11

Progress tracking

### Step 12

Review system

### Step 13

Mock exams

### Step 14

SEO / sitemap / robots

### Step 15

Performance optimization

### Step 16

Firebase deployment

---

# 59. Final Product Principle

Always ask:

> "Will this actually help someone learn Japanese?"

not:

> "Does this page look impressive?"

The goal is not to build the website with the most features.

The goal is to build a website where a learner can consistently study every day, understand difficult Japanese easily, practice what they learned, identify weaknesses, review them, and progressively prepare for the JLPT N2.

Prioritize:

CONTENT QUALITY
→ CLARITY
→ LEARNING EFFECTIVENESS
→ PRACTICE
→ FEEDBACK
→ PROGRESS
→ EXAM PREPARATION
→ PERFORMANCE
→ SEO

Build the product so that it can eventually expand from N5–N2 to N1 without requiring a major architectural rewrite.

Start by inspecting the repository and then provide the architecture plan before implementing the first phase.



One architectural recommendation

For your use case, I would structure it roughly like this:

                    Japanese Learning Website
                              │
             ┌────────────────┴────────────────┐
             │                                 │
       PUBLIC CONTENT                     USER ACCOUNT
             │                                 │
       Next.js SSR                       Firebase Auth
             │                                 │
    ┌────────┼────────┐                 Firestore
    │        │        │                     │
 Grammar  Vocabulary  Kanji              Progress
    │        │        │                  Test Results
 Reading  Listening  Exercises           Study History
    │        │        │                  Review Items
    └────────┼────────┘                  Saved Items
             │
        JLPT N5 → N4 → N3 → N2
             │
       180-Day Roadmap
             │
       Daily Study Plan
             │
        Practice → Test
             │
         Mock Exam

The important distinction is: Firebase should primarily handle the user's personal state, while your Japanese curriculum should remain structured content that Next.js can SSR.

That gives you both things you want: very fast/indexable public educational pages and persistent personal learning history after login.