"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export type NavItem = { href: string; label: string; exact?: boolean };

/**
 * Primary navigation. Picks the signed-in or signed-out item set from the auth state
 * (the header itself stays a server component and passes both lists in).
 */
export function NavLinks({ items, signedInItems, className = "", mobile = false }: { items: NavItem[]; signedInItems?: NavItem[]; className?: string; mobile?: boolean }) {
  const path = usePathname();
  const { user, loading } = useAuth();
  const list = user && signedInItems ? signedInItems : items;
  return (
    <nav aria-label={mobile ? "Primary mobile" : "Primary"} className={`${className} items-center gap-1 text-sm ${loading ? "opacity-70" : ""}`}>
      {list.map((n) => {
        const active = n.exact || n.href === "/japanese" ? path === n.href : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-2 rounded-full whitespace-nowrap transition ${active ? "bg-accent-soft text-accent-ink font-medium" : "text-muted hover:text-ink hover:bg-surface-2"} ${mobile ? "my-1.5" : ""}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile-only wrapper for the second header row: hides while scrolling down and
 * reappears on scroll up, so a phone screen keeps more room for content.
 */
export function CollapsingRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        if (y < 80) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    // `invisible` matters as much as the height: max-h-0 plus opacity-0 hides the row visually but
    // leaves every link in the tab order, so tabbing from the logo on a phone dropped focus into
    // five controls nobody could see. visibility:hidden removes them from it. StickyCta and
    // PartBar already guard this; this row was missed.
    <div className={`${className} overflow-hidden transition-[max-height,opacity] duration-200 ${hidden ? "max-h-0 opacity-0 invisible border-t-0" : "max-h-16 opacity-100"}`} aria-hidden={hidden || undefined}>
      {children}
    </div>
  );
}
