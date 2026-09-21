import Link from "next/link";
import { Arrow, Breadcrumbs, Button, Container } from "@/components/ui";
import { getFoundation } from "@/lib/content";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";

export const metadata = pageMetadata({
  title: "Foundation: hiragana, katakana, pronunciation, numbers and greetings (start here)",
  description:
    "Eight beginner lessons to do before JLPT N5: the hiragana and katakana charts with sound, mora timing and pitch, numbers and counters, dates and time, and 40 essential greetings.",
  path: "/japanese/foundation",
});

export default function FoundationIndexPage() {
  const lessons = getFoundation();
  const minutes = lessons.reduce((n, l) => n + l.minutes, 0);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: "Foundation", path: "/japanese/foundation" },
  ];

  return (
    <Container>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />

      <header className="pt-10 pb-8 animate-rise">
        <h1 className="text-h1">
          First the <span lang="ja" className="ja text-gradient">かな</span>, then everything else.
        </h1>
        <p className="mt-4 text-lg text-ink-2 leading-relaxed max-w-prose">
          {lessons.length} lessons, about {Math.round(minutes / 60)} hours in total, then you are ready for N5.
        </p>
        {lessons[0] && (
          <div className="mt-6">
            <Button href={`/japanese/foundation/${lessons[0].slug}`}>
              Start lesson 1 <Arrow />
            </Button>
          </div>
        )}
      </header>

      <ol className="divide-y divide-line">
        {lessons.map((l, i) => (
          <li key={l.id}>
            <Link href={`/japanese/foundation/${l.slug}`} className="group flex items-center gap-4 py-3.5 hover:text-accent transition">
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 font-medium">{l.title}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted">{l.minutes} min</span>
              <Arrow className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-8 mb-16 text-sm text-muted">
        After lesson {lessons.length},{" "}
        <Link href="/japanese/n5" className="font-medium text-accent hover:underline">
          continue to N5
        </Link>
        .
      </p>
    </Container>
  );
}
