"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items, className = "", mobile = false }: { items: { href: string; label: string }[]; className?: string; mobile?: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label={mobile ? "Primary mobile" : "Primary"} className={`${className} items-center gap-1 text-sm`}>
      {items.map((n) => {
        const active = n.href === "/japanese" ? path === "/japanese" : path.startsWith(n.href);
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
