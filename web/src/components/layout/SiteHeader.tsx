import Link from "next/link";
import { SITE_NAME } from "@/lib/seo/site";
import { HeaderUserMenu } from "@/components/auth/HeaderUserMenu";
import { ThemeToggle } from "./ThemeToggle";
import { CollapsingRow, NavLinks, type NavItem } from "./NavLinks";

/** Signed-out (marketing) navigation. */
export const NAV: NavItem[] = [
  { href: "/japanese", label: "Learn" },
  { href: "/japanese/foundation", label: "Start here" },
  // Public, no account, and usually someone's first page from a search — worth a top-level slot.
  { href: "/quiz", label: "Quiz" },
  { href: "/jlpt", label: "JLPT" },
  { href: "/jlpt/strategy", label: "Strategy" },
];

/** Signed-in navigation: the learner's daily loop first. */
export const NAV_SIGNED_IN: NavItem[] = [
  { href: "/daily-study", label: "Today" },
  { href: "/japanese", label: "Learn" },
  { href: "/review", label: "Review" },
  { href: "/quiz", label: "Quiz" },
  { href: "/tests", label: "Tests" },
  { href: "/progress", label: "Progress" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 glass border-b border-line/80">
      <div className="mx-auto max-w-wide px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-[17px] group">
          <span className="h-8 w-8 rounded-xl accent-gradient text-white grid place-items-center ja text-base shadow-sm group-hover:scale-105 transition">道</span>
          <span>{SITE_NAME}</span>
        </Link>
        <NavLinks items={NAV} signedInItems={NAV_SIGNED_IN} className="hidden md:flex" />
        <div className="ml-auto flex items-center gap-2.5">
          <Link href="/search" aria-label="Search" className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-line bg-surface hover:bg-surface-2 transition text-ink-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <ThemeToggle />
          <HeaderUserMenu />
        </div>
      </div>
      <CollapsingRow className="md:hidden border-t border-line/70">
        <NavLinks items={NAV} signedInItems={NAV_SIGNED_IN} className="flex px-2 overflow-x-auto no-scrollbar" mobile />
      </CollapsingRow>
    </header>
  );
}
