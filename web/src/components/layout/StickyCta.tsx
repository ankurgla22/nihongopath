"use client";
import { useEffect, useState } from "react";
import { Arrow, Button } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Mobile-only sticky bottom bar. Appears once the element with id `watchId` (the hero)
 * has scrolled out of view, hidden for signed-in users who already have a plan.
 */
export function StickyCta({ watchId, href = "/signup", label = "Start the 180-day plan" }: { watchId: string; href?: string; label?: string }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  if (user) return null;

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 glass border-t border-line/80 transition-transform duration-200 ${show ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!show}
    >
      <Button href={href} className="w-full" size="lg">
        {label}
        <Arrow />
      </Button>
    </div>
  );
}
