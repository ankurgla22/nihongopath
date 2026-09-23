import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, Breadcrumbs, Button, Container } from "@/components/ui";
import { getGrammar, getKanji, getListening, getReading, getVocabulary } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { LEVEL_INFO, isLevel } from "@/components/content/levels";
import { breadcrumbJsonLd, courseJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { FaqSection } from "@/components/content/FaqSection";
import { faqJsonLd, levelFaq } from "@/lib/seo/faq";

type Params = { level: string };

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const info = LEVEL_INFO[params.level];
  return pageMetadata({
    title: `JLPT ${info.label} course: grammar, vocabulary, kanji, reading and listening`,
    description: `${info.tagline} ${info.description}`,
    path: `/japanese/${params.level}`,
  });
}

export default function LevelHubPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const info = LEVEL_INFO[level];
  const label = LEVEL_LABEL[level];
  const base = `/japanese/${level}`;

  const grammar = getGrammar(level);
  const vocab = getVocabulary(level);
  const kanji = getKanji(level);
  const reading = getReading(level);
  const listening = getListening(level);

  const sections = [
    { key: "grammar", href: `${base}/grammar`, name: "Grammar", ja: "文法", count: grammar.length, unit: "patterns", text: "Meaning, formation, diagrams, examples, mistakes and JLPT tips." },
    { key: "vocabulary", href: `${base}/vocabulary`, name: "Vocabulary", ja: "語彙", count: vocab.length, unit: "words", text: "Words in context with readings, examples and collocations." },
    { key: "kanji", href: `${base}/kanji`, name: "Kanji", ja: "漢字", count: kanji.length, unit: "characters", text: "Readings, common words, look-alikes and memory aids, grouped by day." },
    { key: "reading", href: `${base}/reading`, name: "Reading", ja: "読解", count: reading.length, unit: "passages", text: "Short, medium and long passages with strategy notes and questions." },
    { key: "listening", href: `${base}/listening`, name: "Listening", ja: "聴解", count: listening.length, unit: "exercises", text: "Scripted conversations with audio and comprehension questions." },
    { key: "tests", href: `${base}/tests`, name: "Tests", ja: "テスト", count: null, unit: "", text: "Weekly and phase tests built from the question bank." },
    { key: "mock-exams", href: `${base}/mock-exams`, name: "Mock exams", ja: "模擬試験", count: null, unit: "", text: "Timed, full-length exams with the real section structure." },
  ];

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: base },
  ];
  const faq = levelFaq(level, { grammar: grammar.length, vocabulary: vocab.length, kanji: kanji.length, reading: reading.length, listening: listening.length });

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          courseJsonLd({
            level,
            name: `JLPT ${label} course: ${info.name}`,
            description: `${info.tagline} ${info.description}`,
            parts: sections.map((s) => ({ name: `${label} ${s.name}`, path: s.href })),
          }),
          faqJsonLd(base, faq),
        ]}
      />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />

      <header className="pt-10 pb-8 animate-rise">
        <h1 className="text-h1">
          <span className="text-gradient">{label}</span> <span className="text-ink-2 font-semibold">{info.tagline}</span>
        </h1>
        {/* The description already ends with the one "what you'll be able to do" sentence. */}
        <p className="mt-4 text-lg text-ink-2 leading-relaxed max-w-prose">{info.description}</p>
        {grammar[0] && (
          <div className="mt-6">
            <Button href={`${base}/grammar/${grammar[0].slug}`}>
              Start from lesson #1 <Arrow />
            </Button>
          </div>
        )}
      </header>

      <ul className="divide-y divide-line">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="group flex items-center gap-4 py-4 hover:text-accent transition">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">
                  {s.name}
                  {s.count !== null && (
                    <span className="ml-2 text-sm font-normal text-muted tabular-nums">{s.count > 0 ? `${s.count.toLocaleString()} ${s.unit}` : "coming soon"}</span>
                  )}
                </span>
                <span className="block text-sm text-muted">{s.text}</span>
              </span>
              <Arrow className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <FaqSection items={faq} intro={`Official facts about the ${label} test and what this course covers. Figures come from the JLPT site; see the JLPT guide for sources.`} />
      <div className="h-12" />
    </Container>
  );
}
