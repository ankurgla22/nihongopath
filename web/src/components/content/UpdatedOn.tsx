import Link from "next/link";
import { LAST_MODIFIED, SITE_NAME } from "@/lib/seo/site";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Formatted in UTC from explicit parts rather than toLocaleDateString, so the server
 * and the browser always render the same string (no hydration mismatch, no locale drift).
 */
function formatUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Byline and visible last-updated date for lesson pages.
 *
 * The byline names the publishing organisation (the schema `author`) and links to the About
 * page that explains who that is and how content is made. The date is the same instant that
 * `dateModified` carries in the page's schema, so the two signals agree. Search engines and
 * AI assistants discount a date or author that appears only in JSON-LD.
 */
export function UpdatedOn({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted ${className}`}>
      By{" "}
      <Link href="/about" className="text-ink-2 hover:text-accent transition">
        {SITE_NAME}
      </Link>
      <span aria-hidden> · </span>
      Updated <time dateTime={LAST_MODIFIED}>{formatUtc(LAST_MODIFIED)}</time>
    </p>
  );
}
