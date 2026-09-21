import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Badge, Breadcrumbs, Container, PageTitle, Section, Stat } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "JLPT Guide: Levels, N2 Test Structure, Scoring and Dates",
  description:
    "Factual guide to the Japanese-Language Proficiency Test: the five levels N5–N1, the N2 test sections and time limits, scoring (180 points, pass mark 90), test dates in July and December, and what an N2 certificate means.",
  path: "/jlpt",
});

const LEVELS_INFO = [
  { level: "N5", summary: "Basic Japanese: hiragana, katakana, elementary kanji and simple everyday phrases.", href: "/japanese/n5" },
  { level: "N4", summary: "Basic conversations and simple passages on familiar daily topics, with around 300 kanji.", href: "/japanese/n4" },
  { level: "N3", summary: "Bridge level: everyday situations, newspaper headlines and conversations at near-natural speed.", href: "/japanese/n3" },
  { level: "N2", summary: "Japanese used in everyday situations and in a variety of circumstances: newspapers, magazines, clear commentary, natural-speed conversation and news.", href: "/japanese/n2" },
  { level: "N1", summary: "Japanese used in a broad range of circumstances: editorials, abstract writing, complex logic, fast conversation and lectures." },
];

export default function JlptPage() {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "JLPT" },
  ];
  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? "/jlpt" })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle
        title="The JLPT explained"
        description="What the Japanese-Language Proficiency Test measures, how the N2 test is structured and scored, when it is held, and what an N2 certificate is generally taken to mean."
      />

      <div className="mb-16">
        <div className="min-w-0 max-w-content">
          <Section id="levels" title="The five levels" intro="The JLPT has five levels. N5 is the easiest and N1 the most advanced. Each level tests language knowledge (vocabulary and grammar), reading, and listening; there is no speaking or writing section.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {LEVELS_INFO.map((l) => (
                <li key={l.level} className={`surface rounded-2xl p-5 flex flex-col ${l.href ? "surface-hover" : "opacity-80"}`}>
                  <p className="text-2xl font-bold tracking-tight">{l.level}</p>
                  <p className="text-sm text-muted mt-2 leading-relaxed flex-1">{l.summary}</p>
                  {l.href && (
                    <Link href={l.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                      Study {l.level} <Arrow className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="n2-structure" title="N2 test structure" intro="The N2 test is taken in two sittings on the same day. Every question is multiple choice, answered on a mark sheet.">
            <div className="overflow-x-auto surface rounded-2xl">
              <table className="w-full text-sm min-w-[36rem]">
                <thead className="text-left text-muted bg-surface-2">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-wider">
                      Test session
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-wider">
                      Content
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(even)]:bg-surface-2/50">
                  <tr className="border-t border-line">
                    <td className="px-4 py-4 align-top">
                      <span lang="ja" className="ja font-medium">
                        言語知識（文字・語彙・文法）・読解
                      </span>
                      <br />
                      <span className="text-muted">Language knowledge (vocabulary, grammar) and reading</span>
                    </td>
                    <td className="px-4 py-4 align-top leading-relaxed">
                      Kanji reading and writing, word formation, context, paraphrase, usage; grammatical form, sentence composition (並べ替え), text grammar; short, medium, integrated and long passages plus information retrieval.
                    </td>
                    <td className="px-4 py-4 align-top whitespace-nowrap">
                      <Badge tone="accent" size="md">
                        105 min
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="px-4 py-4 align-top">
                      <span lang="ja" className="ja font-medium">
                        聴解
                      </span>
                      <br />
                      <span className="text-muted">Listening</span>
                    </td>
                    <td className="px-4 py-4 align-top leading-relaxed">
                      Task-based comprehension (課題理解), point comprehension (ポイント理解), summary comprehension (概要理解), quick response (即時応答), integrated comprehension (統合理解). Audio is played once.
                    </td>
                    <td className="px-4 py-4 align-top whitespace-nowrap">
                      <Badge tone="accent" size="md">
                        50 min
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted mt-3">Total testing time is about 155 minutes, plus a break between the two sessions and time for instructions.</p>
          </Section>

          <Section id="scoring" title="Scoring and pass marks" intro="Results are reported as scaled scores, not raw counts, so the number of questions you answer correctly does not map one-to-one to points.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Total" value="180" hint="Three sections of 0–60 each" />
              <Stat label="Pass mark (N2)" value="90 / 180" hint="Required total scaled score" tone="accent" />
              <Stat label="Sectional minimum" value="19 / 60" hint="In each of the three sections" />
            </div>
            <ul className="mt-5 space-y-2 text-sm leading-relaxed text-ink-2">
              {[
                "The three scoring sections for N2 are: Language knowledge (vocabulary/grammar), Reading, and Listening. Each is scaled 0–60.",
                "You must reach both the overall pass mark (90) and the sectional minimum (19) in every section. A high total does not compensate for a section below 19.",
                "Results include a reference breakdown (A/B/C) for vocabulary and grammar to show relative strengths, but only the scaled scores decide the pass/fail result.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="dates" title="Test dates and registration" intro="The JLPT is held twice a year in most countries, though some test sites offer only one of the two sittings.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface rounded-2xl p-5">
                <p className="text-3xl font-semibold tracking-tight text-accent">July</p>
                <p className="font-medium mt-1">First Sunday of July</p>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">Registration windows generally open around March–April, depending on the country.</p>
              </div>
              <div className="surface rounded-2xl p-5">
                <p className="text-3xl font-semibold tracking-tight text-accent">December</p>
                <p className="font-medium mt-1">First Sunday of December</p>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">Registration windows generally open around August–September.</p>
              </div>
            </div>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              Registration is handled by a host institution in each country, and places at popular test sites can fill early. Results are typically released about two months after the test, online first and then by post.
            </p>
          </Section>

          <Section id="n2-certifies" title="What N2 certifies" intro="The official description of N2 is the ability to understand Japanese used in everyday situations, and in a variety of circumstances to a certain degree.">
            <div className="surface rounded-2xl divide-y divide-line">
              <div className="p-5">
                <p className="font-semibold">Reading</p>
                <p className="text-sm text-ink-2 mt-1 leading-relaxed">
                  Understanding clearly written material on a variety of topics, such as newspaper and magazine articles, commentaries and simple critiques; following the narrative and the writer&rsquo;s intent.
                </p>
              </div>
              <div className="p-5">
                <p className="font-semibold">Listening</p>
                <p className="text-sm text-ink-2 mt-1 leading-relaxed">
                  Following coherent conversations and news at near-natural speed in everyday situations and in a variety of settings, understanding the flow, content, relationships between speakers and the essential points.
                </p>
              </div>
              <div className="p-5">
                <p className="font-semibold">In practice</p>
                <p className="text-sm text-ink-2 mt-1 leading-relaxed">
                  N2 is a common requirement listed by Japanese employers and universities as evidence of business-level or study-level Japanese, and it is frequently referenced in visa points systems. Requirements vary by organisation, so check the specific one you are applying to.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted mt-3">The certificate does not expire, although some institutions ask for a result from within the last few years.</p>
          </Section>

          <Section id="strategy" title="Exam strategy">
            <p className="text-sm text-ink-2">
              Question-type-specific approaches to the test:{" "}
              <Link href="/jlpt/strategy" className="font-medium text-accent hover:underline">
                read the strategy guides <Arrow className="inline h-3.5 w-3.5" />
              </Link>
              .
            </p>
          </Section>

          <p className="mt-12 text-sm text-muted">Test formats, dates and fees can change; confirm with the official JLPT site or your local host institution before registering.</p>
        </div>
      </div>
    </Container>
  );
}
