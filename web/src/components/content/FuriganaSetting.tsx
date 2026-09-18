"use client";
/**
 * Applies the learner's "Show furigana" profile setting to the page: toggles the
 * `furigana-off` class on <html>, which hides <rt> readings via globals.css.
 * Renders nothing. Signed-out visitors (and users who never changed the setting) see furigana.
 */
import { useEffect } from "react";
import { useUserDoc } from "@/components/auth/useUserDoc";

export function FuriganaSetting() {
  const { userDoc } = useUserDoc();
  const show = userDoc?.settings?.showFurigana ?? true;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("furigana-off", !show);
    return () => root.classList.remove("furigana-off");
  }, [show]);
  return null;
}
