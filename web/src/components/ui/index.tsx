import Link from "next/link";
import type { ReactNode } from "react";
import type React from "react";
import { SpeakButton } from "./SpeakButton";
export { SpeakButton };

/* ---------- Layout ---------- */

export function Container({ children, wide = false, className = "" }: { children: ReactNode; wide?: boolean; className?: string }) {
  return <div className={`mx-auto px-4 sm:px-6 ${wide ? "max-w-wide" : "max-w-content"} ${className}`}>{children}</div>;
}

export function PageTitle({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pt-10 pb-8 animate-rise">
      {eyebrow && <div className="text-xs font-medium uppercase tracking-[0.14em] text-accent mb-3">{eyebrow}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-h1">{title}</h1>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {description && <p className="mt-4 text-muted text-lg leading-relaxed max-w-prose">{description}</p>}
    </div>
  );
}

export function Section({ id, title, children, intro, eyebrow, actions }: { id?: string; title: string; children: ReactNode; intro?: string; eyebrow?: string; actions?: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          {eyebrow && <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">{eyebrow}</p>}
          <h2 className="text-h2">{title}</h2>
          {intro && <p className="text-muted mt-1.5">{intro}</p>}
        </div>
        {actions}
      </div>
      <div>{children}</div>
    </section>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, className = "", as: Tag = "div", hover = false, padding = "p-5 sm:p-6" }: { children: ReactNode; className?: string; as?: React.ElementType; hover?: boolean; padding?: string }) {
  return <Tag className={`surface rounded-2xl ${padding} ${hover ? "surface-hover" : ""} ${className}`}>{children}</Tag>;
}

export function Badge({ children, tone = "neutral", size = "sm" }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "info"; size?: "sm" | "md" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2 border-line",
    accent: "bg-accent-soft text-accent-ink border-transparent",
    ok: "bg-ok-soft text-ok border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
    info: "bg-info-soft text-info border-transparent",
  };
  const sizes = { sm: "text-[11px] px-2 py-0.5", md: "text-xs px-2.5 py-1" };
  return <span className={`inline-flex items-center gap-1 font-medium rounded-full border ${tones[tone]} ${sizes[size]}`}>{children}</span>;
}

export function Callout({ children, tone = "neutral", title, icon }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "info"; title?: string; icon?: ReactNode }) {
  const tones = {
    neutral: "bg-surface-2 border-line",
    accent: "bg-accent-soft border-accent/20",
    ok: "bg-ok-soft border-ok/20",
    warn: "bg-warn-soft border-warn/20",
    info: "bg-info-soft border-info/20",
  };
  return (
    <div className={`border rounded-xl px-4 py-3.5 flex gap-3 ${tones[tone]}`}>
      {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div className="text-sm leading-relaxed text-ink-2">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Actions ---------- */

type BtnProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function Button({ children, href, onClick, type = "button", variant = "primary", size = "md", disabled, className = "", ariaLabel }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const sizes = { sm: "text-xs px-3.5 h-8", md: "text-sm px-5 h-10", lg: "text-base px-6 h-12" };
  const variants = {
    primary: "accent-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
    secondary: "bg-surface border border-line text-ink hover:bg-surface-2 hover:border-line-strong",
    outline: "border border-ink/20 text-ink hover:bg-surface-2",
    ghost: "text-accent hover:bg-accent-soft",
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ---------- Data display ---------- */

export function ProgressBar({ value, label, tone = "accent", size = "md" }: { value: number; label?: string; tone?: "accent" | "ok" | "info"; size?: "sm" | "md" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const fill = { accent: "accent-gradient", ok: "bg-ok", info: "bg-info" }[tone];
  return (
    <div>
      {label && (
        <div className="flex justify-between text-sm mb-1.5">
          <span className="font-medium">{label}</span>
          <span className="text-muted tabular-nums">{v}%</span>
        </div>
      )}
      <div className={`${size === "sm" ? "h-1.5" : "h-2.5"} rounded-full bg-surface-2 border border-line/60 overflow-hidden`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${fill} transition-[width] duration-700`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "neutral" | "accent" | "ok" }) {
  const v = { neutral: "text-ink", accent: "text-accent", ok: "text-ok" }[tone];
  return (
    <div className="surface rounded-2xl p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight ${v}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; path?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted pt-6">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg className="h-3.5 w-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            )}
            {it.path ? (
              <Link href={it.path} className="hover:text-ink transition">
                {it.name}
              </Link>
            ) : (
              <span className="text-ink font-medium">{it.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Japanese text with optional reading and English. Every instance gets a listen button. */
export function JaText({ ja, reading, en, size = "lg", note, speak = true }: { ja: string; reading?: string; en?: string; size?: "base" | "lg" | "xl" | "2xl"; note?: string; speak?: boolean }) {
  const sizes = { base: "text-base", lg: "text-lg sm:text-xl", xl: "text-2xl sm:text-3xl", "2xl": "text-4xl sm:text-5xl" };
  return (
    <div>
      <div className="flex items-start gap-2">
        <p lang="ja" className={`ja ${sizes[size]} leading-relaxed text-ink flex-1 min-w-0`}>
          {ja}
        </p>
        {speak && <SpeakButton text={ja} size={size === "base" ? "xs" : "sm"} className="mt-1" />}
      </div>
      {reading && (
        <p lang="ja" className="ja text-sm text-muted mt-0.5">
          {reading}
        </p>
      )}
      {en && <p className="text-sm sm:text-[15px] text-ink-2 mt-1">{en}</p>}
      {note && <p className="text-xs text-muted mt-1 italic">{note}</p>}
    </div>
  );
}

export function Pill({ children, active = false, href, onClick }: { children: ReactNode; active?: boolean; href?: string; onClick?: () => void }) {
  const cls = `inline-flex items-center rounded-full px-3 h-8 text-sm border transition ${active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2 hover:border-line-strong hover:bg-surface-2"}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="surface rounded-2xl p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-surface-2 grid place-items-center ja text-xl text-muted mb-3">空</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted mt-1.5 max-w-sm mx-auto">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1 rounded-md border border-line bg-surface-2 text-[11px] font-medium text-muted">{children}</kbd>;
}
