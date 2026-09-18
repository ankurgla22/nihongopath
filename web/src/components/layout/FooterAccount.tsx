"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { clearSession } from "@/components/auth/sessionClient";
import { getClientAuth } from "@/lib/firebase/client";
import { levelForPhase } from "@/components/study/helpers";
import { phaseOf } from "@/lib/study/service";
import { LEVEL_LABEL, type Level } from "@/lib/content/levels";

const linkCls = "text-ink-2 hover:text-accent transition";

function FooterList({ links }: { links: [string, string][] }) {
  return (
    <ul className="space-y-2 text-sm">
      {links.map(([label, href]) => (
        <li key={href}>
          <Link href={href} className={linkCls}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Footer "Account" column: session-aware links. */
export function FooterAccount() {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  async function logout() {
    if (configured) {
      const { signOut } = await import("firebase/auth");
      await signOut(getClientAuth());
    }
    await clearSession();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <ul className="space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="skeleton h-4 w-24 rounded" />
        ))}
      </ul>
    );
  }

  if (!user) {
    return (
      <FooterList
        links={[
          ["Log in", "/login"],
          ["Sign up", "/signup"],
        ]}
      />
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {(
        [
          ["Dashboard", "/dashboard"],
          ["Today", "/daily-study"],
          ["Profile", "/profile"],
        ] as [string, string][]
      ).map(([label, href]) => (
        <li key={href}>
          <Link href={href} className={linkCls}>
            {label}
          </Link>
        </li>
      ))}
      <li>
        <button type="button" onClick={logout} className={linkCls}>
          Log out
        </button>
      </li>
    </ul>
  );
}

/** Footer "Skills" column: follows the learner's current level when signed in, N5 otherwise. */
export function FooterSkills() {
  const { user } = useAuth();
  const { userDoc } = useUserDoc();
  const level: Level = user && userDoc ? levelForPhase(phaseOf(userDoc.currentDay)) : "n5";
  const label = LEVEL_LABEL[level];
  return (
    <FooterList
      links={[
        [`${label} grammar`, `/japanese/${level}/grammar`],
        [`${label} vocabulary`, `/japanese/${level}/vocabulary`],
        [`${label} kanji`, `/japanese/${level}/kanji`],
        [`${label} reading`, `/japanese/${level}/reading`],
        [`${label} listening`, `/japanese/${level}/listening`],
      ]}
    />
  );
}
