import Link from "next/link";
import { Arrow, Breadcrumbs, Container } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { VerbQuiz } from "@/components/quiz/VerbQuiz";
import { getVerbs } from "@/lib/content/verbs";
import { QUIZ_LENGTH, comboTitle, quizCombos, quizPath } from "@/lib/quiz/quickQuiz";
import { buildVerbQuestions, seeded, type VerbCard } from "@/lib/quiz/verbQuiz";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";

const PATH = "/quiz/verbs";
const TITLE = "Japanese verb quiz";

export function generateMetadata() {
  return pageMetadata({
    title: `${TITLE}: ${getVerbs().length} N5 & N4 verbs, verb to English or English to verb`,
    description: `Ten quick questions on the meaning of Japanese verbs. Choose verb → English, English → verb or a mix, for N5, N4 or both. Answers and the polite form straight away, no account needed.`,
    path: PATH,
  });
}

export default function VerbQuizPage() {
  const cards: VerbCard[] = getVerbs().map((v) => ({
    id: v.id,
    word: v.word,
    reading: v.reading,
    romaji: v.romaji,
    meaning: v.meaning,
    level: v.level as VerbCard["level"],
    group: v.group,
    polite: v.forms.polite,
    noun: v.fromNoun,
  }));
  // A fixed first round, so the HTML holds real questions and does not change between builds.
  const initial = buildVerbQuestions(cards, "mix", seeded(20261030))
    .slice(0, QUIZ_LENGTH)
    .sort((a, b) => a.difficulty - b.difficulty);
  const nextUp = quizCombos()
    .filter((c) => (c.level === "n5" || c.level === "n4") && c.skill === "vocabulary")
    .map((c) => ({ href: quizPath(c.level, c.skill), label: comboTitle(c.level, c.skill) }));

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Quiz", path: "/quiz" },
            { name: TITLE, path: PATH },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Quiz",
            "@id": `${SITE_URL}${PATH}`,
            url: `${SITE_URL}${PATH}`,
            name: TITLE,
            educationalLevel: "JLPT N5–N4",
            numberOfQuestions: QUIZ_LENGTH,
            inLanguage: "en",
            about: { "@type": "Thing", name: "Japanese verbs" },
            isPartOf: { "@id": `${SITE_URL}/#website` },
          },
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Quiz", path: "/quiz" }, { name: TITLE }]} />

      <div className="max-w-content pb-10">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-h1">{TITLE}</h1>
          <Link href="/quiz" className="text-sm font-medium text-accent hover:underline">
            Other quizzes
          </Link>
        </div>
        <p className="mt-2 text-ink-2">
          {QUIZ_LENGTH} verbs at a time from {cards.length}. Choose which way round to be asked, then pick the right answer: you see at once whether it was right, with the verb&apos;s group and polite form.
        </p>

        <div className="mt-6">
          <VerbQuiz cards={cards} initial={initial} studyHref="/japanese/verbs" nextUp={nextUp} />
        </div>

        <p className="mt-8 text-sm text-muted">
          No account needed. Your best score for each setting is kept in this browser and never sent anywhere.{" "}
          <Link href="/japanese/verbs" className="text-accent hover:underline">
            See every verb with its forms <Arrow />
          </Link>
        </p>
      </div>
    </Container>
  );
}
