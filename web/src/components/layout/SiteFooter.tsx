import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";
import { FooterAccount, FooterSkills } from "./FooterAccount";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "Learn", links: [["Foundation", "/japanese/foundation"], ["N5", "/japanese/n5"], ["N4", "/japanese/n4"], ["N3", "/japanese/n3"], ["N2", "/japanese/n2"], ["N1", "/japanese/n1"]] },
  { title: "Exam", links: [["About the JLPT", "/jlpt"], ["Strategy", "/jlpt/strategy"], ["Mock exams", "/japanese/n5/mock-exams"], ["Tests", "/japanese/n5/tests"]] },
];

function ColTitle({ children }: { children: string }) {
  return <p className="text-xs uppercase tracking-wider text-muted mb-3">{children}</p>;
}

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
        <div>
          <ColTitle>{COLS[0].title}</ColTitle>
          <ul className="space-y-2 text-sm">
            {COLS[0].links.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="text-ink-2 hover:text-accent transition">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <ColTitle>Skills</ColTitle>
          <FooterSkills />
        </div>
        <div>
          <ColTitle>{COLS[1].title}</ColTitle>
          <ul className="space-y-2 text-sm">
            {COLS[1].links.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="text-ink-2 hover:text-accent transition">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <ColTitle>Account</ColTitle>
          <FooterAccount />
        </div>
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
