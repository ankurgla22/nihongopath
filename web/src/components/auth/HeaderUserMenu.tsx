"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { clearSession } from "./sessionClient";
import { getClientAuth } from "@/lib/firebase/client";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily-study", label: "Daily study" },
  { href: "/progress", label: "Progress" },
  { href: "/saved", label: "Saved" },
  { href: "/profile", label: "Profile" },
];

export function HeaderUserMenu() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (loading) return <span className="h-8 w-8 rounded-full bg-line animate-pulse" aria-hidden />;

  if (!user) {
    return (
      <Link href="/login" className="text-sm font-medium text-accent hover:underline">
        Log in
      </Link>
    );
  }

  const name = user.displayName || user.email || "Account";
  const initial = name.trim().charAt(0).toUpperCase();

  async function logout() {
    setOpen(false);
    const { signOut } = await import("firebase/auth");
    await signOut(getClientAuth());
    await clearSession();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" width={32} height={32} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border border-line object-cover" />
        ) : (
          <span className="h-8 w-8 rounded-full bg-accent-soft text-accent font-semibold flex items-center justify-center text-sm">{initial}</span>
        )}
        <span className="hidden md:inline text-sm max-w-[10rem] truncate">{name}</span>
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Account" className="absolute right-0 mt-2 w-48 bg-surface border border-line rounded-xl shadow-lg py-1 z-50">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-line/40">
              {m.label}
            </Link>
          ))}
          <div className="border-t border-line my-1" />
          <button type="button" role="menuitem" onClick={logout} className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-line/40">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
