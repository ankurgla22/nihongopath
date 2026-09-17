"use client";
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string };

/** 44px-tall input with a clear label above it and a soft focus ring. */
export function AuthField({ label, id, hint, className = "", ...rest }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className={`w-full h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted transition focus:outline-none focus:border-accent focus:shadow-ring disabled:opacity-50 ${className}`}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted mt-1.5">
          {hint}
        </p>
      )}
    </div>
  );
}

export function GoogleButton({ onClick, disabled, label = "Continue with Google" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-2.5 h-11 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink shadow-sm transition hover:bg-surface-2 hover:border-line-strong active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
        <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
      {label}
    </button>
  );
}

/** "or" divider between the Google button and the email form. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted" aria-hidden>
      <span className="flex-1 border-t border-line" />
      {label}
      <span className="flex-1 border-t border-line" />
    </div>
  );
}
