/**
 * SSR smoke test (tasks.md section 53): fetches public pages from a real Next.js server
 * and asserts that lesson content is present in the initial HTML without executing JavaScript.
 *
 * Opt-in because it starts `next dev` (slow):
 *   npm run test:ssr                 (sets RUN_SSR_TESTS=1 for you)
 *   RUN_SSR_TESTS=1 npx vitest run tests/ssr.test.ts
 */
import { execSync, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ENABLED = process.env.RUN_SSR_TESTS === "1";
const ROOT = path.resolve(__dirname, "..");
const TIMEOUT_MS = 120_000;

let server: ChildProcess | undefined;
let base = "";
let serverLog = "";

/** Returns `preferred` if free, otherwise any free port. */
function freePort(preferred = 3123): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => {
      const s2 = net.createServer();
      s2.listen(0, "127.0.0.1", () => {
        const p = (s2.address() as net.AddressInfo).port;
        s2.close(() => resolve(p));
      });
    });
    s.listen(preferred, "127.0.0.1", () => s.close(() => resolve(preferred)));
  });
}

function killServer() {
  if (!server || server.pid === undefined || server.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

async function waitForReady(url: string, deadlineMs: number) {
  const deadline = Date.now() + deadlineMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) {
      throw new Error(`next dev exited early with code ${server.exitCode}\n${serverLog}`);
    }
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
      lastErr = new Error(`status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready after ${deadlineMs}ms: ${String(lastErr)}\n${serverLog}`);
}

/** Plain HTML fetch; never follows redirects and never executes scripts. */
async function get(pathname: string) {
  const res = await fetch(base + pathname, { redirect: "manual" });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

describe.skipIf(!ENABLED)("SSR: public pages render content in the initial HTML", () => {
  beforeAll(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const win = process.platform === "win32";
    server = spawn(win ? "npx.cmd" : "npx", ["next", "dev", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: ROOT,
      env: { ...process.env, NEXT_PUBLIC_SITE_URL: base },
      stdio: ["ignore", "pipe", "pipe"],
      shell: win,
      detached: !win,
      windowsHide: true,
    });
    server.stdout?.on("data", (d) => (serverLog += d.toString()));
    server.stderr?.on("data", (d) => (serverLog += d.toString()));
    await waitForReady(`${base}/robots.txt`, TIMEOUT_MS - 15_000);
    // Warm the lesson route: the first compile in dev mode can take a while.
    await get("/japanese/n2/grammar/wake-dewa-nai");
  }, TIMEOUT_MS);

  afterAll(() => {
    killServer();
  });

  it(
    "grammar lesson page contains the title, a Japanese example sentence and Meaning",
    async () => {
      const { status, text } = await get("/japanese/n2/grammar/wake-dewa-nai");
      expect(status).toBe(200);
      expect(text).toContain("わけではない");
      expect(text).toContain("Meaning");
      // A Japanese sentence (kana/kanji run ending in 。) must be in the raw HTML.
      expect(text).toMatch(/[぀-ヿ一-龯][^<]{4,}。/);
    },
    TIMEOUT_MS
  );

  it(
    "vocabulary index contains a word",
    async () => {
      const { status, text } = await get("/japanese/n2/vocabulary");
      expect(status).toBe(200);
      expect(text).toMatch(/\/japanese\/n2\/vocabulary\/[a-z0-9-]+/);
      expect(text).toMatch(/[぀-ヿ一-龯]{2,}/);
    },
    TIMEOUT_MS
  );

  it(
    "the N2 grammar sitemap part lists grammar URLs",
    async () => {
      // Part 13 = n2 grammar (see SITEMAP_SECTIONS). Next 14 serves parts at /sitemap/<id>.xml in
      // production but at /sitemap.xml/<id> under `next dev`; accept either.
      let r = await get("/sitemap/13.xml");
      if (r.status === 404) r = await get("/sitemap.xml/13");
      expect(r.status).toBe(200);
      expect(r.text).toContain("</urlset>");
      expect(r.text).toContain("/japanese/n2/grammar/wake-dewa-nai");
    },
    TIMEOUT_MS
  );

  it(
    "robots.txt disallows /dashboard",
    async () => {
      const { status, text } = await get("/robots.txt");
      expect(status).toBe(200);
      expect(text).toMatch(/Disallow:\s*\/dashboard/);
      expect(text).toMatch(/Sitemap:.*\/sitemap\/0\.xml/);
    },
    TIMEOUT_MS
  );

  it(
    "/dashboard redirects to /login without a session cookie",
    async () => {
      const { status, headers } = await get("/dashboard");
      expect([302, 307, 308]).toContain(status);
      expect(headers.get("location") ?? "").toContain("/login");
    },
    TIMEOUT_MS
  );

  it(
    "/login returns 200",
    async () => {
      const { status } = await get("/login");
      expect(status).toBe(200);
    },
    TIMEOUT_MS
  );
});
