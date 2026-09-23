import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout, Container, JaText, Section, SpeakButton, Speakable } from "@/components/ui";
import { findGrammar, getGrammar, getQuestionMap, resolveContentId } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { decodeSlug, isLevel } from "@/components/content/levels";
import { articleJsonLd, asSentence, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { pairFor, pairPath } from "@/lib/content/compare";
import { FaqSection } from "@/components/content/FaqSection";
import { faqJsonLd, type Faq } from "@/lib/seo/faq";
import { JsonLd } from "@/components/content/JsonLd";
import { LessonNavBottom, LessonNavTop } from "@/components/content/LessonNav";
import { Diagram } from "@/components/diagrams";
import { LessonQuiz } from "@/components/quiz/LessonQuiz";
import { SaveButton } from "@/components/content/SaveButton";
import { MarkComplete } from "@/components/content/MarkComplete";
import { UpdatedOn } from "@/components/content/UpdatedOn";

type Params = { level: string; slug: string };

export function generateStaticParams() {
  return LEVELS.flatMap((level) => getGrammar(level).map((g) => ({ level, slug: g.slug })));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const g = findGrammar(params.level, decodeSlug(params.slug));
  if (!g) return {};
  const label = LEVEL_LABEL[params.level];
  return pageMetadata({
    title: `${g.title} (${g.romaji}) — JLPT ${label} grammar: meaning, formation, examples`,
    // g.meaning usually carries its own quotation marks, so it is never wrapped in quotes here.
    description: `${g.title} (${g.romaji}) — ${asSentence(g.meaning)} Formation, natural examples, common mistakes and JLPT ${label} tips.`,
    path: `/japanese/${params.level}/grammar/${g.slug}`,
  });
}

/** Formation pattern; the chip itself plays on tap. */
function FormationChip({ children }: { children: string }) {
  return (
    <Speakable as="code" text={children} className="inline-flex items-center rounded-xl border border-line bg-surface shadow-sm px-3.5 py-2 text-base sm:text-lg font-medium not-italic text-ink" />
  );
}

function ExampleRow({ ja, reading, en, note, n }: { ja: string; reading?: string; en: string; note?: string; n: number }) {
  return (
    <li className="group relative grid grid-cols-[1.75rem_1fr] gap-x-3 py-4 first:pt-0 last:pb-0 border-b border-line last:border-0">
      <span className="text-[11px] font-semibold tabular-nums text-muted pt-2.5 group-hover:text-accent transition" aria-hidden>
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <JaText ja={ja} reading={reading} en={en} size="xl" note={note} />
      </div>
    </li>
  );
}

/** Normalise for "is this note already said above?" comparisons. */
function norm(s: string) {
  return s.toLowerCase().replace(/[\s\p{P}]/gu, "");
}

export default function GrammarLessonPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const lessons = getGrammar(level);
  const idx = lessons.findIndex((g) => g.slug === decodeSlug(params.slug));
  if (idx < 0) notFound();
  const g = lessons[idx];
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const label = LEVEL_LABEL[level];
  const base = `/japanese/${level}/grammar`;
  const href = `${base}/${g.slug}`;

  const qmap = getQuestionMap();
  const practice = g.practiceQuestionIds.map((id) => qmap.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));
  const jlpt = g.jlptQuestionIds.map((id) => qmap.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));
  const quickCheck = [...practice, ...jlpt];

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${level}` },
    { name: "Grammar", path: base },
    { name: g.title },
  ];

  const hasExplanation = Boolean(g.simpleExplanation && g.simpleExplanation !== g.meaning);
  // "Usage notes" is gone as a section. Any note not already covered by the explanation
  // becomes one line under Common mistakes (or JLPT tips); otherwise it is dropped.
  const covered = norm(`${g.meaning} ${g.simpleExplanation ?? ""} ${g.whenUsed ?? ""}`);
  const extraNote = g.usageNotes
    .filter((n) => !covered.includes(norm(n)))
    .join(" ")
    .trim();
  const noteInMistakes = Boolean(extraNote) && g.commonMistakes.length > 0;
  const noteInTips = Boolean(extraNote) && !noteInMistakes && g.jlptTips.length > 0;

  // FAQ built only from this lesson's own fields, in the words learners search with. The same
  // strings feed the FAQPage schema so the visible answers and the markup cannot differ.
  const mistake = g.commonMistakes[0];
  const faq: Faq[] = [
    { q: `What does ${g.title} mean?`, a: `${asSentence(g.meaning)}${hasExplanation ? ` ${asSentence(g.simpleExplanation)}` : ""}` },
    ...(g.formation.length ? [{ q: `How do you form ${g.title}?`, a: `${g.formation.join(" / ")}. V = verb, N = noun, A = adjective.` }] : []),
    ...(g.whenUsed ? [{ q: `When is ${g.title} used?`, a: asSentence(g.whenUsed) }] : []),
    ...g.similarGrammar.slice(0, 2).map((s) => ({ q: `What is the difference between ${g.title} and ${s.pattern}?`, a: asSentence(s.difference) })),
    ...(mistake ? [{ q: `What is a common mistake with ${g.title}?`, a: `Wrong: ${mistake.wrong} Right: ${mistake.right} ${asSentence(mistake.why)}` }] : []),
  ];

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([...crumbs.slice(0, 4).map((c) => ({ name: c.name, path: c.path! })), { name: g.title, path: href }]),
          articleJsonLd({ level, headline: `${g.title} — JLPT ${label} grammar`, description: g.meaning, path: href }),
          faqJsonLd(href, faq),
        ]}
      />

      <LessonNavTop
        crumbs={crumbs}
        index={idx + 1}
        total={lessons.length}
        actions={
          <>
            <SaveButton contentId={g.id} type="grammar" title={g.title} href={href} />
            <MarkComplete contentId={g.id} type="grammar" level={level} href={href} />
          </>
        }
      />

      <article className="pb-8 min-w-0">
        <header className="mt-8 animate-rise">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 lang="ja" className="ja text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1] text-ink break-words">
              {g.title}
            </h1>
            <SpeakButton text={g.title} size="md" label />
          </div>
          <p className="mt-2 text-lg text-muted">{g.romaji}</p>
          <UpdatedOn className="mt-4" />
        </header>

        <Section id="meaning" title="Meaning">
          <p className="text-xl sm:text-2xl leading-relaxed text-ink font-medium tracking-tight">{g.meaning}</p>
          {hasExplanation && <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-ink-2">{g.simpleExplanation}</p>}
          {g.whenUsed && <p className="mt-3 leading-relaxed whitespace-pre-line text-ink-2">{g.whenUsed}</p>}
        </Section>

        {g.formation.length > 0 && (
          <Section id="formation" title="Formation" intro="V = verb, N = noun, A = adjective.">
            <ul className="flex flex-wrap gap-2">
              {g.formation.map((f, i) => (
                <li key={i}>
                  <FormationChip>{f}</FormationChip>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {g.diagram && (
          <Section id="diagram" title="Visual diagram">
            <Diagram data={g.diagram} />
          </Section>
        )}

        <Section id="examples" title="Natural examples">
          <ol className="surface rounded-2xl p-5 sm:p-6">
            {g.examples.map((ex, i) => (
              <ExampleRow key={i} n={i + 1} ja={ex.ja} reading={ex.reading} en={ex.en} note={ex.note} />
            ))}
          </ol>
        </Section>

        {g.similarGrammar.length > 0 && (
          <Section id="similar" title="Similar grammar and the difference">
            <ul className="grid gap-3">
              {g.similarGrammar.map((s, i) => {
                const target = s.id ? resolveContentId(s.id) : null;
                const pair = s.id ? pairFor(g, s.id) : undefined;
                return (
                  <li key={i} className="surface rounded-2xl p-4 sm:p-5 grid gap-x-5 gap-y-1.5 sm:grid-cols-[minmax(8rem,12rem)_1fr]">
                    <p lang="ja" className="ja text-xl font-semibold tracking-tight">
                      {target ? (
                        <Link href={target.href} className="hover:text-accent transition inline-flex items-center gap-1.5">
                          {s.pattern}
                          <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <path d="M7 17 17 7M9 7h8v8" />
                          </svg>
                        </Link>
                      ) : (
                        <span>{s.pattern}</span>
                      )}
                    </p>
                    <p className="text-sm sm:text-[15px] leading-relaxed text-ink-2">
                      {s.difference}
                      {pair && (
                        <>
                          {" "}
                          <Link href={pairPath(pair)} className="whitespace-nowrap font-medium text-accent hover:underline">
                            Compare side by side
                          </Link>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {g.commonMistakes.length > 0 && (
          <Section id="mistakes" title="Common mistakes">
            <ul className="space-y-4">
              {g.commonMistakes.map((m, i) => (
                <li key={i} className="surface rounded-2xl overflow-hidden">
                  <dl>
                    <div className="grid grid-cols-[2.25rem_1fr] items-start bg-accent-soft/60 px-4 py-3 border-b border-accent/15">
                      <dt className="h-6 w-6 rounded-full bg-accent text-white grid place-items-center text-xs font-bold" aria-label="Wrong">
                        ✗
                      </dt>
                      {/* The wrong sentence is never voiced. */}
                      <dd lang="ja" className="ja text-lg sm:text-xl text-accent-ink line-through decoration-accent/50 decoration-2 leading-relaxed">
                        {m.wrong}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[2.25rem_1fr] items-start bg-ok-soft/60 px-4 py-3 border-b border-line">
                      <dt className="h-6 w-6 rounded-full bg-ok text-white grid place-items-center text-xs font-bold" aria-label="Right">
                        ✓
                      </dt>
                      <dd>
                        <Speakable text={m.right} className="text-lg sm:text-xl text-ink font-medium leading-relaxed" />
                      </dd>
                    </div>
                    <div className="grid grid-cols-[2.25rem_1fr] items-start px-4 py-3">
                      <dt className="text-[10px] uppercase tracking-wider text-muted pt-1">Why</dt>
                      <dd className="text-sm leading-relaxed text-ink-2">{m.why}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            {noteInMistakes && <p className="mt-4 text-sm leading-relaxed text-ink-2">{extraNote}</p>}
          </Section>
        )}

        {g.jlptTips.length > 0 && (
          <Section id="jlpt" title={`JLPT ${label} tips`}>
            <Callout
              tone="accent"
              title="On the exam"
              icon={
                <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.5h6c0-1.2.3-1.9 1-2.5A6 6 0 0 0 12 3z" />
                </svg>
              }
            >
              <ul className="space-y-2 list-disc pl-5">
                {g.jlptTips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
                {noteInTips && <li>{extraNote}</li>}
              </ul>
            </Callout>
          </Section>
        )}

        <FaqSection items={faq} />

        {quickCheck.length > 0 && (
          <Section id="test" title="Quick check">
            <LessonQuiz questions={quickCheck} title="Quick check" />
          </Section>
        )}

        <LessonNavBottom
          prev={prev ? { href: `${base}/${prev.slug}`, title: prev.title, subtitle: prev.meaning } : undefined}
          next={next ? { href: `${base}/${next.slug}`, title: next.title, subtitle: next.meaning } : undefined}
          indexHref={base}
          indexLabel={`${label} grammar`}
        />
      </article>
      <div className="h-12" />
    </Container>
  );
}
