import Link from "next/link";
import { Arrow, Breadcrumbs, Container } from "@/components/ui";
import { LEVELS } from "@/lib/content/schemas";
import { LEVEL_INFO } from "@/components/content/levels";
import { breadcrumbJsonLd, courseListJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { FOUNDATION_TOTAL_LABEL } from "@/components/foundation/kinds";

export const metadata = pageMetadata({
  title: "Learn Japanese: Foundation, N5, N4, N3, N2 and N1 courses",
  description:
    "The full learning path from your first kana to JLPT N1: grammar, vocabulary, kanji, reading and listening for every level, with practice questions and tests.",
  path: "/japanese",
});

const SKILLS = [
  { key: "grammar", name: "Grammar" },
  { key: "vocabulary", name: "Vocabulary" },
  { key: "kanji", name: "Kanji" },
  { key: "reading", name: "Reading" },
  { key: "listening", name: "Listening" },
] as const;

export default function JapaneseIndexPage() {
  return (
    <Container>
      <JsonLd data={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Japanese", path: "/japanese" }]), courseListJsonLd(["foundation", ...LEVELS])]} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Japanese" }]} />

      <header className="pt-10 pb-8 animate-rise">
        <h1 className="text-h1">
          From zero to <span className="text-gradient">N1</span>, in order.
        </h1>
        <p className="mt-4 text-lg text-ink-2 leading-relaxed max-w-prose">Work through the levels in order, or jump to the one you are preparing for.</p>
      </header>

      <ol className="divide-y divide-line">
        <li className="py-6">
          <h2 className="text-h2">
            <Link href="/japanese/foundation" className="group inline-flex items-center gap-2 hover:text-accent transition">
              <span lang="ja" className="ja text-accent">
                かな
              </span>
              Foundation
              <Arrow className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </h2>
          <p className="mt-1.5 text-muted">{FOUNDATION_TOTAL_LABEL}. Do this first if you cannot yet read kana.</p>
        </li>
        {LEVELS.map((level) => {
          const info = LEVEL_INFO[level];
          return (
            <li key={level} className="py-6">
              <h2 className="text-h2">
                <Link href={`/japanese/${level}`} className="group inline-flex items-center gap-2 hover:text-accent transition">
                  {info.label} <span className="font-normal text-ink-2">{info.name}</span>
                  <Arrow className="text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </h2>
              <p className="mt-1.5 text-muted">{info.tagline}</p>
              <nav aria-label={`${info.label} sections`} className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {SKILLS.map((sk) => (
                  <Link key={sk.key} href={`/japanese/${level}/${sk.key}`} className="text-ink-2 hover:text-accent transition">
                    {sk.name}
                  </Link>
                ))}
              </nav>
            </li>
          );
        })}
      </ol>
    </Container>
  );
}
