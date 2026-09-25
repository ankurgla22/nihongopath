import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, Breadcrumbs, Container } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { QuickQuiz } from "@/components/quiz/QuickQuiz";
import { QUIZ_LENGTH, comboLabel, comboTitle, parseCombo, quizCombos, quizPath, quizPool } from "@/lib/quiz/quickQuiz";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";

type Params = { level: string; skill: string };

export function generateStaticParams() {
  return quizCombos().map((c) => ({ level: c.level, skill: c.skill }));
}

/** Where to go to actually learn this, rather than just be tested on it. */
function studyHref(level: string, skill: string): string {
  if (level === "foundation") return "/japanese/foundation";
  if (skill === "kana") return "/japanese/foundation";
  return `/japanese/${level}/${skill}`;
}

export function generateMetadata({ params }: { params: Params }) {
  const combo = parseCombo(params.level, params.skill);
  if (!combo) return {};
  const title = comboTitle(combo.level, combo.skill);
  return pageMetadata({
    title: `${title} — ${QUIZ_LENGTH} free practice questions`,
    description: `Answer ${QUIZ_LENGTH} ${comboLabel(combo.level, combo.skill).toLowerCase()} questions with the reason for every answer. New questions each time, no account needed.`,
    path: quizPath(combo.level, combo.skill),
  });
}

export default function QuizPage({ params }: { params: Params }) {
  const combo = parseCombo(params.level, params.skill);
  if (!combo) notFound();
  const pool = quizPool(combo.level, combo.skill);
  if (pool.length < QUIZ_LENGTH) notFound();

  const title = comboTitle(combo.level, combo.skill);
  const path = quizPath(combo.level, combo.skill);
  const study = studyHref(combo.level, combo.skill);

  // Somewhere to go next from the result screen: the same level's other skills first, then the
  // same skill one level up, which is the natural "that was easy" move.
  // The first round is chosen here so the HTML arrives with real questions in it: the page
  // declares Quiz schema, and a crawler that saw only a "shuffling…" placeholder would be reading
  // an empty quiz. Easiest first, matching how the browser draws every later round.
  const initial = [...pool]
    .slice(0, QUIZ_LENGTH)
    .sort((a, b) => a.difficulty - b.difficulty);

  const all = quizCombos();
  const nextUp = [
    ...all.filter((c) => c.level === combo.level && c.skill !== combo.skill),
    ...all.filter((c) => c.skill === combo.skill && c.level !== combo.level),
  ]
    .slice(0, 4)
    .map((c) => ({ href: quizPath(c.level, c.skill), label: comboTitle(c.level, c.skill) }));

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Quiz", path: "/quiz" },
            { name: title, path },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Quiz",
            "@id": `${SITE_URL}${path}`,
            url: `${SITE_URL}${path}`,
            name: title,
            educationalLevel: combo.level === "foundation" ? "Beginner" : `JLPT ${combo.level.toUpperCase()}`,
            numberOfQuestions: QUIZ_LENGTH,
            inLanguage: "en",
            about: { "@type": "Thing", name: "Japanese language" },
            isPartOf: { "@id": `${SITE_URL}/#website` },
          },
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Quiz", path: "/quiz" }, { name: title }]} />

      <div className="max-w-content pb-10">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-h1">{title}</h1>
          <Link href="/quiz" className="text-sm font-medium text-accent hover:underline">
            Change level or skill
          </Link>
        </div>
        <p className="mt-2 text-ink-2">
          {QUIZ_LENGTH} questions, drawn fresh from {pool.length}. The answer and the reason appear as soon as you choose.
        </p>

        <div className="mt-7">
          <QuickQuiz
            pool={pool}
            initial={initial}
            title={title}
            studyHref={study}
            bestKey={`quiz-best:${combo.level}:${combo.skill}`}
            nextUp={nextUp}
          />
        </div>

        <p className="mt-8 text-sm text-muted">
          No account needed. Your best score is kept in this browser and never sent anywhere.{" "}
          <Link href={study} className="text-accent hover:underline">
            Study {comboLabel(combo.level, combo.skill).toLowerCase()} properly <Arrow />
          </Link>
        </p>
      </div>
    </Container>
  );
}
