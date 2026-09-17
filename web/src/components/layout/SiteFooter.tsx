import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";

const COLS = [
  { title: "Learn", links: [["N5", "/japanese/n5"], ["N4", "/japanese/n4"], ["N3", "/japanese/n3"], ["N2", "/japanese/n2"]] },
  { title: "N2 skills", links: [["Grammar", "/japanese/n2/grammar"], ["Vocabulary", "/japanese/n2/vocabulary"], ["Kanji", "/japanese/n2/kanji"], ["Reading", "/japanese/n2/reading"], ["Listening", "/japanese/n2/listening"]] },
  { title: "Exam", links: [["About the JLPT", "/jlpt"], ["Strategy", "/jlpt/strategy"], ["Mock exams", "/japanese/n2/mock-exams"], ["Tests", "/japanese/n2/tests"]] },
  { title: "Account", links: [["Dashboard", "/dashboard"], ["Daily study", "/daily-study"], ["Progress", "/progress"], ["Log in", "/login"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-bg-elev">
      <div className="mx-auto max-w-wide px-4 py-12 grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="h-8 w-8 rounded-xl accent-gradient text-white grid place-items-center ja">道</span>
            {SITE_NAME}
          </div>
          <p className="mt-3 text-sm text-muted max-w-xs">{SITE_TAGLINE}</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-xs uppercase tracking-wider text-muted mb-3">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-ink-2 hover:text-accent transition">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-wide px-4 py-5 text-xs text-muted flex flex-wrap gap-4 justify-between">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <span>Study every day. Understand, practise, review.</span>
        </div>
      </div>
    </footer>
  );
}
