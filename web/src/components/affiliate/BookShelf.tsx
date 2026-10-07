import { getBooks } from "@/lib/content";
import type { Level } from "@/lib/content/schemas";
import { affiliateEnabled } from "@/lib/affiliate/stores";
import { Section } from "@/components/ui";
import { StoreLink } from "./StoreLink";

/**
 * Recommended textbooks for a level, or a named set. Deliberately few: one or two books a
 * learner at this level would actually be told to buy, each with one honest line on who it is
 * for. That is what makes a recommendation worth following — and what Amazon's "qualifying
 * purchase" rule asks for — as opposed to a shelf of links.
 *
 * No prices and no cover images: both need Amazon's product API, which needs sales to keep, and
 * a stale price is worse than none. Text cards never go out of date.
 */
export function BookShelf({ level, ids, title = "Books that go with this level", intro }: { level?: Level; ids?: string[]; title?: string; intro?: string }) {
  const all = getBooks();
  const books = ids ? ids.map((id) => all.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => Boolean(b)) : all.filter((b) => level && b.levels.includes(level));
  if (!books.length) return null;
  const enabled = affiliateEnabled();
  return (
    <Section
      id="books"
      title={title}
      intro={intro ?? "The course here is complete on its own. These are the textbooks learners at this level most often study alongside it, in case you want one on paper."}
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {books.map((b) => (
          <li key={b.id} className="surface rounded-2xl p-5 flex flex-col">
            <h3 className="font-semibold leading-snug">{b.title}</h3>
            <p className="mt-1 text-sm text-muted">{b.author}</p>
            <p className="mt-3 text-sm text-ink-2 leading-relaxed flex-1">{b.forWhom}</p>
            <StoreLink bookId={b.id} stores={b.stores} title={b.title} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted leading-relaxed">
        {enabled
          ? "Affiliate links: as an Amazon Associate, Nihongo Path earns from qualifying purchases. The price you pay is the same, and nothing here is chosen for the commission."
          : "Links go to Amazon searches for the exact edition. Nihongo Path is not paid for these recommendations."}
      </p>
    </Section>
  );
}
