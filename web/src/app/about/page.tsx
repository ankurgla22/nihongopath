import Link from "next/link";
import { Breadcrumbs, Container, PageTitle, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { UpdatedOn } from "@/components/content/UpdatedOn";
import { contentStats } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { LAST_MODIFIED, SITE_NAME, SITE_OPERATOR, SITE_URL } from "@/lib/seo/site";
import { JLPT_SOURCES, JLPT_SOURCES_CHECKED } from "@/lib/seo/sources";

export const metadata = pageMetadata({
  title: "About Nihongo Path: who builds it, how lessons are made, how facts are sourced",
  description:
    "Nihongo Path is a free Japanese course from kana to JLPT N1, built and run by Opusify IT Solutions. How the lessons are structured, where the exam facts come from and how content is kept current.",
  path: "/about",
});

const fmt = (n: number) => n.toLocaleString("en-US");

export default function AboutPage() {
  const stats = contentStats();
  const total = (key: "grammar" | "vocabulary" | "kanji" | "reading" | "listening") => stats.per.reduce((n, p) => n + p[key], 0);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ];

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "@id": `${SITE_URL}/about`,
            url: `${SITE_URL}/about`,
            name: `About ${SITE_NAME}`,
            inLanguage: "en",
            dateModified: LAST_MODIFIED,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            // The page is about the publishing organisation declared in the root layout.
            mainEntity: { "@id": `${SITE_URL}/#organization` },
            citation: JLPT_SOURCES.map((s) => ({ "@type": "WebPage", name: s.name, url: s.url })),
          },
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "About" }]} />
      <PageTitle
        title={`About ${SITE_NAME}`}
        description="What the site is, who builds it, how the lessons are put together, where the exam facts come from and how the content is kept current."
      />

      <div className="max-w-content">
        <Section id="what" title="What Nihongo Path is">
          <p className="leading-relaxed text-ink-2">
            {SITE_NAME} is a free, complete Japanese course organised by JLPT level. It starts with the kana and pronunciation (
            <Link href="/japanese/foundation" className="text-accent hover:underline">
              Foundation
            </Link>
            ) and runs through{" "}
            {LEVELS.map((l, i) => (
              <span key={l}>
                <Link href={`/japanese/${l}`} className="text-accent hover:underline">
                  {LEVEL_LABEL[l]}
                </Link>
                {i < LEVELS.length - 2 ? ", " : i === LEVELS.length - 2 ? " and " : ""}
              </span>
            ))}
            . Every lesson is a normal web page: its full text is in the HTML, no account is needed to read it, and nothing is paywalled.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            The published content currently covers {fmt(total("grammar"))} grammar lessons, {fmt(total("vocabulary"))} vocabulary entries, {fmt(total("kanji"))} kanji,{" "}
            {fmt(total("reading"))} reading passages and {fmt(total("listening"))} listening exercises, plus {fmt(stats.exams)} full-length mock exams and a question bank of{" "}
            {fmt(stats.questions)} items. Signing in adds a private study tracker: a day-by-day plan (180 days to N2, then 90 more to N1), spaced-repetition review, tests and mock-exam history. The plan is intensive, about two hours a day; it is a sequence to follow at your own pace, not a deadline.
          </p>
        </Section>

        <Section id="who" title="Who builds it">
          <p className="leading-relaxed text-ink-2">
            {SITE_NAME} is built, owned and operated by{" "}
            <a href={SITE_OPERATOR.url} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
              {SITE_OPERATOR.name}
            </a>{" "}
            as an in-house project. Lessons are published under the {SITE_NAME} name rather than individual bylines. The site carries no advertising.
          </p>
        </Section>

        <Section id="how" title="How the lessons are made">
          <p className="leading-relaxed text-ink-2">
            Every lesson of a given type follows the same structure, so the same information is always in the same place. A grammar lesson has: the meaning; how the
            pattern is formed; a diagram; natural example sentences with hiragana readings and English; similar patterns and how they differ; common mistakes shown as a
            wrong and a corrected sentence with the reason; JLPT tips; and a short quiz drawn from the question bank.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            Content is stored as structured data and checked against a schema every time the site is built. A lesson that is missing a required part fails the build and
            is not published. Mock exams follow the official section structure for their level.
          </p>
          <p className="mt-4 leading-relaxed text-ink-2">
            Listening exercises show their full transcript on the page. Where an exercise has no recorded audio, the browser&rsquo;s own speech engine reads the transcript
            aloud, so the audio quality depends on the device.
          </p>
        </Section>

        <Section
          id="sources"
          title="Where the exam facts come from"
          intro={`Facts about the JLPT itself (what each level certifies, section times, pass marks, sectional minimums, test months, certificate validity) are taken from the official JLPT site and were last checked against it on ${JLPT_SOURCES_CHECKED}.`}
        >
          <ul className="space-y-2 text-sm leading-relaxed">
            {JLPT_SOURCES.map((s) => (
              <li key={s.url} className="flex gap-3">
                <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>
                  <a href={s.url} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
                    {s.name}
                  </a>
                  <span className="text-muted"> — {s.covers}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            The JLPT does not publish vocabulary, kanji or grammar lists. Where the site gives a count of kanji or words for a level, it is a commonly cited estimate and
            is labelled as such. Our summary of the test is on the{" "}
            <Link href="/jlpt" className="text-accent hover:underline">
              JLPT guide
            </Link>
            ; confirm dates and fees with your local host institution before registering.
          </p>
        </Section>

        <Section id="freshness" title="How content is kept current">
          <p className="leading-relaxed text-ink-2">
            The whole site is rebuilt and republished whenever content changes. Every lesson shows the date of the publish it came from, the same date its structured data
            and the sitemap report, so a page&rsquo;s freshness can always be read off the page itself.
          </p>
        </Section>

        <Section id="contact" title="Corrections and contact">
          <p className="leading-relaxed text-ink-2">
            If you find a mistake in a lesson or an exam fact that has gone out of date, please tell us through the{" "}
            <a href={`${SITE_OPERATOR.url}contact`} rel="noopener" target="_blank" className="font-medium text-accent hover:underline">
              {SITE_OPERATOR.name} contact page
            </a>
            . Include the lesson URL and what you believe is wrong.
          </p>
          <UpdatedOn className="mt-8" />
        </Section>
      </div>
      <div className="h-12" />
    </Container>
  );
}
