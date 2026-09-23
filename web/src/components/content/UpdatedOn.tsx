import { LAST_MODIFIED } from "@/lib/seo/site";

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
 * Visible last-updated date for lesson pages.
 *
 * Search engines and AI assistants both weight freshness, and they discount a date that
 * appears only in JSON-LD. This renders the same instant that `dateModified` carries in
 * the page's schema, so the two signals agree.
 */
export function UpdatedOn({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted ${className}`}>
      Updated{" "}
      <time dateTime={LAST_MODIFIED}>{formatUtc(LAST_MODIFIED)}</time>
    </p>
  );
}
