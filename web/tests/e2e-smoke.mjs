// End-to-end smoke test against a running production build (http://localhost:3000).
// Usage: node tests/e2e-smoke.mjs   (npm run test:e2e)
// Creates a temporary Firebase user through the Identity Toolkit REST API, drives the
// app in headless Chromium, and deletes the user at the end. Firestore docs under
// users/<uid> are left behind (reported at the end).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ART = path.join(__dirname, "e2e-artifacts");
fs.mkdirSync(ART, { recursive: true });

// ---------- env ----------
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
const IDT = "https://identitytoolkit.googleapis.com/v1";
async function idt(method, body) {
  const r = await fetch(`${IDT}/accounts:${method}?key=${API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} failed: ${j?.error?.message ?? r.status}`);
  return j;
}

// ---------- reporting ----------
const results = [];
const consoleErrors = []; // {page, text}
const pageErrors = []; // {page, text}
const cspViolations = []; // {page, blockedURI, directive, sample}
let currentStep = "setup";
let stepIdx = 0;

async function step(name, fn, page) {
  currentStep = name;
  stepIdx++;
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASS  ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    const msg = e?.message ?? String(e);
    let shot = null;
    if (page && !page.isClosed()) {
      shot = path.join(ART, `${String(stepIdx).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    }
    results.push({ name, ok: false, ms: Date.now() - t0, error: msg, url: page && !page.isClosed() ? page.url() : null, shot });
    console.log(`FAIL  ${name}: ${msg.split("\n")[0]}${shot ? `  [${path.relative(process.cwd(), shot)}]` : ""}`);
  }
}

const NOISE = [/favicon/i, /Download the React DevTools/i, /third-party cookie/i];
function attachListeners(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const text = m.text();
    if (NOISE.some((r) => r.test(text))) return;
    if (m.type() === "warning" && !/Content Security Policy|Refused to/i.test(text)) return;
    consoleErrors.push({ label, step: currentStep, url: page.url(), type: m.type(), text: text.slice(0, 600) });
  });
  page.on("pageerror", (err) => pageErrors.push({ label, step: currentStep, url: page.url(), text: String(err?.stack ?? err).slice(0, 600) }));
  page.on("requestfailed", (req) => {
    const t = req.failure()?.errorText ?? "";
    if (t === "net::ERR_ABORTED") return;
    consoleErrors.push({ label, step: currentStep, url: page.url(), type: "requestfailed", text: `${req.method()} ${req.url()} -> ${t}` });
  });
}
async function collectCsp(page, label) {
  if (page.isClosed()) return;
  const v = await page.evaluate(() => {
    const out = window.__cspv || [];
    window.__cspv = [];
    return out;
  }).catch(() => []);
  for (const x of v) cspViolations.push({ label, step: currentStep, page: x.documentURI, ...x });
}
const CSP_INIT = `
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__cspv.push({ blockedURI: e.blockedURI, directive: e.effectiveDirective || e.violatedDirective, documentURI: e.documentURI, sample: (e.sample||'').slice(0,120), disposition: e.disposition, sourceFile: e.sourceFile, line: e.lineNumber, col: e.columnNumber });
  });
`;

async function newContext(browser, viewport, label) {
  // No timezoneId override: the browser must share the server clock (see report on SSR greeting mismatch).
  const ctx = await browser.newContext({ viewport, locale: "en-US" });
  await ctx.addInitScript(CSP_INIT);
  const page = await ctx.newPage();
  attachListeners(page, label);
  page.setDefaultTimeout(20000);
  // collect CSP before each navigation away
  page.__navs = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) page.__navs++;
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/auth/session")) page.__lastSession = { method: r.request().method(), status: r.status(), setCookie: r.headers()["set-cookie"] ?? null };
  });
  return { ctx, page };
}

async function expectNoOfflineWarning(page) {
  const offline = page.getByText(/Saved offline/i);
  if (await offline.count()) throw new Error('"Saved offline" warning shown — Firestore write did not succeed');
}

async function loginViaUI(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Log in$/ }).click();
  await Promise.race([
    page.waitForURL(/\/dashboard(\?|$)/, { timeout: 30000 }),
    page.locator("form [role='alert']").waitFor({ timeout: 30000 }).then(async () => {
      throw new Error(`Login alert: ${await page.locator("form [role='alert']").first().innerText()}`);
    }),
  ]);
  await page.waitForLoadState("load");
}

// ---------- main ----------
const stamp = Date.now();
const EMAIL = `e2e-${stamp}@example.com`;
const PASSWORD = "E2eTest123!";
let idToken = null;
let uid = null;
let quizScoreText = null;
const NEW_NAME = `E2E Tester ${String(stamp).slice(-4)}`;

const browser = await chromium.launch({ headless: true });
const { page } = await newContext(browser, { width: 1280, height: 900 }, "desktop");

try {
  await step("1. Create temp user via REST signUp", async () => {
    const r = await idt("signUp", { email: EMAIL, password: PASSWORD, returnSecureToken: true });
    idToken = r.idToken;
    uid = r.localId;
    if (!idToken || !uid) throw new Error("signUp did not return idToken/localId");
    console.log(`      user ${EMAIL} uid=${uid}`);
  });

  await step("2. Login via UI -> /dashboard with account menu", async () => {
    await loginViaUI(page, EMAIL, PASSWORD);
    const menuBtn = page.getByRole("button", { name: /^Account menu for/ });
    await menuBtn.waitFor({ state: "visible", timeout: 20000 });
    await collectCsp(page, "desktop");
  }, page);

  await step("3. Dashboard shows Day 1 and stat row; Continue -> /daily-study", async () => {
    // Day counter renders "Day 1 / 180" once loaded
    await page.getByText(/^Day\s+1\s*\/\s*\d+/).first().waitFor({ timeout: 20000 });
    for (const label of ["Streak", "Study time", "Lessons", "Due reviews"]) {
      const n = await page.getByText(label, { exact: true }).count();
      if (!n) throw new Error(`Stat "${label}" not rendered`);
    }
    await page.getByRole("link", { name: /Continue today's study|Open today's plan/ }).first().click();
    await page.waitForURL(/\/daily-study/);
    // A failed RSC prefetch makes Next fall back to a full browser navigation; let that settle
    // before interacting, otherwise React state (open panel) is wiped by the reload.
    await page.waitForLoadState("load");
    await page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']").first().waitFor({ timeout: 30000 });
    // wait until no main-frame navigation has happened for 3 s
    for (let i = 0, last = page.__navs; i < 10; i++) {
      await page.waitForTimeout(3000);
      if (page.__navs === last) break;
      last = page.__navs;
    }
    await collectCsp(page, "desktop");
  }, page);

  await step("4a. Daily study: expand first kana task, foundation link, Mark done", async () => {
    const tasks = page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']");
    await tasks.first().waitFor({ timeout: 30000 });
    const first = tasks.first();
    const navsBefore = page.__navs;
    const header = first.locator("button[aria-expanded]").first();
    // the first task is auto-expanded on load; only click when collapsed
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    const panel = first.locator("[id^='panel-']");
    await panel.waitFor();
    const links = panel.locator("a[href*='/japanese/foundation/']");
    if ((await links.count()) === 0) throw new Error("No foundation lesson links in first kana task panel");
    await panel.getByRole("button", { name: /^Mark done/ }).click();
    try {
      await first.getByText("Done", { exact: true }).waitFor({ timeout: 20000 });
    } catch {
      const notice = await page.locator("main").getByText(/marked done|Saved offline|Could not save|Missing or insufficient|permission/i).allInnerTexts().catch(() => []);
      throw new Error(`Task 1 not marked Done after clicking "Mark done". Navigations during step: ${page.__navs - navsBefore}. Notices: ${JSON.stringify(notice)}`);
    }
    await page.waitForTimeout(1500);
    await expectNoOfflineWarning(page);
  }, page);

  await step("4b. Daily study: run the quiz task, answer all, result with score, no offline warning", async () => {
    const tasks = page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']");
    // the quiz task is the one advertising a question count
    const quizTask = tasks.filter({ has: page.locator("button[aria-expanded]").filter({ hasText: /\d+ questions/ }) }).first();
    if (!(await quizTask.count())) throw new Error("Quiz task (with 'N questions') not found");
    const header = quizTask.locator("button[aria-expanded]").first();
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    const panel = quizTask.locator("[id^='panel-']");
    await panel.getByRole("button", { name: /^Start .*\(\d+ questions\)/ }).click();
    // wait for the first question
    const options = panel.getByRole("radiogroup", { name: "Answer options" });
    await options.waitFor({ timeout: 40000 });
    const progress = panel.getByRole("progressbar", { name: "Quiz progress" });
    const total = Number(await progress.getAttribute("aria-valuemax"));
    if (!total) throw new Error("Quiz total not found");
    for (let i = 0; i < total; i++) {
      await options.waitFor({ timeout: 15000 });
      await page.locator("body").focus().catch(() => {});
      // keyboard "1" chooses option 1 (practice mode reveals immediately)
      await page.keyboard.press("1");
      let chosen = await options.locator("[role='radio'][aria-checked='true']").count();
      if (!chosen) {
        await options.locator("[role='radio']").first().click();
        chosen = await options.locator("[role='radio'][aria-checked='true']").count();
      }
      if (!chosen) throw new Error(`Question ${i + 1}: option 1 could not be selected`);
      const adv = panel.getByRole("button", { name: /^(Next question|Finish)$/ });
      await adv.waitFor();
      const label = (await adv.innerText()).trim();
      await adv.click();
      if (label === "Finish") break;
    }
    const result = panel.locator("[role='status'][aria-live='polite']");
    await result.waitFor({ timeout: 30000 });
    const txt = await result.innerText();
    const m = txt.match(/(\d+)\s*\n?\s*of\s+(\d+)/);
    if (!m) throw new Error(`Result screen does not show a score. Text: ${txt.slice(0, 200)}`);
    quizScoreText = `${m[1]}/${m[2]}`;
    console.log(`      quiz score ${quizScoreText}`);
    // wait for the save indicator to disappear
    await page.getByText(/Saving your result/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await expectNoOfflineWarning(page);
    const warn = page.getByText(/Could not save|Could not load the questions/i);
    if (await warn.count()) throw new Error(`Warning shown: ${await warn.first().innerText()}`);
    await collectCsp(page, "desktop");
  }, page);

  await step("5. Reload /daily-study: completed tasks persist", async () => {
    await page.goto(`${BASE}/daily-study`, { waitUntil: "domcontentloaded" });
    const tasks = page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']");
    await tasks.first().waitFor({ timeout: 30000 });
    // kana task 1 done
    await tasks.first().getByText("Done", { exact: true }).waitFor({ timeout: 20000 });
    const quizTask = tasks.filter({ has: page.locator("button[aria-expanded]").filter({ hasText: /\d+ questions/ }) }).first();
    await quizTask.getByText("Done", { exact: true }).waitFor({ timeout: 20000 });
    await collectCsp(page, "desktop");
  }, page);

  const simplePages = [
    ["/review", /review/i],
    ["/progress", /progress/i],
    ["/history", /history/i],
  ];
  for (const [p, re] of simplePages) {
    await step(`6. Visit ${p}`, async () => {
      const resp = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
      if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      if (!page.url().includes(p)) throw new Error(`Redirected to ${page.url()}`);
      await page.locator("h1").first().waitFor();
      const h1 = await page.locator("h1").first().innerText();
      if (!re.test(h1)) throw new Error(`Unexpected h1 "${h1}"`);
      // wait for client data to settle
      await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
      const err = page.getByText(/Something went wrong|Could not load/i);
      if (await err.count()) throw new Error(`Error state: ${await err.first().innerText()}`);
      await collectCsp(page, "desktop");
    }, page);
  }

  await step("6. /tests/history lists the quiz result", async () => {
    await page.goto(`${BASE}/tests/history`, { waitUntil: "domcontentloaded" });
    await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const [s, t] = (quizScoreText ?? "0/0").split("/");
    const row = page.getByText(new RegExp(`^\\s*${s}\\s*/\\s*${t}\\s*$`)).first();
    await row.waitFor({ timeout: 20000 }).catch(async () => {
      const body = await page.locator("main").innerText().catch(() => "");
      throw new Error(`Quiz result ${quizScoreText} not listed. Page text: ${body.slice(0, 300).replace(/\s+/g, " ")}`);
    });
    await collectCsp(page, "desktop");
  }, page);

  await step("6. /saved renders", async () => {
    await page.goto(`${BASE}/saved`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor();
    await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    if (await page.getByText(/Something went wrong|Could not load/i).count()) throw new Error("Error state on /saved");
    await collectCsp(page, "desktop");
  }, page);

  await step("6. /profile: change display name, save, reload, assert", async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    const input = page.locator("#displayName");
    await input.waitFor();
    await page.waitForTimeout(1500); // let the user doc hydrate the field
    await input.fill(NEW_NAME);
    await page.getByRole("button", { name: /Save changes/ }).click();
    await page.getByText("Saved.", { exact: true }).waitFor({ timeout: 20000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await input.waitFor();
    await page.waitForFunction((v) => document.querySelector("#displayName")?.value === v, NEW_NAME, { timeout: 20000 });
    const menuBtn = page.getByRole("button", { name: `Account menu for ${NEW_NAME}` });
    await menuBtn.waitFor({ timeout: 20000 });
    await collectCsp(page, "desktop");
  }, page);

  await step("6. /mock-exams lists N2 mock; /mock-exams/n2-mock-a start screen", async () => {
    await page.goto(`${BASE}/mock-exams`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /Start exam/ }).first().waitFor();
    const link = page.locator("a[href='/mock-exams/n2-mock-a']").first();
    if (!(await link.count())) throw new Error("n2-mock-a not listed on /mock-exams");
    await page.goto(`${BASE}/mock-exams/n2-mock-a`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Start (full exam|a new attempt|.+)$/ }).first().waitFor({ timeout: 20000 });
    if (!(await page.getByText(/N2/).first().count())) throw new Error("Exam title not shown");
    await collectCsp(page, "desktop");
  }, page);

  await step("7. /japanese/foundation/hiragana-basic: click a kana tile", async () => {
    const resp = await page.goto(`${BASE}/japanese/foundation/hiragana-basic`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    const tile = page.getByRole("button", { name: "Play sound" }).first();
    await tile.waitFor();
    const before = pageErrors.length;
    await tile.click();
    await page.waitForTimeout(500);
    if (pageErrors.length > before) throw new Error(`Page error after tile click: ${pageErrors.at(-1).text}`);
    await collectCsp(page, "desktop");
  }, page);

  await step("7. /japanese/n2/grammar/wake-dewa-nai: answer mini-quiz question 1", async () => {
    const resp = await page.goto(`${BASE}/japanese/n2/grammar/wake-dewa-nai`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    // LessonQuiz (the "Test yourself" block) renders its options in ol[aria-label="Answer options"]
    const quiz = page.locator("ol[aria-label='Answer options']").first();
    await quiz.waitFor();
    await quiz.scrollIntoViewIfNeeded();
    const opt = quiz.locator("button[aria-pressed]").first();
    await opt.click();
    await page.waitForTimeout(500);
    if ((await opt.getAttribute("aria-pressed")) !== "true") {
      await opt.click();
      await page.waitForTimeout(500);
      if ((await opt.getAttribute("aria-pressed")) !== "true") throw new Error("Mini quiz option 1 did not become selected (aria-pressed stays false) after clicking");
    }
    await page.locator("[role='status']").filter({ hasText: /Correct|Not quite/ }).first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Next question|See result/ }).first().waitFor();
    await collectCsp(page, "desktop");
  }, page);

  await step("7. /japanese/n2/vocabulary/page/2 renders", async () => {
    const resp = await page.goto(`${BASE}/japanese/n2/vocabulary/page/2`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const n = await page.locator("main a[href^='/japanese/n2/vocabulary/']").count();
    if (n === 0) throw new Error("No vocabulary links rendered");
    await collectCsp(page, "desktop");
  }, page);

  await step("7. /search?q=影響 returns results", async () => {
    const resp = await page.goto(`${BASE}/search?q=${encodeURIComponent("影響")}`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const n = await page.locator("main a[href^='/japanese/']").count();
    if (n === 0) throw new Error("No result links for 影響");
    await collectCsp(page, "desktop");
  }, page);

  // ---------- mobile pass (separate context, fresh login) ----------
  const m = await newContext(browser, { width: 390, height: 844 }, "mobile");
  await step("M. Mobile 390x844: login, dashboard, daily-study, lesson, mock start", async () => {
    await loginViaUI(m.page, EMAIL, PASSWORD);
    await m.page.getByText(/^Day\s+1\s*\/\s*\d+/).first().waitFor({ timeout: 20000 });
    const noHScroll = async (label) => {
      const over = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 2) throw new Error(`${label}: horizontal overflow of ${over}px at 390px width`);
    };
    await noHScroll("/dashboard");
    await m.page.goto(`${BASE}/daily-study`, { waitUntil: "domcontentloaded" });
    await m.page.getByRole("list", { name: "Today's tasks" }).locator("li").first().waitFor({ timeout: 30000 });
    await noHScroll("/daily-study");
    await m.page.goto(`${BASE}/japanese/n2/grammar/wake-dewa-nai`, { waitUntil: "domcontentloaded" });
    await m.page.locator("h1").first().waitFor();
    await noHScroll("/japanese/n2/grammar/wake-dewa-nai");
    await m.page.goto(`${BASE}/mock-exams/n2-mock-a`, { waitUntil: "domcontentloaded" });
    await m.page.getByRole("button", { name: /^Start/ }).first().waitFor();
    await noHScroll("/mock-exams/n2-mock-a");
    await collectCsp(m.page, "mobile");
  }, m.page);
  await m.ctx.close().catch(() => {});

  await step("8. Logout via header menu; /dashboard redirects to /login", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
    const menuBtn = page.getByRole("button", { name: /^Account menu for/ });
    await menuBtn.waitFor();
    // Every navigation fires several POST /api/auth/session calls; a late one re-sets the cookie
    // after the logout DELETE (see report). Let them finish before logging out.
    await page.waitForTimeout(4000);
    await menuBtn.click();
    const deleteResp = page.waitForResponse((r) => r.url().includes("/api/auth/session") && r.request().method() === "DELETE", { timeout: 15000 }).catch(() => null);
    await page.getByRole("menuitem", { name: "Log out" }).click();
    const del = await deleteResp;
    if (!del) throw new Error("No DELETE /api/auth/session was observed after clicking Log out");
    if (del.status() !== 200) throw new Error(`DELETE /api/auth/session returned ${del.status()}`);
    await page.getByRole("link", { name: "Log in" }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const cookies = await page.context().cookies(BASE);
    const session = cookies.find((c) => c.name === "__session");
    const lastSession = page.__lastSession;
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForURL(/\/login/, { timeout: 20000 });
    } catch {
      throw new Error(`/dashboard did not redirect to /login after logout (still at ${page.url()}); __session cookie ${session ? `still present (len ${session.value.length})` : "absent"}; last /api/auth/session response: ${JSON.stringify(lastSession)}`);
    }
    await collectCsp(page, "desktop");
  }, page);
} finally {
  await step("9. Cleanup: delete temp user via REST accounts:delete", async () => {
    if (!idToken) throw new Error("no idToken; nothing to delete");
    // idToken may have expired (1h) — refresh via a fresh sign-in if needed
    try {
      await idt("delete", { idToken });
    } catch (e) {
      const r = await idt("signInWithPassword", { email: EMAIL, password: PASSWORD, returnSecureToken: true });
      await idt("delete", { idToken: r.idToken });
    }
  });
  await browser.close().catch(() => {});
}

// ---------- report ----------
console.log("\n==== E2E SMOKE REPORT ====");
const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n        ${r.error.split("\n")[0]}${r.url ? `\n        at ${r.url}` : ""}${r.shot ? `\n        screenshot ${r.shot}` : ""}`}`);
console.log(`\n${passed}/${results.length} steps passed`);
console.log(`\nConsole errors/CSP warnings (${consoleErrors.length}):`);
for (const c of consoleErrors) console.log(`  [${c.label} | ${c.step}] ${c.url}\n    ${c.type}: ${c.text.replace(/\s+/g, " ")}`);
console.log(`\nPage errors (${pageErrors.length}):`);
for (const c of pageErrors) console.log(`  [${c.label} | ${c.step}] ${c.url}\n    ${c.text.replace(/\s+/g, " ")}`);
console.log(`\nCSP violations (${cspViolations.length}):`);
for (const c of cspViolations) console.log(`  [${c.label} | ${c.step}] ${c.page}\n    directive=${c.directive} blockedURI=${c.blockedURI} disposition=${c.disposition}${c.sourceFile ? ` source=${c.sourceFile}:${c.line}:${c.col}` : ""}${c.sample ? ` sample=${c.sample}` : ""}`);
console.log(`\nFirestore docs left behind (best effort, not deleted): users/${uid ?? "?"} and subcollections (daily, quizResults, reviews, ...)`);
fs.writeFileSync(path.join(ART, "report.json"), JSON.stringify({ email: EMAIL, uid, results, consoleErrors, pageErrors, cspViolations }, null, 2));
process.exit(passed === results.length ? 0 : 1);
