// UX walkthrough: captures full-page screenshots of a first-time learner's journey.
// Usage: node tests/ux-walk.mjs   (production build running at http://localhost:3000)
// Desktop 1366x850 and mobile 390x844, light and dark (toggled via the header button).
// Creates one temporary Firebase user per viewport through the signup UI and deletes them at the end
// (via the Identity Toolkit REST API, key from web/.env — never printed).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "ux-shots");
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.(png|txt|json)$/.test(f)) fs.unlinkSync(path.join(OUT, f));

function readEnvKey(name) {
  if (process.env[name]) return process.env[name];
  for (const f of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}
const API_KEY = readEnvKey("NEXT_PUBLIC_FIREBASE_API_KEY");
if (!API_KEY) {
  console.error("NEXT_PUBLIC_FIREBASE_API_KEY not found in web/.env");
  process.exit(2);
}
async function idt(method, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} failed: ${j?.error?.message ?? r.status}`);
  return j;
}

const VIEWPORTS = {
  desktop: { width: 1366, height: 850 },
  mobile: { width: 390, height: 844 },
};
const PASSWORD = "UxWalk123!";
const log = [];
const notes = []; // observations gathered while driving (console errors, overflow, timings)

function note(vp, name, text) {
  notes.push({ vp, name, text });
}

async function settle(page, ms = 800) {
  await page.waitForLoadState("load").catch(() => {});
  await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function setTheme(page, dark) {
  const btn = page.getByRole("button", { name: dark ? /Switch to dark mode/ : /Switch to light mode/ });
  if (await btn.count()) {
    if (await btn.first().isVisible()) {
      await btn.first().click();
      await page.waitForTimeout(250);
      return "button";
    }
  }
  // already in requested theme?
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (isDark === dark) return "already";
  await page.evaluate((d) => {
    document.documentElement.classList.toggle("dark", d);
    try {
      localStorage.setItem("nihongo-path:theme", d ? "dark" : "light");
    } catch {}
  }, dark);
  await page.waitForTimeout(250);
  return "fallback";
}

/** Screenshot the page in light and dark mode. `opts.viewportOnly` = clip to viewport (for scroll positions). */
async function shoot(page, vp, name, opts = {}) {
  const t0 = Date.now();
  const base = `${name}-${vp}`;
  const fullPage = !opts.viewportOnly;
  await setTheme(page, false);
  await page.screenshot({ path: path.join(OUT, `${base}-light.png`), fullPage });
  const how = await setTheme(page, true);
  await page.screenshot({ path: path.join(OUT, `${base}-dark.png`), fullPage });
  await setTheme(page, false);
  if (how === "fallback") note(vp, name, "theme toggle button not visible in header; used fallback");
  // text dump + metrics (desktop light only to keep it light)
  const metrics = await page
    .evaluate(() => {
      const de = document.documentElement;
      const hs = [...document.querySelectorAll("h1,h2,h3")].map((h) => `${h.tagName.toLowerCase()}: ${h.textContent.trim().slice(0, 80)}`);
      const small = [...document.querySelectorAll("button,a")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32);
        })
        .slice(0, 12)
        .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
      return {
        url: location.href,
        title: document.title,
        hOverflow: de.scrollWidth > de.clientWidth ? `${de.scrollWidth}>${de.clientWidth}` : null,
        pageHeight: de.scrollHeight,
        h1Count: document.querySelectorAll("h1").length,
        headings: hs.slice(0, 40),
        smallTargets: small,
        mainText: (document.querySelector("main") || document.body).innerText.slice(0, 6000),
      };
    })
    .catch(() => null);
  if (metrics) {
    fs.writeFileSync(path.join(OUT, `${base}.txt`), `${metrics.url}\ntitle: ${metrics.title}\nh1s: ${metrics.h1Count}  height: ${metrics.pageHeight}  hOverflow: ${metrics.hOverflow}\n\nHEADINGS\n${metrics.headings.join("\n")}\n\nSMALL TARGETS (<32px)\n${metrics.smallTargets.join("\n")}\n\nMAIN TEXT\n${metrics.mainText}`);
    if (metrics.hOverflow) note(vp, name, `horizontal overflow ${metrics.hOverflow}`);
    if (metrics.h1Count !== 1) note(vp, name, `h1 count = ${metrics.h1Count}`);
  }
  log.push({ vp, name, ms: Date.now() - t0, url: page.url() });
  console.log(`  shot ${base} (${Date.now() - t0} ms)`);
}

async function scrollTo(page, frac) {
  await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * f), frac);
  await page.waitForTimeout(400);
}

async function firstHref(page, prefix, exclude = /\/page\//) {
  const hrefs = await page.locator(`main a[href^='${prefix}']`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  return hrefs.find((h) => h && h !== prefix && !exclude.test(h));
}

async function journey(browser, vp) {
  const viewport = VIEWPORTS[vp];
  const ctx = await browser.newContext({ viewport, locale: "en-US", hasTouch: vp === "mobile", isMobile: vp === "mobile" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/i.test(m.text())) note(vp, "console", `${page.url()} :: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => note(vp, "pageerror", `${page.url()} :: ${String(e).slice(0, 200)}`));

  const stamp = Date.now();
  const email = `uxwalk-${vp}-${stamp}@example.com`;
  const step = async (name, fn) => {
    console.log(`[${vp}] ${name}`);
    try {
      await fn();
    } catch (e) {
      console.log(`  !! ${name}: ${String(e?.message ?? e).split("\n")[0]}`);
      note(vp, name, `STEP FAILED: ${String(e?.message ?? e).split("\n")[0]}`);
      await page.screenshot({ path: path.join(OUT, `FAIL-${name.replace(/[^a-z0-9]+/gi, "-")}-${vp}.png`), fullPage: true }).catch(() => {});
    }
  };

  await step("01 home logged out", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "01-home-loggedout");
    if (vp === "mobile") {
      // open the mobile nav if there is one
      const menu = page.getByRole("button", { name: /menu|navigation/i }).first();
      if (await menu.count()) {
        await menu.click().catch(() => {});
        await page.waitForTimeout(300);
        await shoot(page, vp, "01b-home-mobile-menu", { viewportOnly: true });
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  });

  await step("02 /japanese", async () => {
    await page.goto(`${BASE}/japanese`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "02-japanese");
  });

  await step("03 /japanese/foundation", async () => {
    await page.goto(`${BASE}/japanese/foundation`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "03-foundation");
  });

  await step("04 foundation lesson", async () => {
    const href = (await firstHref(page, "/japanese/foundation/")) || "/japanese/foundation/hiragana-basic";
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "04-foundation-lesson");
  });

  await step("05 /signup", async () => {
    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "05-signup");
    // validation / error state: submit empty
    await page.getByRole("button", { name: /Create account|Sign up/i }).last().click().catch(() => {});
    await page.waitForTimeout(400);
    await shoot(page, vp, "05b-signup-empty-submit", { viewportOnly: true });
    // weak password error
    await page.locator("#name").fill("Ux Walker");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("123");
    await page.getByRole("button", { name: /Create account|Sign up/i }).last().click();
    await page.waitForTimeout(1500);
    await shoot(page, vp, "05c-signup-weak-password", { viewportOnly: true });
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /Create account|Sign up/i }).last().click();
    await page.waitForURL(/\/dashboard|\/daily-study|\/onboarding/, { timeout: 40000 });
  });

  await step("06 /dashboard fresh", async () => {
    if (!/\/dashboard/.test(page.url())) await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await page.getByText(/Day\s+1\s*\/\s*\d+/).first().waitFor({ timeout: 20000 }).catch(() => {});
    await shoot(page, vp, "06-dashboard-fresh");
    if (vp === "mobile") {
      const menu = page.getByRole("button", { name: /menu|navigation/i }).first();
      if (await menu.count()) {
        await menu.click().catch(() => {});
        await page.waitForTimeout(300);
        await shoot(page, vp, "06b-dashboard-mobile-menu", { viewportOnly: true });
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
    const acct = page.getByRole("button", { name: /^Account menu for/ }).first();
    if (await acct.count()) {
      await acct.click();
      await page.waitForTimeout(300);
      await shoot(page, vp, "06c-account-menu", { viewportOnly: true });
      await page.keyboard.press("Escape").catch(() => {});
    }
  });

  await step("07 /daily-study day 1", async () => {
    await page.goto(`${BASE}/daily-study`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    const tasks = page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']");
    await tasks.first().waitFor({ timeout: 30000 });
    const header = tasks.first().locator("button[aria-expanded]").first();
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    await tasks.first().locator("[id^='panel-']").waitFor();
    await page.waitForTimeout(500);
    await shoot(page, vp, "07-daily-study-day1");
  });

  await step("08 kana quiz", async () => {
    const tasks = page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']");
    const quizTask = tasks.filter({ has: page.locator("button[aria-expanded]").filter({ hasText: /\d+ questions/ }) }).first();
    const header = quizTask.locator("button[aria-expanded]").first();
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    const panel = quizTask.locator("[id^='panel-']");
    await panel.waitFor();
    await shoot(page, vp, "08a-quiz-task-expanded", { viewportOnly: true });
    await panel.getByRole("button", { name: /^Start .*\(\d+ questions\)/ }).click();
    const options = panel.getByRole("radiogroup", { name: "Answer options" });
    await options.waitFor({ timeout: 40000 });
    await page.waitForTimeout(400);
    await panel.scrollIntoViewIfNeeded();
    await shoot(page, vp, "08b-quiz-question-unanswered");
    await options.locator("[role='radio']").first().click();
    await page.waitForTimeout(400);
    await shoot(page, vp, "08c-quiz-question-answered");
    const progress = panel.getByRole("progressbar", { name: "Quiz progress" });
    const total = Number(await progress.getAttribute("aria-valuemax"));
    for (let i = 0; i < total; i++) {
      await options.waitFor({ timeout: 15000 });
      if (!(await options.locator("[role='radio'][aria-checked='true']").count())) await options.locator("[role='radio']").first().click();
      const adv = panel.getByRole("button", { name: /^(Next question|Finish)$/ });
      await adv.waitFor();
      const label = (await adv.innerText()).trim();
      await adv.click();
      if (label === "Finish") break;
    }
    await panel.locator("[role='status'][aria-live='polite']").waitFor({ timeout: 30000 });
    await page.getByText(/Saving your result/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shoot(page, vp, "08d-quiz-result");
    // jump-to-day control for reference
    const jump = page.locator("#jump-day");
    if (await jump.count()) {
      await jump.scrollIntoViewIfNeeded();
      await shoot(page, vp, "08e-daily-jump-to-day", { viewportOnly: true });
    }
  });

  await step("09 /japanese/n5/grammar", async () => {
    await page.goto(`${BASE}/japanese/n5/grammar`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "09-n5-grammar-index");
  });

  await step("10 N5 grammar lesson", async () => {
    const href = (await firstHref(page, "/japanese/n5/grammar/")) || "/japanese/n5/grammar/arimasu-imasu";
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "10-n5-grammar-lesson-full");
    await scrollTo(page, 0);
    await shoot(page, vp, "10a-n5-grammar-lesson-top", { viewportOnly: true });
    await scrollTo(page, 0.5);
    await shoot(page, vp, "10b-n5-grammar-lesson-middle", { viewportOnly: true });
    await scrollTo(page, 1);
    await shoot(page, vp, "10c-n5-grammar-lesson-bottom", { viewportOnly: true });
  });

  await step("11 N5 vocabulary + word", async () => {
    await page.goto(`${BASE}/japanese/n5/vocabulary`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "11-n5-vocabulary-index");
    const href = await firstHref(page, "/japanese/n5/vocabulary/");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "11b-n5-word");
  });

  await step("12 N5 kanji + kanji page", async () => {
    await page.goto(`${BASE}/japanese/n5/kanji`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "12-n5-kanji-index");
    const href = await firstHref(page, "/japanese/n5/kanji/");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "12b-n5-kanji");
  });

  await step("13 N5 reading with timer", async () => {
    await page.goto(`${BASE}/japanese/n5/reading`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "13-n5-reading-index");
    const href = await firstHref(page, "/japanese/n5/reading/");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const timer = page.getByRole("group", { name: "Reading timer" });
    await timer.getByRole("button", { name: /^Start( timer)?$/ }).first().click();
    await page.waitForTimeout(3500);
    await shoot(page, vp, "13b-n5-reading-timer-running");
  });

  await step("14 N5 listening steps", async () => {
    await page.goto(`${BASE}/japanese/n5/listening`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "14-n5-listening-index");
    const href = await firstHref(page, "/japanese/n5/listening/");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const nav = page.getByRole("navigation", { name: "Listening steps" });
    const stepName = async () => (await nav.locator("button[aria-current='step']").first().innerText()).replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 20);
    const main = page.locator("main");
    const snap = async (k, i) => shoot(page, vp, `14${k}-n5-listening-step${i}-${await stepName()}`);
    await snap("b", 1); // Listen
    await page.getByRole("button", { name: /I have listened/ }).click();
    await page.waitForTimeout(400);
    await snap("c", 2); // Answer
    // answer every question with option 1 so the Check step can be reached
    const names = await main.locator("input[type='radio']").evaluateAll((els) => [...new Set(els.map((e) => e.name))]);
    for (const n of names) {
      const radio = page.locator(`input[type='radio'][name='${n}']`).first();
      await main.locator("label").filter({ has: radio }).first().click();
      await page.waitForTimeout(150);
    }
    await main.getByRole("button", { name: /^Check answers$/ }).click();
    await page.waitForTimeout(600);
    await snap("d", 3); // Check
    await page.getByRole("button", { name: /Read the transcript/ }).first().click();
    await page.waitForTimeout(400);
    await snap("e", 4); // Transcript
    const more = page.getByRole("button", { name: /Listen again with the transcript/ });
    if (await more.count()) {
      await more.click();
      await page.waitForTimeout(400);
      await snap("f", 5);
    }
  });

  await step("15 /review", async () => {
    await page.goto(`${BASE}/review`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await page.locator("h2").filter({ hasText: /Preparing your session/ }).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    await shoot(page, vp, "15-review");
  });

  await step("16 /progress", async () => {
    await page.goto(`${BASE}/progress`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await shoot(page, vp, "16-progress");
  });

  await step("17 /tests", async () => {
    await page.goto(`${BASE}/tests`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await shoot(page, vp, "17-tests");
  });

  await step("18 /mock-exams + start", async () => {
    await page.goto(`${BASE}/mock-exams`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await shoot(page, vp, "18-mock-exams");
    const href = (await page.locator("main a[href^='/mock-exams/n5']").first().getAttribute("href").catch(() => null)) || (await firstHref(page, "/mock-exams/"));
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await page.getByRole("button", { name: /^Start/ }).first().waitFor({ timeout: 20000 }).catch(() => {});
    await shoot(page, vp, "18b-mock-start");
  });

  await step("19 /profile", async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await shoot(page, vp, "19-profile");
  });

  await step("20 /search", async () => {
    await page.goto(`${BASE}/search?q=${encodeURIComponent("学校")}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "20-search");
    await page.goto(`${BASE}/search?q=${encodeURIComponent("zzzqqq")}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "20b-search-noresults");
  });

  await step("21 404", async () => {
    await page.goto(`${BASE}/japanese/n5/grammar/this-does-not-exist`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shoot(page, vp, "21-404");
  });

  await step("22 focus visibility", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await settle(page, 1000);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await shoot(page, vp, "22-keyboard-focus", { viewportOnly: true });
  });

  await ctx.close();
  return email;
}

const browser = await chromium.launch({ headless: true });
const users = [];
try {
  for (const vp of ["desktop", "mobile"]) {
    const email = await journey(browser, vp).catch((e) => {
      console.log(`journey ${vp} aborted: ${e.message}`);
      return null;
    });
    if (email) users.push(email);
  }
} finally {
  await browser.close().catch(() => {});
  for (const email of users) {
    try {
      const r = await idt("signInWithPassword", { email, password: PASSWORD, returnSecureToken: true });
      await idt("delete", { idToken: r.idToken });
      console.log(`deleted temp user ${email}`);
    } catch (e) {
      console.log(`could not delete ${email}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(OUT, "walk-log.json"), JSON.stringify({ shots: log, notes }, null, 2));
  console.log(`\n${log.length} screenshots in ${path.relative(process.cwd(), OUT)}; ${notes.length} notes (see walk-log.json)`);
}
