/**
 * The private-route redirect, exercised with real NextRequest objects.
 *
 * A note for whoever next reaches for middleware to deal with `?_rsc=` prefetch URLs: don't.
 * Next strips `_rsc` from the URL before middleware runs (stripInternalSearchParams in the
 * middleware adapter), so a check on it passes a unit test like these and never fires in
 * production — which is exactly what happened once. The guard lives in next.config.mjs
 * `redirects()`, where the router still sees the parameter.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";

const req = (url: string, cookie?: string) =>
  new NextRequest(new URL(url, "https://nihongopath.app"), { headers: cookie ? { cookie } : {} });

describe("private routes", () => {
  it("sends a signed-out visitor to login with the return path", () => {
    const res = middleware(req("/progress"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://nihongopath.app/login?next=%2Fprogress");
  });

  it("keeps the query string in the return path", () => {
    const res = middleware(req("/daily-study?day=3"));
    expect(res.headers.get("location")).toBe("https://nihongopath.app/login?next=%2Fdaily-study%3Fday%3D3");
  });

  it("lets a visitor with a session cookie through", () => {
    const res = middleware(req("/progress", "__session=abc"));
    expect(res.status).toBe(200);
  });

  it("does nothing to a public page", () => {
    const res = middleware(req("/japanese/n5/vocabulary"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
