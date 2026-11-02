/**
 * Memoise a content loader for the life of the server process.
 *
 * These loaders used React's cache(), which lasts one request. The content is read-only JSON baked
 * into the build, so a request-scoped cache meant every page Next renders on demand (the ~11,400
 * N3–N1 vocabulary and kanji pages, which are not prerendered) re-read and re-validated up to 10 MB
 * of JSON per request: about 3 s of CPU per page on Cloud Run, and most of the October bill.
 *
 * Results are shared by every request, so callers must not mutate them (copy before sorting).
 * In development each call reads fresh, so edits to content/*.json show on the next refresh.
 */
export function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  if (process.env.NODE_ENV === "development") return fn;
  const memo = new Map<string, R>();
  return (...args: A): R => {
    const key = args.length ? JSON.stringify(args) : "";
    if (!memo.has(key)) memo.set(key, fn(...args));
    return memo.get(key) as R;
  };
}
