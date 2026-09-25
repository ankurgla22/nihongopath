import Link from "next/link";
import { Arrow, Container, PageTitle } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { POOL, QUIZ_LENGTH, comboLabel, quizCombos, quizPath } from "@/lib/quiz/quickQuiz";
import { LEVEL_LABEL } from "@/lib/content/schemas";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "Japanese quiz — free JLPT practice from kana to N1",
  description:
    "Ten questions, instant answers, no account. Quiz yourself on hiragana and katakana, or on JLPT N5 to N1 vocabulary, kanji and grammar. New questions every time.",
  path: "/quiz",
});

const LEVEL_NAME: Record<string, string> = {
  foundation: "Before N5",
  n5: "N5", n4: "N4", n3: "N3", n2: "N2", n1: "N1",
};

export default function QuizIndexPage() {
  const combos = quizCombos();
  const levels = [...new Set(combos.map((c) => c.level))];

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Quiz", path: "/quiz" }]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": `${SITE_URL}/quiz`,
            url: `${SITE_URL}/quiz`,
            name: "Japanese quiz",
            description: "Free ten-question Japanese quizzes by JLPT level and skill.",
            inLanguage: "en",
            isPartOf: { "@id": `${SITE_URL}/#website` },
          },
        ]}
      />
      <PageTitle
        title="Japanese quiz"
        description={`Pick a level and a skill and answer ${QUIZ_LENGTH} questions. You get the answer and the reason straight away, and a fresh set every time you play. No account needed, and your best score stays in your own browser.`}
      />

      <div className="max-w-content pb-10">
        {levels.map((level) => {
          const forLevel = combos.filter((c) => c.level === level);
          return (
            <section key={level} className="mt-10 first:mt-6">
              <h2 className="text-sm uppercase tracking-[0.14em] text-muted">
                {LEVEL_NAME[level] ?? LEVEL_LABEL[level as never]}
              </h2>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {forLevel.map((c) => (
                  <li key={`${c.level}-${c.skill}`}>
                    <Link
                      href={quizPath(c.level, c.skill)}
                      className="focus-inset group flex items-center gap-4 surface surface-hover rounded-2xl px-5 py-4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{comboLabel(c.level, c.skill)}</span>
                        <span className="mt-0.5 block text-sm text-muted">
                          {QUIZ_LENGTH} questions drawn from {Math.min(c.count, POOL)}
                        </span>
                      </span>
                      <Arrow className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Container>
  );
}
