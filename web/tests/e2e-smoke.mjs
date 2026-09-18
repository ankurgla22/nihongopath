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
  const ctx = await browser.newContext({ viewport, locale: "en-US", hasTouch: viewport.width < 600 });
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

/** Drive a QuizRunner (practice mode) inside `scope`: answer every question with key "1", wait for the
 *  result screen and the save callout. Returns { score, total, wrong }. */
async function runQuizRunner(page, scope, { requireSaved = true, timeoutFirst = 40000 } = {}) {
  const options = scope.getByRole("radiogroup", { name: "Answer options" });
  await options.waitFor({ timeout: timeoutFirst });
  const progress = scope.getByRole("progressbar", { name: "Quiz progress" });
  const total = Number(await progress.getAttribute("aria-valuemax"));
  if (!total) throw new Error("Quiz total not found");
  for (let i = 0; i < total; i++) {
    await options.waitFor({ timeout: 15000 });
    await page.locator("body").focus().catch(() => {});
    await page.keyboard.press("1");
    let chosen = await options.locator("[role='radio'][aria-checked='true']").count();
    if (!chosen) {
      await options.locator("[role='radio']").first().click();
      chosen = await options.locator("[role='radio'][aria-checked='true']").count();
    }
    if (!chosen) throw new Error(`Question ${i + 1}: option 1 could not be selected`);
    const adv = scope.getByRole("button", { name: /^(Next question|Finish)$/ });
    await adv.waitFor();
    const label = (await adv.innerText()).trim();
    await adv.click();
    if (label === "Finish") break;
  }
  const result = scope.locator("[role='status'][aria-live='polite']");
  await result.waitFor({ timeout: 30000 });
  const txt = await result.innerText();
  const m = txt.match(/(\d+)\s*\n?\s*of\s+(\d+)/);
  if (!m) throw new Error(`Result screen does not show a score. Text: ${txt.slice(0, 200)}`);
  await page.getByText(/Saving your result/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await expectNoOfflineWarning(page);
  const warn = page.getByText(/Could not save|Could not load the questions|Could not build the drill/i);
  if (await warn.count()) throw new Error(`Warning shown: ${await warn.first().innerText()}`);
  if (requireSaved && !(await page.getByText(/Result saved\./).count())) {
    const callout = await result.innerText().catch(() => "");
    throw new Error(`"Result saved." callout not shown after the quiz. Result text: ${callout.slice(0, 200).replace(/\s+/g, " ")}`);
  }
  return { score: Number(m[1]), total: Number(m[2]), wrong: Number(m[2]) - Number(m[1]) };
}

/** Answer every question of a QuestionSet (reading/listening/lesson "Quick check" style, radio inputs) with option 1. */
async function answerQuestionSet(page, scope) {
  const names = await scope.locator("input[type='radio']").evaluateAll((els) => [...new Set(els.map((e) => e.name))]);
  if (names.length === 0) throw new Error("No radio questions rendered");
  const counter = (k) => scope.getByText(new RegExp(`^${k} / ${names.length} answered`));
  // Wait for hydration: the "0 / N answered" counter is only rendered by the client component.
  await counter(0).waitFor({ timeout: 10000 }).catch(() => {});
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    // The `has` inner locator must be page-rooted: Playwright re-roots it inside each candidate
    // label, so a scope-rooted (`main`) chain would look for <main> inside the label and never match.
    const radio = page.locator(`input[type='radio'][name='${n}']`).first();
    const label = scope.locator("label").filter({ has: radio }).first();
    // A click that lands before React attaches its handlers checks the native radio without
    // updating state; retry until the component's own counter reflects the answer.
    // The counter is hidden once every question is answered; on the last question wait for the
    // Check button to enable instead (it is disabled until allAnswered).
    const last = i === names.length - 1;
    const registered = () =>
      last
        ? scope.getByRole("button", { name: /^Check answers$/ }).and(scope.locator(":enabled")).waitFor({ timeout: 2000 })
        : counter(i + 1).waitFor({ timeout: 2000 });
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      await label.click();
      ok = await registered().then(() => true).catch(() => false);
    }
    if (!ok) throw new Error(`Question "${n}": answer did not register after 3 clicks (radio checked: ${await radio.isChecked()})`);
  }
  return names.length;
}

async function waitSettled(page) {
  await page.waitForLoadState("load");
  for (let i = 0, last = page.__navs; i < 10; i++) {
    await page.waitForTimeout(3000);
    if (page.__navs === last) break;
    last = page.__navs;
  }
}

/** Expand the vocabulary task on /daily-study and return its panel locator. */
async function openVocabTask(page) {
  const tasks = page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']");
  await tasks.first().waitFor({ timeout: 30000 });
  let task = tasks.filter({ has: page.locator("button[aria-expanded]").filter({ hasText: /vocab/i }) }).first();
  if (!(await task.count())) {
    // fall back: expand tasks until one offers the drill button
    const n = await tasks.count();
    for (let i = 0; i < n; i++) {
      const t = tasks.nth(i);
      const h = t.locator("button[aria-expanded]").first();
      if ((await h.getAttribute("aria-expanded")) !== "true") await h.click();
      if (await t.getByRole("button", { name: /Drill these words/ }).count()) {
        task = t;
        break;
      }
    }
  }
  if (!(await task.count())) throw new Error("Vocabulary task not found on the day");
  const header = task.locator("button[aria-expanded]").first();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  const panel = task.locator("[id^='panel-']");
  await panel.waitFor();
  return panel;
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
let dailyDrill = null; // { score, total, wrong } from the Day 12 vocabulary drill
const drillScores = {};
const N1 = { grammar: null, reading: null, listening: null, vocab: null }; // first slugs, discovered from the index pages
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

  // ---------- new features: day jump + on-demand drills, review queue, /tests drills ----------
  await step("10a. Daily study: Jump to Day 12, vocabulary task -> Drill these words, answer all, saved", async () => {
    await page.goto(`${BASE}/daily-study`, { waitUntil: "domcontentloaded" });
    await page.getByRole("list", { name: "Today's tasks" }).locator("li[id^='task-']").first().waitFor({ timeout: 30000 });
    const input = page.locator("#jump-day");
    await input.waitFor();
    await input.fill("12");
    await page.getByRole("button", { name: /^Go$/ }).click();
    await page.waitForURL(/\/daily-study\?day=12/, { timeout: 20000 }).catch(() => {});
    await page.getByText(/^Day\s+12\s*\/\s*\d+/).first().waitFor({ timeout: 30000 }).catch(async () => {
      const notice = await page.locator("main").getByText(/Could not change the day|Saved offline|permission/i).allInnerTexts().catch(() => []);
      throw new Error(`Day 12 heading not shown after "Jump to a day" (at ${page.url()}). Notices: ${JSON.stringify(notice)}`);
    });
    await waitSettled(page);
    const panel = await openVocabTask(page);
    await panel.getByRole("button", { name: /Drill these words/ }).click();
    dailyDrill = await runQuizRunner(page, panel);
    console.log(`      day-12 vocabulary drill score ${dailyDrill.score}/${dailyDrill.total}`);
    await collectCsp(page, "desktop");
  }, page);

  await step("10b. /review: due items from the drill; Start review session loads questions", async () => {
    await page.goto(`${BASE}/review`, { waitUntil: "domcontentloaded" });
    await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const heading = page.locator("h2").filter({ hasText: /(\d+) items? to review|Nothing due right now|Preparing your session/ }).first();
    await heading.waitFor({ timeout: 20000 });
    await page.locator("h2").filter({ hasText: /Preparing your session/ }).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const h = await heading.innerText();
    const m = h.match(/(\d+) items? to review/);
    const due = m ? Number(m[1]) : 0;
    const expectedWrong = dailyDrill?.wrong ?? 0;
    // Wrong answers are scheduled by the SRS for TOMORROW (interval 1 day), so right after a drill
    // nothing is due today; they must appear as "From mistakes" and in the "N tomorrow" hint instead.
    const mainText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const missed = Number((mainText.match(/From mistakes\s*(\d+)/) ?? [])[1] ?? 0);
    const tomorrow = Number((mainText.match(/(\d+) tomorrow/) ?? [])[1] ?? 0);
    if (expectedWrong > 0 && due === 0 && missed === 0 && tomorrow === 0) {
      throw new Error(`Drill had ${expectedWrong} wrong answers but /review shows neither due items, "From mistakes", nor a "tomorrow" count ("${h}")`);
    }
    console.log(`      /review: ${h}; from mistakes ${missed}; due tomorrow ${tomorrow}`);
    if (due > 0) {
      await page.getByRole("button", { name: /Start review session/ }).click();
      await page.locator("main").getByRole("radiogroup", { name: "Answer options" }).waitFor({ timeout: 40000 }).catch(async () => {
        const w = await page.locator("main").getByText(/Could not|Saved offline/i).allInnerTexts().catch(() => []);
        throw new Error(`Review session did not show a first question. Notices: ${JSON.stringify(w)}`);
      });
    } else {
      console.log("      nothing due today (as designed); session start skipped");
    }
    await collectCsp(page, "desktop");
  }, page);

  await step("10c. /tests: Vocabulary drill and Kanji drill run to a result and save", async () => {
    await page.goto(`${BASE}/tests`, { waitUntil: "domcontentloaded" });
    const main = page.locator("main");
    for (const label of ["Vocabulary drill", "Kanji drill"]) {
      const btn = main.getByRole("button", { name: new RegExp(`^${label}`) });
      await btn.waitFor({ timeout: 20000 });
      await page.waitForFunction((el) => !el.disabled, await btn.elementHandle(), { timeout: 20000 });
      await btn.click();
      const r = await runQuizRunner(page, main);
      drillScores[label] = r;
      console.log(`      ${label}: ${r.score}/${r.total}`);
      await main.getByRole("button", { name: /Back to tests/ }).click();
      await main.locator("h2").filter({ hasText: /^Drills$/ }).waitFor({ timeout: 10000 });
    }
    await collectCsp(page, "desktop");
  }, page);

  await step("10d. /tests/history lists the Vocabulary and Kanji drill results", async () => {
    await page.goto(`${BASE}/tests/history`, { waitUntil: "domcontentloaded" });
    await page.locator("[aria-busy='true']").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const list = page.getByRole("list", { name: "Quiz results" });
    await list.waitFor({ timeout: 20000 });
    const titles = await list.locator("h3").allInnerTexts();
    for (const label of ["Vocabulary drill", "Kanji drill"]) {
      if (!titles.some((t) => t.startsWith(label))) throw new Error(`"${label}" not listed. Titles: ${JSON.stringify(titles)}`);
    }
    console.log(`      history titles: ${titles.join(" | ")}`);
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

  // ---------- N1 public content ----------
  await step("11a. /japanese/n1 renders and links grammar/reading/listening/vocabulary", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const h1 = await page.locator("h1").first().innerText();
    if (!/N1/.test(h1)) throw new Error(`Unexpected h1 "${h1}"`);
    for (const sec of ["grammar", "reading", "listening", "vocabulary", "kanji", "mock-exams"]) {
      if (!(await page.locator(`main a[href='/japanese/n1/${sec}']`).count())) throw new Error(`No link to /japanese/n1/${sec}`);
    }
    // discover first slugs
    const firstSlug = async (sec) => {
      await page.goto(`${BASE}/japanese/n1/${sec}`, { waitUntil: "domcontentloaded" });
      const hrefs = await page.locator(`main a[href^='/japanese/n1/${sec}/']`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      const first = hrefs.find((h) => !/\/page\/\d+$/.test(h));
      if (!first) throw new Error(`No item links on /japanese/n1/${sec}`);
      return first.split("/").pop();
    };
    N1.grammar = await firstSlug("grammar");
    N1.reading = await firstSlug("reading");
    N1.listening = await firstSlug("listening");
    N1.vocab = await firstSlug("vocabulary");
    console.log(`      first slugs: grammar=${N1.grammar} reading=${N1.reading} listening=${N1.listening} vocab=${N1.vocab}`);
    await collectCsp(page, "desktop");
  }, page);

  await step("11b. /japanese/n1/grammar/<first>: lesson renders; mini-quiz question 1 answerable", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1/grammar/${N1.grammar}`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const quiz = page.locator("ol[aria-label='Answer options']").first();
    if (!(await quiz.count())) throw new Error("No 'Test yourself' quiz (ol[aria-label='Answer options']) on the N1 grammar lesson");
    await quiz.scrollIntoViewIfNeeded();
    const opt = quiz.locator("button[aria-pressed]").first();
    await opt.click();
    await page.waitForTimeout(400);
    if ((await opt.getAttribute("aria-pressed")) !== "true") throw new Error("Mini quiz option 1 did not become selected");
    await page.locator("[role='status']").filter({ hasText: /Correct|Not quite/ }).first().waitFor({ timeout: 10000 });
    await collectCsp(page, "desktop");
  }, page);

  await step("11c. N1 vocabulary detail: 'Quick check' renders and question 1 can be answered", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1/vocabulary/${N1.vocab}`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const heading = page.locator("h2, h3").filter({ hasText: /^Quick check$/ }).first();
    if (!(await heading.count())) throw new Error("'Quick check' heading not rendered on the vocabulary page");
    const quiz = page.locator("ol[aria-label='Answer options']").first();
    await quiz.waitFor({ timeout: 10000 });
    await quiz.scrollIntoViewIfNeeded();
    const opt = quiz.locator("button[aria-pressed]").first();
    await opt.click();
    await page.waitForTimeout(400);
    if ((await opt.getAttribute("aria-pressed")) !== "true") throw new Error("Quick check option 1 did not become selected");
    await page.locator("[role='status']").filter({ hasText: /Correct|Not quite/ }).first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Next question|See result/ }).first().waitFor();
    await collectCsp(page, "desktop");
  }, page);

  await step("11d. /japanese/n1/reading/<first>: start timer, answer, check", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1/reading/${N1.reading}`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const timer = page.getByRole("group", { name: "Reading timer" });
    await timer.waitFor();
    await timer.getByRole("button", { name: /Start timer/ }).click();
    await timer.getByRole("button", { name: /Pause timer/ }).waitFor({ timeout: 5000 });
    const main = page.locator("main");
    const n = await answerQuestionSet(page, main);
    await main.getByRole("button", { name: /^Check answers$/ }).click();
    await main.locator("[aria-live='polite']").filter({ hasText: /Correct\.|Not quite/ }).first().waitFor({ timeout: 10000 });
    await main.locator("[role='status']").filter({ hasText: /Within the target|Over the target/ }).first().waitFor({ timeout: 10000 });
    console.log(`      reading: ${n} questions answered and checked`);
    await collectCsp(page, "desktop");
  }, page);

  await step("11e. /japanese/n1/listening/<first>: Listen -> Answer -> Check", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1/listening/${N1.listening}`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const nav = page.getByRole("navigation", { name: "Listening steps" });
    const current = async () => (await nav.locator("button[aria-current='step']").first().innerText()).replace(/\s+/g, " ").trim();
    if (!/Listen/.test(await current())) throw new Error(`Initial step is "${await current()}", expected Listen`);
    await page.getByRole("button", { name: /I have listened/ }).click();
    if (!/Answer/.test(await current())) throw new Error(`After "I have listened" step is "${await current()}", expected Answer`);
    const main = page.locator("main");
    const n = await answerQuestionSet(page, main);
    await main.getByRole("button", { name: /^Check answers$/ }).click();
    await page.waitForTimeout(400);
    if (!/Check/.test(await current())) throw new Error(`After "Check answers" step is "${await current()}", expected Check`);
    await main.locator("[aria-live='polite']").filter({ hasText: /Correct\.|Not quite/ }).first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Read the transcript/ }).waitFor({ timeout: 5000 });
    console.log(`      listening: ${n} questions answered and checked`);
    await collectCsp(page, "desktop");
  }, page);

  await step("11f. /japanese/n1/mock-exams lists 3 exams; /mock-exams/n1-mock-c start screen (logged in)", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1/mock-exams`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const hrefs = await page.locator("main a[href^='/mock-exams/n1-mock-']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    if (hrefs.length !== 3) throw new Error(`Expected 3 N1 mock exams, found ${hrefs.length}: ${hrefs.join(", ")}`);
    await page.goto(`${BASE}/mock-exams/n1-mock-c`, { waitUntil: "domcontentloaded" });
    if (/\/login/.test(page.url())) throw new Error("Redirected to /login although logged in");
    await page.getByRole("button", { name: /^Start (full exam|a new attempt|.+)$/ }).first().waitFor({ timeout: 20000 });
    if (!(await page.getByText(/N1/).first().count())) throw new Error("Exam title (N1) not shown");
    await collectCsp(page, "desktop");
  }, page);

  await step("11g. /japanese/n1/vocabulary/page/2 renders", async () => {
    const resp = await page.goto(`${BASE}/japanese/n1/vocabulary/page/2`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await page.locator("h1").first().waitFor();
    const n = await page.locator("main a[href^='/japanese/n1/vocabulary/']:not([href*='/page/'])").count();
    if (n === 0) throw new Error("No vocabulary links rendered");
    await collectCsp(page, "desktop");
  }, page);

  // ---------- mobile pass (separate context, fresh login) ----------
  const m = await newContext(browser, { width: 390, height: 844 }, "mobile");
  await step("M. Mobile 390x844: login, dashboard, daily-study, lesson, mock start", async () => {
    await loginViaUI(m.page, EMAIL, PASSWORD);
    // (the user was moved to Day 12 in step 10a, so any day number is accepted here)
    await m.page.getByText(/^Day\s+\d+\s*\/\s*\d+/).first().waitFor({ timeout: 20000 });
    const noHScroll = async (label) => {
      const over = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 2) throw new Error(`${label}: horizontal overflow of ${over}px at 390px width`);
    };
    m.noHScroll = noHScroll;
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

  await step("M2. Mobile: /japanese/n1/kanji renders 600 tiles, no horizontal overflow, loads under 3 s", async () => {
    const t0 = Date.now();
    const resp = await m.page.goto(`${BASE}/japanese/n1/kanji`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
    await m.page.locator("h1").first().waitFor();
    await m.page.waitForLoadState("load");
    const ms = Date.now() - t0;
    const hrefs = await m.page.locator("main a[href^='/japanese/n1/kanji/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    console.log(`      loaded in ${ms} ms, ${hrefs.length} unique kanji links`);
    if (hrefs.length !== 600) throw new Error(`Expected 600 kanji tiles, found ${hrefs.length}`);
    const noHScroll = m.noHScroll ?? (async (label) => {
      const over = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 2) throw new Error(`${label}: horizontal overflow of ${over}px at 390px width`);
    });
    await noHScroll("/japanese/n1/kanji");
    if (ms > 3000) throw new Error(`Page took ${ms} ms to load (limit 3000 ms)`);
    await collectCsp(m.page, "mobile");
  }, m.page);

  await step("M3. Mobile: /daily-study Day 12 'Drill these words' visible in viewport and tappable", async () => {
    await m.page.goto(`${BASE}/daily-study`, { waitUntil: "domcontentloaded" });
    await m.page.getByText(/^Day\s+12\s*\/\s*\d+/).first().waitFor({ timeout: 30000 }).catch(async () => {
      throw new Error(`Day 12 not shown on mobile /daily-study (at ${m.page.url()})`);
    });
    await waitSettled(m.page);
    const panel = await openVocabTask(m.page);
    const btn = panel.getByRole("button", { name: /Drill these words/ });
    await btn.scrollIntoViewIfNeeded();
    if (!(await btn.isVisible())) throw new Error("Drill button not visible");
    const box = await btn.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 390) throw new Error(`Drill button outside the 390px viewport: ${JSON.stringify(box)}`);
    const noHScroll = m.noHScroll;
    if (noHScroll) await noHScroll("/daily-study (Day 12, task expanded)");
    await btn.tap();
    await panel.getByRole("radiogroup", { name: "Answer options" }).waitFor({ timeout: 40000 }).catch(async () => {
      const w = await m.page.locator("main").getByText(/Could not|Saved offline/i).allInnerTexts().catch(() => []);
      throw new Error(`Drill did not show a first question after tap. Notices: ${JSON.stringify(w)}`);
    });
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
