/**
 * The prefetch-URL guard and the private-route redirect, exercised with real NextRequest objects.
 *
 * The guard exists because a crawler that runs JavaScript sees Next's `?_rsc=<hash>` prefetch
 * URLs and fetches them as pages, without the `RSC` header a browser sends. One crawler did that
 * 68,952 times in a day. The two cases that must never regress: a browser's prefetch (header
 * present) passes through untouched, and a crawler's copy (no header) is redirected rather than
 * rendered.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";

const req = (url: string, init: { headers?: Record<string, string>; cookie?: string } = {}) =>
  new NextRequest(new URL(url, "https://nihongopath.app"), {
    headers: { ...(init.headers ?? {}), ...(init.cookie ? { cookie: init.cookie } : {}) },
  });

describe("prefetch-URL guard", () => {
  it("redirects a ?_rsc= request with no RSC header to the clean URL, keeping other params", () => {
    const res = middleware(req("/japanese/n5/vocabulary?page=2&_rsc=1ymwf"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://nihongopath.app/japanese/n5/vocabulary?page=2");
  });

  it("leaves a browser's own prefetch alone (RSC header present)", () => {
    const res = middleware(req("/japanese/n5/vocabulary?_rsc=1ymwf", { headers: { RSC: "1" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does nothing to an ordinary page request", () => {
    const res = middleware(req("/japanese/n5/vocabulary"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("private routes", () => {
  it("sends a signed-out visitor to login with the return path", () => {
    const res = middleware(req("/progress"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://nihongopath.app/login?next=%2Fprogress");
  });

  it("lets a visitor with a session cookie through", () => {
    const res = middleware(req("/progress", { cookie: "__session=abc" }));
    expect(res.status).toBe(200);
  });

  it("still guards prefetch URLs on private routes before anything else", () => {
    const res = middleware(req("/dashboard?_rsc=abc"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://nihongopath.app/dashboard");
  });
});
