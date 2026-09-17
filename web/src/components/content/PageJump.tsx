"use client";
/**
 * Compact "Jump to page" control for paginated index pages. A <select> that navigates on change;
 * the pager links next to it remain the no-JS / crawler path.
 */
import { useRouter } from "next/navigation";

type Props = {
  /** Index base path, e.g. /japanese/n2/vocabulary. Page n > 1 lives at `${base}/page/${n}`. */
  base: string;
  page: number;
  pages: number;
  /** Items per page and total item count, used to label each option with its item range. */
  size: number;
  total: number;
  id?: string;
};

export function PageJump({ base, page, pages, size, total, id = "page-jump" }: Props) {
  const router = useRouter();
  if (pages <= 1) return null;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-muted">
      Jump to
      <select
        id={id}
        value={page}
        onChange={(e) => {
          const n = Number(e.target.value);
          router.push(n <= 1 ? base : `${base}/page/${n}`);
        }}
        className="h-10 rounded-full border border-line bg-surface pl-3 pr-8 text-sm text-ink tabular-nums transition focus:border-accent focus:shadow-ring focus:outline-none"
      >
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {`Page ${n} · #${(n - 1) * size + 1}–${Math.min(total, n * size)}`}
          </option>
        ))}
      </select>
    </label>
  );
}
