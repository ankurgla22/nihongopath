import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Callout, Container, JaText, Section, SpeakButton } from "@/components/ui";
import { findGrammar, getGrammar, getQuestionMap, resolveContentId } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { decodeSlug, isLevel } from "@/components/content/levels";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { LessonNavBottom, LessonNavTop } from "@/components/content/LessonNav";
import { Diagram } from "@/components/diagrams";
import { LessonQuiz } from "@/components/quiz/LessonQuiz";
import { SaveButton } from "@/components/content/SaveButton";
import { MarkComplete } from "@/components/content/MarkComplete";

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
    description: `${g.title} means "${g.meaning}". Learn how it is formed, when Japanese people use it, natural example sentences, common mistakes and JLPT ${label} tips.`,
    path: `/japanese/${params.level}/grammar/${g.slug}`,
  });
}

function FormationChip({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <code lang="ja" className="ja inline-flex items-center rounded-xl border border-line bg-surface shadow-sm px-3.5 py-2 text-base sm:text-lg font-medium not-italic text-ink">
        {children}
      </code>
      <SpeakButton text={children} size="xs" />
    </span>
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

function Outline({ items }: { items: { id: string; label: string }[] }) {
  return (
    <>
      {/* Desktop: sticky rail */}
      <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">On this page</p>
        <ol className="border-l border-line space-y-0.5">
          {items.map((it) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="block -ml-px border-l-2 border-transparent pl-3.5 py-1 text-sm text-muted hover:text-ink hover:border-accent transition">
                {it.label}
              </a>
            </li>
          ))}
        </ol>
      </aside>
      {/* Mobile: horizontal chips */}
      <nav aria-label="On this page" className="lg:hidden -mx-4 px-4 sm:-mx-6 sm:px-6 mt-5 overflow-x-auto no-scrollbar">
        <ol className="flex gap-1.5 w-max pb-1">
          {items.map((it) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="inline-flex items-center h-7 px-3 rounded-full border border-line bg-surface text-xs text-ink-2 whitespace-nowrap hover:border-accent/50 hover:text-accent transition">
                {it.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
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

  const crumbs = [
    { name: "Home", path: "/" },
    { name: label, path: `/japanese/${level}` },
    { name: "Grammar", path: base },
    { name: g.title },
  ];

  const hasExplanation = Boolean(g.simpleExplanation && g.simpleExplanation !== g.meaning);
  const outline = [
    { id: "meaning", label: "Meaning" },
    hasExplanation && { id: "explanation", label: "Simple explanation" },
    g.whenUsed && { id: "when", label: "When it's used" },
    g.formation.length > 0 && { id: "formation", label: "Formation" },
    g.diagram && { id: "diagram", label: "Diagram" },
    { id: "examples", label: "Examples" },
    g.similarGrammar.length > 0 && { id: "similar", label: "Similar grammar" },
    g.commonMistakes.length > 0 && { id: "mistakes", label: "Common mistakes" },
    g.usageNotes.length > 0 && { id: "usage", label: "Usage notes" },
    g.jlptTips.length > 0 && { id: "jlpt", label: `JLPT ${label} tips` },
    (practice.length > 0 || jlpt.length > 0) && { id: "test", label: "Test yourself" },
    { id: "review", label: "Review" },
  ].filter((x): x is { id: string; label: string } => Boolean(x));

  return (
    <Container wide>
      <JsonLd
        data={[
          breadcrumbJsonLd([...crumbs.slice(0, 3).map((c) => ({ name: c.name, path: c.path! })), { name: g.title, path: href }]),
          articleJsonLd({ headline: `${g.title} — JLPT ${label} grammar`, description: g.meaning, path: href }),
        ]}
      />

      <LessonNavTop
        crumbs={crumbs}
        index={idx + 1}
        total={lessons.length}
        badges={
          <>
            <Badge tone="accent">JLPT {label}</Badge>
            {g.enriched ? <Badge tone="ok">Full lesson</Badge> : <Badge>Core entry</Badge>}
          </>
        }
        actions={
          <>
            <SaveButton contentId={g.id} type="grammar" title={g.title} href={href} />
            <MarkComplete contentId={g.id} type="grammar" level={level} href={href} />
          </>
        }
      />

      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div className="order-2 lg:order-1 lg:pt-10">
          <Outline items={outline} />
        </div>

        <article className="order-1 lg:order-2 pb-8 min-w-0 max-w-content">
          <header className="mt-8 animate-rise">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Grammar · lesson {g.order}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 lang="ja" className="ja text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1] text-ink break-words">
                {g.title}
              </h1>
              <SpeakButton text={g.title} size="sm" />
            </div>
            <p className="mt-2 text-lg text-muted">{g.romaji}</p>
          </header>

          <Section id="meaning" title="Meaning">
            <p className="text-xl sm:text-2xl leading-relaxed text-ink font-medium tracking-tight">{g.meaning}</p>
          </Section>

          {hasExplanation && (
            <Section id="explanation" title="Simple explanation">
              <p className="text-lg leading-relaxed whitespace-pre-line text-ink-2">{g.simpleExplanation}</p>
            </Section>
          )}

          {g.whenUsed && (
            <Section id="when" title="When it's used">
              <p className="leading-relaxed whitespace-pre-line text-ink-2">{g.whenUsed}</p>
            </Section>
          )}

          {g.formation.length > 0 && (
            <Section id="formation" title="Formation" intro="How to attach it. V = verb, N = noun, A = adjective.">
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
                  return (
                    <li key={i} className="surface rounded-2xl p-4 sm:p-5 grid gap-x-5 gap-y-1.5 sm:grid-cols-[minmax(8rem,12rem)_1fr]">
                      <p lang="ja" className="ja text-xl font-semibold tracking-tight flex flex-wrap items-center gap-2">
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
                        <SpeakButton text={s.pattern} size="xs" />
                      </p>
                      <p className="text-sm sm:text-[15px] leading-relaxed text-ink-2">{s.difference}</p>
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
                        <dd className="flex items-start gap-2">
                          <span lang="ja" className="ja flex-1 min-w-0 text-lg sm:text-xl text-accent-ink line-through decoration-accent/50 decoration-2 leading-relaxed">
                            {m.wrong}
                          </span>
                          <SpeakButton text={m.wrong} size="xs" className="mt-1" />
                        </dd>
                      </div>
                      <div className="grid grid-cols-[2.25rem_1fr] items-start bg-ok-soft/60 px-4 py-3 border-b border-line">
                        <dt className="h-6 w-6 rounded-full bg-ok text-white grid place-items-center text-xs font-bold" aria-label="Right">
                          ✓
                        </dt>
                        <dd className="flex items-start gap-2">
                          <span lang="ja" className="ja flex-1 min-w-0 text-lg sm:text-xl text-ink font-medium leading-relaxed">
                            {m.right}
                          </span>
                          <SpeakButton text={m.right} size="xs" className="mt-1" />
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
            </Section>
          )}

          {g.usageNotes.length > 0 && (
            <Section id="usage" title="Usage notes">
              <ul className="space-y-2.5">
                {g.usageNotes.map((n, i) => (
                  <li key={i} className="flex gap-3 leading-relaxed text-ink-2">
                    <span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-hidden />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
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
                </ul>
              </Callout>
            </Section>
          )}

          {(practice.length > 0 || jlpt.length > 0) && (
            <Section id="test" title="Test yourself" intro="Answer each question, then read why the other options are wrong.">
              <div className="space-y-8">
                {practice.length > 0 && (
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">Practice questions</h3>
                    <LessonQuiz questions={practice} title="Practice" />
                  </div>
                )}
                {jlpt.length > 0 && (
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">JLPT-style questions</h3>
                    <LessonQuiz questions={jlpt} title="JLPT-style" />
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section id="review" title="Review recommendation">
            <Callout
              tone="info"
              title={`Come back in ${g.reviewAfterDays} ${g.reviewAfterDays === 1 ? "day" : "days"}`}
              icon={
                <svg className="h-5 w-5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              }
            >
              <p>
                Revisit <span lang="ja" className="ja font-medium text-ink">{g.title}</span> in about {g.reviewAfterDays} {g.reviewAfterDays === 1 ? "day" : "days"}. Try to write one sentence of your own with it
                before you re-read the lesson. Signed-in learners get it added to their review queue automatically.
              </p>
            </Callout>
          </Section>

          <LessonNavBottom
            prev={prev ? { href: `${base}/${prev.slug}`, title: prev.title, subtitle: prev.meaning } : undefined}
            next={next ? { href: `${base}/${next.slug}`, title: next.title, subtitle: next.meaning } : undefined}
            indexHref={base}
            indexLabel={`${label} grammar`}
          />
        </article>
      </div>
      <div className="h-12" />
    </Container>
  );
}
