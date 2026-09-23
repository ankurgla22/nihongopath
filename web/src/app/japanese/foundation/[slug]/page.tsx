import { notFound } from "next/navigation";
import { Container, Section } from "@/components/ui";
import { findFoundation, getFoundation, getQuestionMap } from "@/lib/content";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { LessonNavBottom, LessonNavTop } from "@/components/content/LessonNav";
import { SaveButton } from "@/components/content/SaveButton";
import { MarkComplete } from "@/components/content/MarkComplete";
import { LessonQuiz } from "@/components/quiz/LessonQuiz";
import { FoundationBlocks } from "@/components/foundation/FoundationBlocks";
import { PartBar } from "@/components/foundation/PartBar";
import { UpdatedOn } from "@/components/content/UpdatedOn";
import { contentLastMod } from "@/lib/content/lastmod";

type Params = { slug: string };
const BASE = "/japanese/foundation";

export function generateStaticParams() {
  return getFoundation().map((l) => ({ slug: l.slug }));
}

export function generateMetadata({ params }: { params: Params }) {
  const l = findFoundation(params.slug);
  if (!l) return {};
  return pageMetadata({
    title: `${l.title} — Japanese foundation lesson ${l.order} of 8`,
    description: l.summary,
    path: `${BASE}/${l.slug}`,
  });
}

export default function FoundationLessonPage({ params }: { params: Params }) {
  const lessons = getFoundation();
  const idx = lessons.findIndex((l) => l.slug === params.slug);
  if (idx < 0) notFound();
  const lesson = lessons[idx];
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const href = `${BASE}/${lesson.slug}`;

  const qmap = getQuestionMap();
  const practice = lesson.practiceQuestionIds.map((id) => qmap.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: "Foundation", path: BASE },
    { name: lesson.title },
  ];

  const updated = contentLastMod(lesson.id);
  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([...crumbs.slice(0, 3).map((c) => ({ name: c.name, path: c.path! })), { name: lesson.title, path: href }]),
          articleJsonLd({ dateModified: updated,  level: "foundation", headline: lesson.title, description: lesson.summary, path: href }),
        ]}
      />
      <LessonNavTop
        crumbs={crumbs}
        index={idx + 1}
        total={lessons.length}
        unit="Lesson"
        actions={
          <>
            <SaveButton contentId={lesson.id} type="kana" title={lesson.title} href={href} />
            <MarkComplete contentId={lesson.id} type="kana" level="foundation" href={href} />
          </>
        }
      />

      <article className="pb-8">
        <header className="mt-8 animate-rise">
          <h1 className="text-h1">{lesson.title}</h1>
          <p className="mt-4 text-lg text-muted leading-relaxed max-w-prose">{lesson.summary}</p>
          <UpdatedOn className="mt-4" date={updated} />
        </header>

        <PartBar parts={lesson.sections.map((s, i) => ({ id: `s${i + 1}`, label: s.heading }))} quickCheckId={practice.length > 0 ? "practice" : undefined} />

        {lesson.sections.map((s, i) => (
          <Section key={i} id={`s${i + 1}`} title={s.heading}>
            <FoundationBlocks blocks={s.blocks} />
          </Section>
        ))}

        {practice.length > 0 && (
          <Section id="practice" title="Quick check">
            <LessonQuiz questions={practice} title="Quick check" />
          </Section>
        )}
      </article>

      <LessonNavBottom
        prev={prev ? { href: `${BASE}/${prev.slug}`, title: prev.title, subtitle: `Lesson ${prev.order}` } : undefined}
        next={next ? { href: `${BASE}/${next.slug}`, title: next.title, subtitle: `Lesson ${next.order}` } : { href: "/japanese/n5", title: "Continue to N5", subtitle: "You have finished the Foundation" }}
        indexHref={BASE}
        indexLabel="Foundation lessons"
      />
      <div className="h-12" />
    </Container>
  );
}
