import { Section } from "@/components/ui";
import type { Faq } from "@/lib/seo/faq";

/**
 * Visible FAQ block. Each question is a real heading with its answer directly under it, so a
 * search engine or assistant can lift the pair out of the page; the matching FAQPage JSON-LD
 * is emitted by the page from the same array, so the two can never disagree.
 */
export function FaqSection({ items, intro }: { items: Faq[]; intro?: string }) {
  return (
    <Section id="faq" title="Frequently asked questions" intro={intro}>
      <div className="surface rounded-2xl divide-y divide-line">
        {items.map((it) => (
          <div key={it.q} className="p-5">
            <h3 className="font-semibold text-ink">{it.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{it.a}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
