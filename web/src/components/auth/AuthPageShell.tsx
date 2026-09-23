import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

const BENEFITS: { title: string; text: string }[] = [
  { title: "A day-by-day plan", text: "One day of study at a time: 180 days to N2, then 90 more to N1." },
  { title: "Progress that follows you", text: "Streaks, review queue and saved items across devices." },
  { title: "Explained answers", text: "Every question tells you why the distractors were wrong." },
];

/**
 * Layout shared by /login, /signup and /forgot-password.
 * Split on desktop (form left, decorative panel right); a single column on mobile.
 */
export function AuthPageShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-wide px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:min-h-[36rem]">
        <div className="flex items-center justify-center animate-rise">
          <div className="w-full max-w-md">
            <h1 className="text-h1">{title}</h1>
            {subtitle && <p className="text-muted mt-2 leading-relaxed">{subtitle}</p>}
            <Card className="mt-6 sm:mt-8 shadow-md" padding="p-6 sm:p-8">
              {children}
            </Card>
            <p className="mt-6 text-xs text-muted text-center">
              All lessons stay free without an account.{" "}
              <Link href="/japanese" className="underline hover:text-ink">Browse lessons</Link>
            </p>
          </div>
        </div>

        <aside aria-label="Why create an account" className="hidden lg:block animate-rise-2">
          <div className="relative h-full overflow-hidden rounded-2xl accent-gradient text-white shadow-lg p-10 flex flex-col justify-between">
            <div aria-hidden className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
            <div aria-hidden className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
            <div aria-hidden className="absolute inset-0 grid-bg opacity-20" />
            <p className="relative text-xs font-medium uppercase tracking-[0.16em] text-white/80">Japanese, one day at a time</p>
            <div className="relative">
              <p lang="ja" className="ja text-[11rem] leading-none font-semibold tracking-tight select-none drop-shadow-[0_12px_30px_rgba(0,0,0,0.25)]" aria-hidden>
                道
              </p>
              <p className="text-lg text-white/90 -mt-2">
                <span lang="ja" className="ja">みち</span> · the path
              </p>
            </div>
            <ul className="relative space-y-4">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span aria-hidden className="mt-1 h-5 w-5 shrink-0 rounded-full bg-white/20 grid place-items-center">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold">{b.title}</p>
                    <p className="text-sm text-white/80">{b.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
