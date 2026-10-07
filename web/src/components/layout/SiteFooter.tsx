import Link from "next/link";
import { SITE_NAME } from "@/lib/seo/site";
import { affiliateEnabled } from "@/lib/affiliate/stores";
import { FooterAccount } from "./FooterAccount";

/** One-line footer: logo · © year · About the JLPT · Profile / Log in. */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-bg-elev">
      <div className="mx-auto max-w-wide px-4 py-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span className="h-6 w-6 rounded-lg accent-gradient text-white grid place-items-center ja text-xs">道</span>
          {SITE_NAME}
        </span>
        <span aria-hidden>·</span>
        <span>© {new Date().getFullYear()}</span>
        <span aria-hidden>·</span>
        <Link href="/about" className="text-ink-2 hover:text-accent transition">
          About
        </Link>
        <span aria-hidden>·</span>
        <Link href="/jlpt" className="text-ink-2 hover:text-accent transition">
          About the JLPT
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="text-ink-2 hover:text-accent transition">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="text-ink-2 hover:text-accent transition">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <FooterAccount />
      </div>
      {/* Amazon's Operating Agreement requires this exact sentence on the site; it is shown only once
          a store actually has a tag, because before that it would not be true. */}
      {affiliateEnabled() && (
        <div className="mx-auto max-w-wide px-4 pb-5 text-xs text-muted">As an Amazon Associate, {SITE_NAME} earns from qualifying purchases made through book links on this site.</div>
      )}
    </footer>
  );
}
