import { Callout } from "@/components/ui";

/** Shown instead of auth forms when NEXT_PUBLIC_FIREBASE_* is missing. */
export function NotConfigured() {
  return (
    <Callout
      tone="warn"
      title="Firebase is not configured"
      icon={
        <svg className="h-5 w-5 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 9v4M12 17h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      }
    >
      <p>Sign-in needs a Firebase project. To enable it:</p>
      <ol className="mt-2 space-y-1.5">
        {[
          <>
            Copy <code className="rounded-md bg-surface px-1 py-0.5 text-xs border border-line">.env.example</code> to <code className="rounded-md bg-surface px-1 py-0.5 text-xs border border-line">.env.local</code> in <code className="rounded-md bg-surface px-1 py-0.5 text-xs border border-line">web/</code>.
          </>,
          <>
            Fill in the <code className="rounded-md bg-surface px-1 py-0.5 text-xs border border-line">NEXT_PUBLIC_FIREBASE_*</code> values from Firebase console &gt; Project settings &gt; Your apps.
          </>,
          <>
            Set <code className="rounded-md bg-surface px-1 py-0.5 text-xs border border-line">FIREBASE_SERVICE_ACCOUNT_JSON</code> (service account JSON on one line) so the server can verify sessions.
          </>,
          <>Enable the Google and Email/Password providers under Authentication, then restart the dev server.</>,
        ].map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span aria-hidden className="shrink-0 h-5 w-5 rounded-full bg-warn text-white text-[11px] font-semibold grid place-items-center tabular-nums mt-px">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2">All lessons remain available without an account.</p>
    </Callout>
  );
}
