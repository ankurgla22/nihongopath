import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Button, Container, Kbd } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/japanese", label: "All levels" },
  { href: "/japanese/foundation", label: "Foundation (start here)" },
  { href: "/japanese/n5", label: "N5 course" },
  { href: "/japanese/n5/grammar", label: "N5 grammar" },
  { href: "/jlpt", label: "About the JLPT" },
  { href: "/jlpt/strategy", label: "Exam strategy" },
];

export default function NotFound() {
  return (
    <Container wide className="py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="relative grid place-items-center min-h-[16rem] sm:min-h-[20rem] animate-rise" aria-hidden>
          <div className="absolute inset-0 grid-bg" />
          <span lang="ja" className="ja relative text-[9rem] sm:text-[12rem] leading-none font-bold text-gradient select-none">
            迷
          </span>
          <span className="absolute bottom-2 text-xs uppercase tracking-[0.2em] text-muted">mayou · to get lost</span>
        </div>

        <div className="animate-rise-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">404</p>
          <h1 className="mt-3 text-h1">
            <span lang="ja" className="ja">
              見つかりません
            </span>
            <span className="block mt-1 text-ink-2 text-h2 font-medium">This page could not be found.</span>
          </h1>
          <p className="mt-4 text-muted leading-relaxed max-w-prose">The link may be out of date, or the lesson may have moved. Try searching for what you were looking for, or pick up from one of these pages.</p>

          <form action="/search" method="get" role="search" className="mt-6 flex flex-col sm:flex-row gap-2 max-w-md">
            <label htmlFor="nf-q" className="sr-only">
              Search
            </label>
            <div className="relative flex-1">
              <input id="nf-q" name="q" type="search" placeholder="Search grammar, words, kanji…" className="h-11 w-full rounded-full border border-line bg-surface px-4 pr-16 text-sm shadow-sm placeholder:text-muted/70 focus:border-accent transition" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex">
                <Kbd>Enter</Kbd>
              </span>
            </div>
            <Button type="submit">
              Search <Arrow />
            </Button>
          </form>

          <nav aria-label="Helpful links" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex items-center h-8 rounded-full border border-line bg-surface px-3 text-sm text-ink-2 hover:bg-surface-2 hover:border-line-strong transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </Container>
  );
}
