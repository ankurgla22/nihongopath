/**
 * What to improve next, from Google Analytics: pulls the reports that matter with bot traffic
 * left out, and ends with a ranked list of findings.
 *
 *   npm run ga:report                            # last 28 days, compared with the 28 before
 *   npm run ga:report -- --days 7
 *   npm run ga:report -- --out report.md         # also write the report to a file
 *
 * "Bots" are sessions from cloud data-centre cities (DATACENTER_CITIES in ga-client.mjs), plus any
 * city whose 5+ sessions average under 2s of engagement (detectBotCities). Real visitors in those
 * cities are dropped with them, an acceptable loss at this size. Thresholds below are tuned for a small site: a
 * finding needs a handful of sessions, not statistical significance, so read them as leads.
 */
import fs from "node:fs";
import { DATACENTER_CITIES, KEY_EVENTS, findProperty, runReport } from "./ga-client.mjs";

const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const DAYS = Number(opt("--days") ?? 28);
const OUT = opt("--out");

const CURRENT = { startDate: `${DAYS}daysAgo`, endDate: "yesterday", name: "current" };
const PREVIOUS = { startDate: `${DAYS * 2}daysAgo`, endDate: `${DAYS + 1}daysAgo`, name: "previous" };

// ---------- filters ----------

// Grows with detectBotCities() before the reports run.
const botCities = [...DATACENTER_CITIES];
const cityIn = () => ({ filter: { fieldName: "city", inListFilter: { values: botCities } } });
let notBot = { notExpression: cityIn() };
let onlyBot = cityIn();
const and = (...exprs) => ({ andGroup: { expressions: exprs.filter(Boolean) } });
const eventIs = (...names) => ({ filter: { fieldName: "eventName", inListFilter: { values: names } } });

// ---------- formatting ----------

const lines = [];
const out = (s = "") => lines.push(s);
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "–");
const secs = (x) => (Number.isFinite(x) ? `${Math.round(x)}s` : "–");
const delta = (now, before) => (before > 0 ? ` (${now >= before ? "+" : ""}${Math.round(((now - before) / before) * 100)}%)` : before === 0 && now > 0 ? " (new)" : "");
function table(headers, rows) {
  if (rows.length === 0) return out("_No data yet._\n");
  out(`| ${headers.join(" | ")} |`);
  out(`|${headers.map((h, i) => (i === 0 ? "---" : "--:")).join("|")}|`);
  for (const r of rows) out(`| ${r.join(" | ")} |`);
  out();
}
const short = (p, n = 60) => (p.length > n ? `${p.slice(0, n - 1)}…` : p);

// ---------- findings ----------

/** severity 3 = fix first. */
const findings = [];
const find = (severity, area, text) => findings.push({ severity, area, text });

// ---------- reports ----------

/**
 * Bots outside the known data-centre list: a city with several sessions and not one engaged is a
 * scheduled crawler or monitor, not people (one in Wah loaded the hiragana page daily for a month
 * at 0s, and read as the site's most loyal learner).
 */
async function detectBotCities(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "city" }],
    metrics: [{ name: "sessions" }, { name: "userEngagementDuration" }],
    dimensionFilter: notBot,
  });
  // Time, not engagedSessions: GA counts a two-page-view session as engaged even at 0 seconds.
  const found = rows.filter((r) => r.sessions >= 5 && r.userEngagementDuration / r.sessions < 2 && r.city !== "(not set)");
  if (found.length === 0) return;
  botCities.push(...found.map((r) => r.city));
  notBot = { notExpression: cityIn() };
  onlyBot = cityIn();
  out(`Also left out as bots — 5+ sessions averaging under 2s: ${found.map((r) => `${r.city} (${r.sessions})`).join(", ")}.\n`);
}

async function overview(property) {
  const metrics = ["activeUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "userEngagementDuration", "screenPageViews", "keyEvents"].map((name) => ({ name }));
  const [human, bots] = await Promise.all([
    runReport(property, { dateRanges: [CURRENT, PREVIOUS], metrics, dimensionFilter: notBot }),
    runReport(property, { dateRanges: [CURRENT], metrics: [{ name: "activeUsers" }, { name: "sessions" }], dimensionFilter: onlyBot }),
  ]);
  const cur = human.find((r) => r.dateRange === "current") ?? human[0] ?? {};
  const prev = human.find((r) => r.dateRange === "previous") ?? {};
  const bot = bots[0] ?? { activeUsers: 0, sessions: 0 };
  const perSession = (r) => (r.sessions ? r.userEngagementDuration / r.sessions : NaN);
  const returning = (r) => (r.activeUsers ? (r.activeUsers - r.newUsers) / r.activeUsers : NaN);

  out(`## Overview — real visitors, last ${DAYS} days vs the ${DAYS} before\n`);
  table(
    ["Metric", "Now", "Before"],
    [
      ["Users", `${cur.activeUsers ?? 0}${delta(cur.activeUsers ?? 0, prev.activeUsers ?? 0)}`, prev.activeUsers ?? 0],
      ["Sessions", `${cur.sessions ?? 0}${delta(cur.sessions ?? 0, prev.sessions ?? 0)}`, prev.sessions ?? 0],
      ["Page views", cur.screenPageViews ?? 0, prev.screenPageViews ?? 0],
      ["Engaged sessions", pct(cur.engagementRate), pct(prev.engagementRate)],
      ["Engagement per session", secs(perSession(cur)), secs(perSession(prev))],
      ["Returning users", pct(returning(cur)), pct(returning(prev))],
      ["Key events", cur.keyEvents ?? 0, prev.keyEvents ?? 0],
    ]
  );
  const total = (cur.activeUsers ?? 0) + bot.activeUsers;
  out(`Bots left out: **${bot.activeUsers} users / ${bot.sessions} sessions** (${pct(total ? bot.activeUsers / total : 0)} of all users GA reports).\n`);

  if (total && bot.activeUsers / total > 0.5) find(1, "Data", `${pct(bot.activeUsers / total)} of GA users are bots. Read GA's headline numbers through this report, or add a city-exclusion comparison in GA.`);
  if (cur.engagementRate < 0.4) find(2, "Engagement", `Only ${pct(cur.engagementRate)} of real sessions are engaged (10s+, 2+ pages, or a key event). See the landing-page table for where visitors leave.`);
  if (returning(cur) < 0.1 && cur.activeUsers >= 20) find(2, "Retention", `${pct(returning(cur))} of users come back. Give a reason to return: sign-up prompt after a quiz, daily plan, or a "next lesson" link at the end of every page.`);
  if ((cur.keyEvents ?? 0) === 0) find(1, "Conversions", "No key events recorded for real visitors yet. If the tracking deploy is recent this is expected; otherwise check quiz and sign-up pages.");
  return cur;
}

async function channels(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }, { name: "userEngagementDuration" }, { name: "keyEvents" }],
    dimensionFilter: notBot,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 15,
  });
  out("## Where real visitors come from\n");
  table(
    ["Source / medium", "Sessions", "Users", "Engaged", "Time/session", "Key events"],
    rows.map((r) => [r.sessionSourceMedium, r.sessions, r.activeUsers, pct(r.engagementRate), secs(r.userEngagementDuration / r.sessions), r.keyEvents])
  );
  const search = rows.filter((r) => /organic|ai-assistant|chatgpt|perplexity|copilot|gemini/.test(r.sessionSourceMedium)).reduce((a, r) => a + r.sessions, 0);
  const all = rows.reduce((a, r) => a + r.sessions, 0);
  const direct = rows.find((r) => r.sessionSourceMedium === "(direct) / (none)");
  if (all && search / all < 0.3) find(2, "Acquisition", `Search and AI assistants bring ${pct(search / all)} of sessions (${search}). Growth depends on search: see "Organic landing pages" for what already ranks and write more of it.`);
  if (direct && direct.engagementRate < 0.25 && direct.sessions >= 10) find(1, "Data", `"Direct" traffic is ${direct.sessions} sessions at ${pct(direct.engagementRate)} engaged: much of it is likely undetected bots, not people typing the URL.`);
  for (const r of rows) {
    if (/chatgpt|ai-assistant|perplexity|copilot/.test(r.sessionSourceMedium) && r.sessions >= 3)
      find(1, "Acquisition", `AI assistants already send traffic (${r.sessionSourceMedium}: ${r.sessions} sessions, ${pct(r.engagementRate)} engaged). Keep llms.txt current and answer questions directly at the top of pages.`);
  }
}

async function landingPages(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "landingPage" }],
    metrics: [{ name: "sessions" }, { name: "bounceRate" }, { name: "userEngagementDuration" }, { name: "keyEvents" }],
    dimensionFilter: notBot,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
  });
  out("## Landing pages — the first page of a visit\n");
  table(
    ["Landing page", "Sessions", "Bounce", "Time/session", "Key events"],
    rows.map((r) => [short(r.landingPage), r.sessions, pct(r.bounceRate), secs(r.userEngagementDuration / r.sessions), r.keyEvents])
  );
  for (const r of rows) {
    if (r.landingPage === "(not set)" || r.sessions < 4) continue;
    if (r.bounceRate >= 0.7)
      find(3, "Landing page", `${r.landingPage}: ${r.sessions} sessions start here and ${pct(r.bounceRate)} leave without engaging. Check that the first screen answers what the visitor searched for and offers an obvious next step (quiz, next lesson).`);
  }
}

async function organicLanding(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "landingPage" }, { name: "sessionSource" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }],
    dimensionFilter: and(notBot, { filter: { fieldName: "sessionMedium", inListFilter: { values: ["organic", "ai-assistant", "referral"] } } }),
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
  });
  const fromSearch = rows.filter((r) => !/nihongopath/.test(r.sessionSource));
  out("## Organic landing pages — what search engines and AI assistants send people to\n");
  table(
    ["Landing page", "Source", "Sessions", "Engaged"],
    fromSearch.map((r) => [short(r.landingPage), r.sessionSource, r.sessions, pct(r.engagementRate)])
  );
  const bySection = new Map();
  for (const r of fromSearch) {
    const k = contentType(r.landingPage);
    if (k) bySection.set(k, (bySection.get(k) ?? 0) + r.sessions);
  }
  const top = [...bySection].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3) find(1, "Content", `Search traffic lands most on ${top[0]} (${top[1]} sessions). That is the content type search already rewards: prioritise more pages like it and link them together.`);
}

/** "vocabulary pages", "grammar comparison pages"…; null for the home page and other non-lesson pages. */
function contentType(p) {
  const parts = p.split("?")[0].split("/").filter(Boolean);
  if (parts[0] !== "japanese" || parts.length < 4) return parts[0] === "japanese" && parts.length >= 2 ? (parts[1] === "foundation" ? "foundation pages" : "level hub pages") : null;
  return parts[3] === "compare" ? `${parts[2]} comparison pages` : `${parts[2]} pages`;
}

/** Groups a path into a content section: /japanese/n2/vocabulary/foo → /japanese/n2/vocabulary. */
function section(p) {
  const parts = p.split("?")[0].split("/").filter(Boolean);
  if (parts[0] === "japanese") return "/" + parts.slice(0, Math.min(parts.length, parts[1] === "foundation" ? 2 : 3)).join("/");
  return "/" + parts.slice(0, 1).join("/");
}

async function pages(property) {
  const [views, scrolls] = await Promise.all([
    runReport(property, {
      dateRanges: [CURRENT],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "userEngagementDuration" }],
      dimensionFilter: notBot,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 500,
    }),
    // Enhanced measurement sends `scroll` once per page when the visitor reaches 90% depth.
    runReport(property, {
      dateRanges: [CURRENT],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: and(notBot, eventIs("scroll")),
      limit: 500,
    }),
  ]);
  const scrolled = new Map(scrolls.map((r) => [r.pagePath, r.eventCount]));
  // GA has recorded no scroll event at all so far; a column of 0% would read as "nobody finishes".
  const hasDepth = scrolls.length > 0;
  const top = views.slice(0, 20);
  out("## Pages — time spent" + (hasDepth ? " and how many readers reach the end" : "") + "\n");
  table(
    ["Page", "Views", "Users", "Time/view", ...(hasDepth ? ["Read to 90%"] : [])],
    top.map((r) => [short(r.pagePath), r.screenPageViews, r.activeUsers, secs(r.userEngagementDuration / r.screenPageViews), ...(hasDepth ? [pct((scrolled.get(r.pagePath) ?? 0) / r.screenPageViews)] : [])])
  );
  for (const r of views) {
    if (r.screenPageViews < 5) continue;
    const t = r.userEngagementDuration / r.screenPageViews;
    const depth = (scrolled.get(r.pagePath) ?? 0) / r.screenPageViews;
    const isLesson = /^\/japanese\/.+\/.+/.test(r.pagePath);
    if (isLesson && t < 15) find(2, "Page", `${r.pagePath}: ${r.screenPageViews} views but ${secs(t)} per view, too short to study a lesson. The page may not match what brought people in, or loads slowly on mobile.`);
    if (hasDepth && isLesson && depth < 0.15 && t >= 15) find(1, "Page", `${r.pagePath}: readers stay ${secs(t)} but only ${pct(depth)} reach the end. Move the quiz or "next lesson" link higher, or split the page.`);
    // Repeat views only mean something when they are read; zero-second repeats are automation.
    if (t >= 15 && r.screenPageViews / Math.max(1, r.activeUsers) >= 4) find(1, "Page", `${r.pagePath}: ${(r.screenPageViews / r.activeUsers).toFixed(1)} views per user. People come back to it repeatedly; make it easy to reach (header link, dashboard shortcut) and consider a printable or offline version.`);
  }

  // Sections: which areas of the course get read at all.
  const bySection = new Map();
  for (const r of views) {
    const s = section(r.pagePath);
    const a = bySection.get(s) ?? { views: 0, secs: 0 };
    a.views += r.screenPageViews;
    a.secs += r.userEngagementDuration;
    bySection.set(s, a);
  }
  out("## Sections\n");
  table(
    ["Section", "Views", "Time/view"],
    [...bySection].sort((a, b) => b[1].views - a[1].views).slice(0, 15).map(([s, a]) => [s, a.views, secs(a.secs / a.views)])
  );
}

async function devices(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "engagementRate" }, { name: "userEngagementDuration" }],
    dimensionFilter: notBot,
  });
  out("## Devices\n");
  table(["Device", "Users", "Sessions", "Engaged", "Time/session"], rows.map((r) => [r.deviceCategory, r.activeUsers, r.sessions, pct(r.engagementRate), secs(r.userEngagementDuration / r.sessions)]));
  const m = rows.find((r) => r.deviceCategory === "mobile");
  const d = rows.find((r) => r.deviceCategory === "desktop");
  if (m && d && m.sessions >= 5 && d.sessions >= 5 && m.engagementRate < d.engagementRate * 0.7)
    find(2, "Mobile", `Mobile sessions are engaged ${pct(m.engagementRate)} of the time vs ${pct(d.engagementRate)} on desktop. Walk through a lesson and a quiz on a phone.`);
}

async function geography(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }, { name: "engagementRate" }],
    dimensionFilter: notBot,
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  });
  out("## Countries\n");
  table(["Country", "Users", "Engaged"], rows.map((r) => [r.country, r.activeUsers, pct(r.engagementRate)]));
}

async function funnel(property) {
  const names = ["quiz_start", "quiz_complete", "exercise_complete", "lesson_complete", "exam_complete", "sign_up", "login", "affiliate_click", "view_search_results"];
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    dimensionFilter: and(notBot, eventIs(...names)),
  });
  const get = (n) => rows.find((r) => r.eventName === n) ?? { eventCount: 0, totalUsers: 0 };
  out("## Learning actions\n");
  table(
    ["Event", "Count", "Users", "Key event"],
    names.map((n) => [n, get(n).eventCount, get(n).totalUsers, KEY_EVENTS.includes(n) ? "yes" : ""])
  );
  const start = get("quiz_start").totalUsers, done = get("quiz_complete").totalUsers, signup = get("sign_up").totalUsers;
  if (start >= 5 && done / start < 0.5) find(2, "Quiz", `Only ${pct(done / start)} of people who start a quiz finish it. Shorter rounds, or show progress and the payoff earlier.`);
  if (done >= 10 && signup / done < 0.05) find(2, "Sign-up", `${done} people finished a quiz but ${signup} signed up (${pct(signup / done)}). Offer saving the result / tracking progress on the quiz result screen.`);
}

async function searchTerms(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "searchTerm" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: and(notBot, eventIs("view_search_results")),
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 25,
  });
  out("## Site search — what visitors look for\n");
  table(["Search term", "Searches"], rows.filter((r) => r.searchTerm && r.searchTerm !== "(not set)").map((r) => [r.searchTerm, r.eventCount]));
  if (rows.length) find(1, "Content", `Visitors searched the site ${rows.reduce((a, r) => a + r.eventCount, 0)} times. Check the top terms return what they need; a term with no good result is a page to write.`);
}

async function notFound(property) {
  const rows = await runReport(property, {
    dateRanges: [CURRENT],
    dimensions: [{ name: "pagePath" }, { name: "pageReferrer" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: and(notBot, { filter: { fieldName: "pageTitle", stringFilter: { matchType: "BEGINS_WITH", value: "Page not found" } } }),
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 25,
  });
  out("## Broken links — views of the 404 page\n");
  table(["Missing path", "Came from", "Views"], rows.map((r) => [short(r.pagePath), short(r.pageReferrer || "(none)", 50), r.screenPageViews]));
  const internal = rows.filter((r) => /nihongopath\.app/.test(r.pageReferrer));
  for (const r of internal) find(3, "Broken link", `${r.pagePath} is a 404 linked from ${r.pageReferrer} (${r.screenPageViews} views). Fix the link or add a redirect.`);
  const external = rows.filter((r) => !/nihongopath\.app/.test(r.pageReferrer) && r.screenPageViews >= 2);
  for (const r of external) find(2, "Broken link", `${r.pagePath} gets ${r.screenPageViews} 404 views from outside (${r.pageReferrer || "direct"}). Add a redirect to the closest page.`);
}

// ---------- main ----------

const { property, name } = await findProperty();
out(`# ${name}: what to improve\n`);
out(`Property ${property}, last ${DAYS} days to yesterday. Bot traffic (data-centre cities, and cities whose sessions average under 2s) is left out of every table.\n`);

await detectBotCities(property);
await overview(property);
// Each section is independent; one failing (e.g. a dimension GA rejects) should not lose the rest.
for (const report of [channels, landingPages, organicLanding, pages, devices, geography, funnel, searchTerms, notFound]) {
  try {
    await report(property);
  } catch (e) {
    out(`## ${report.name}\n\n_Could not load: ${e.message}_\n`);
  }
}

const ranked = findings.sort((a, b) => b.severity - a.severity);
const body = lines.splice(0);
out(`# ${name}: what to improve\n`);
out(`Property ${property}, last ${DAYS} days to yesterday. Bot traffic (data-centre cities, and cities whose sessions average under 2s) is left out of every table.\n`);
out("## Findings, most important first\n");
if (ranked.length === 0) out("_Nothing stands out yet: too little data, or nothing crosses the thresholds._\n");
ranked.forEach((f, i) => out(`${i + 1}. ${"●".repeat(f.severity)}${"○".repeat(3 - f.severity)} **${f.area}** — ${f.text}`));
out();
lines.push(...body.slice(2));

const text = lines.join("\n");
console.log(text);
if (OUT) {
  fs.writeFileSync(OUT, text);
  console.error(`\nWritten to ${OUT}`);
}
