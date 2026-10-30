/**
 * How many real people visited, counted from App Hosting's edge request logs instead of GA. GA misses
 * visitors whose ad blocker stops its script, and counts bots that run JavaScript; the logs see every
 * request, so with the bots filtered out they give the better count.
 *
 *   npm run logs:visitors                          # last 30 days (all the log bucket keeps)
 *   npm run logs:visitors -- --days 7
 *   npm run logs:visitors -- --out visitors.md     # also write the report to a file
 *   npm run logs:visitors -- --exclude-ip 1.2.3.4  # leave out more of your own IPs (repeatable)
 *
 * A visitor is an IP whose browser loaded the site's stylesheet: crawlers that only read HTML never
 * do, so they never reach the count. Each one is then put in the first group that fits:
 *   own       this machine's public IP, or --exclude-ip
 *   bot       a bot user agent (Applebot, DotBot, Amazonbot…)
 *   cloud     the IP belongs to a cloud or hosting network (Tencent, AWS, Google Cloud…)
 *   crawl     more than CRAWL_PAGES distinct pages in a day with no referer
 *   spam      the referer is a referral-spam site (REFERRAL_SPAM), advertising itself in logs
 *   burst     arrived with no referer on a day when unusually many did (a scraper going through
 *             home-broadband proxies, as on 19–21 and 28–29 October 2026)
 *   referred  arrived from a search engine, an AI assistant or another site: real, with confidence
 *   direct    no referer, on an ordinary day: probably real (links in chat apps, typed URLs)
 *
 * Auth is the active gcloud account, which needs roles/logging.viewer on the project; override it
 * with LOGS_ACCOUNT. Network owners come from Team Cymru's public IP-to-ASN DNS service, so visitor
 * IPs are sent to it as DNS queries.
 */
import fs from "node:fs";
import dns from "node:dns/promises";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const DAYS = Number(opt("--days") ?? 30);
const OUT = opt("--out");
const PROJECT = process.env.LOGS_PROJECT ?? "opusify-japanese";
// Each page view also prefetches about a dozen header links, so a keen learner reaches 100+.
const CRAWL_PAGES = 300;

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|python|curl|wget|go-http|java\/|axios|node-fetch|scrapy|phantom|puppeteer|playwright|selenium|preview|facebookexternalhit|bytespider|gptbot|claude|perplexity|google-|apis-google|ahrefs|semrush|yandex|baidu|sogou/i;
const HOSTING_AS =
  /AMAZON|GOOGLE|MICROSOFT|TENCENT|ALIBABA|ALIYUN|HUAWEI|HWCLOUD|HWCSNET|DIGITALOCEAN|OVH|HETZNER|LINODE|AKAMAI|ORACLE|CLOUD|HOST|M247|COLOCROSSING|LOGICWEB|DATACAMP|CDNEXT|LATITUDE|LEASEWEB|VULTR|CHOOPA|CONTABO|IDC|APPLE-ENGINEERING|FACEBOOK|LEVEL3|NET3-AI|SERVER|DATACENTER|DATA CENTER|VPS|ZENLAYER|CDN77|PSYCHZ|QUADRANET|FRANTECH|IONOS|SCALEWAY|UCLOUD|KINGSOFT|BAIDU|BYTEDANCE|VOLCANO|CUSTDC|SPRIOUS|QUICKPACKET|WEB2OBJECTS/i;
const SEARCH = /google\.|bing\.com|duckduckgo|yahoo\.|yandex\.|baidu\.|naver\.|ecosia|brave\.com|startpage/;
const AI = /chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot\.microsoft|you\.com|phind/;
// Seen here: dataindex.pro (one page, from Moscow, Firefox 102). Add others as they turn up.
const REFERRAL_SPAM = /dataindex\.pro|semalt|darodar|buttons-for|best-seo|seo-offer|traffic2money/;
const ASSET =/\.(svg|png|jpe?g|webp|gif|ico|mp3|txt|xml|json|js|css|woff2?|webmanifest)(\?|$)|^\/(api|_next|__)\/|^\/(icon|apple-icon|opengraph-image)/;

// ---------- Cloud Logging ----------

const account = process.env.LOGS_ACCOUNT;
const token = execSync(`gcloud auth print-access-token${account ? ` --account=${account}` : ""}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const since = new Date(Date.now() - DAYS * 864e5).toISOString();
const EDGE = `logName="projects/${PROJECT}/logs/firebaseapphosting.googleapis.com%2Frequests" AND timestamp>="${since}"`;

async function entries(filter) {
  const out = [];
  let pageToken;
  do {
    const r = await fetch("https://logging.googleapis.com/v2/entries:list", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ resourceNames: [`projects/${PROJECT}`], filter: `${EDGE} AND (${filter})`, orderBy: "timestamp asc", pageSize: 1000, pageToken }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`entries:list → ${r.status} ${j.error?.message ?? ""}`);
    for (const e of j.entries ?? []) {
      const h = e.httpRequest ?? {};
      out.push({ ts: e.timestamp, ip: h.remoteIp, ua: h.userAgent ?? "", url: (h.requestUrl ?? "").replace(/^https?:\/\/[^/]+/, ""), ref: h.referer ?? "" });
    }
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

// ---------- IP → network (Team Cymru DNS) ----------

const asNames = {};
async function network(ip) {
  if (ip.includes(":")) {
    const nibbles = ip.split(":").map((g) => g.padStart(4, "0")).join("").slice(0, 16).split("").reverse().join(".");
    return lookup(`${nibbles}.origin6.asn.cymru.com`);
  }
  return lookup(`${ip.split(".").reverse().join(".")}.origin.asn.cymru.com`);
}
async function lookup(name) {
  try {
    const [asn, , cc] = (await dns.resolveTxt(name))[0][0].split("|").map((s) => s.trim());
    const n = asn.split(" ")[0];
    asNames[n] ??= dns.resolveTxt(`AS${n}.asn.cymru.com`).then((t) => t[0][0].split("|").pop().trim(), () => "?");
    return { as: await asNames[n], cc };
  } catch {
    return { as: "?", cc: "?" };
  }
}

// ---------- collect ----------

const own = new Set(argv.flatMap((a, i) => (argv[i - 1] === "--exclude-ip" ? [a] : [])));
try {
  own.add((await (await fetch("https://api.ipify.org")).text()).trim());
} catch {
  /* offline: rely on --exclude-ip */
}

console.error(`Reading edge logs since ${since.slice(0, 10)}…`);
const css = await entries(`httpRequest.requestUrl:"/_next/static/css/"`);
const visitors = new Map();
for (const e of css) {
  const v = visitors.get(e.ip) ?? { ip: e.ip, ua: new Set(), hits: [], firstSeen: e.ts };
  v.ua.add(e.ua);
  visitors.set(e.ip, v);
}
console.error(`${visitors.size} IPs loaded the stylesheet; looking up their networks…`);
const ips = [...visitors.keys()];
for (let i = 0; i < ips.length; i += 40) await Promise.all(ips.slice(i, i + 40).map(async (ip) => Object.assign(visitors.get(ip), await network(ip))));

// Page requests only for IPs that could still be people: the rest are already decided.
const group = (v) => (own.has(v.ip) ? "own" : BOT_UA.test([...v.ua].join(" ")) ? "bot" : HOSTING_AS.test(v.as) ? "cloud" : null);
const candidates = ips.filter((ip) => !group(visitors.get(ip)));
console.error(`Reading page requests for ${candidates.length} candidates…`);
for (let i = 0; i < candidates.length; i += 30) {
  const ipFilter = candidates.slice(i, i + 30).map((ip) => `httpRequest.remoteIp="${ip}"`).join(" OR ");
  for (const e of await entries(`NOT httpRequest.requestUrl:"/_next/" AND (${ipFilter})`)) visitors.get(e.ip)?.hits.push(e);
}

// ---------- classify ----------

const isDoc = (h) => !ASSET.test(h.url) && !h.url.includes("_rsc=");
const host = (u) => (u.match(/^https?:\/\/(?:www\.)?([^/]+)/) ?? [])[1] ?? "";
for (const v of visitors.values()) {
  const docs = v.hits.filter(isDoc);
  const landing = docs.find((h) => !host(h.ref).includes("nihongopath")) ?? docs[0];
  v.landing = landing?.url.split("?")[0] ?? "?";
  // No page request in the window when the page itself loaded just before it, or came from cache.
  v.day = (landing ?? v.hits[0] ?? { ts: v.firstSeen }).ts.slice(0, 10);
  const utm = landing?.url.match(/utm_source=([^&]+)/)?.[1];
  const ref = v.hits.map((h) => host(h.ref)).find((h) => h && !h.includes("nihongopath"));
  v.source = utm ? decodeURIComponent(utm).replace(/^www\./, "") : ref ?? null;
  const perDay = {};
  for (const h of v.hits) if (!ASSET.test(h.url)) (perDay[h.ts.slice(0, 10)] ??= new Set()).add(h.url.split("?")[0]);
  v.maxPagesPerDay = Math.max(0, ...Object.values(perDay).map((s) => s.size));
  v.days = new Set(v.hits.map((h) => h.ts.slice(0, 10))).size;
  const ua = [...v.ua].join(" ");
  v.device = /iPhone|iPad|Android|Mobile/.test(ua) ? "mobile" : "desktop";
  v.group = group(v) ?? (!v.source && v.maxPagesPerDay > CRAWL_PAGES ? "crawl" : null);
}

// A burst day: no-referer arrivals well above the usual level for this site.
const directByDay = {};
for (const v of visitors.values()) if (!v.group && !v.source) directByDay[v.day] = (directByDay[v.day] ?? 0) + 1;
const counts = Object.values(directByDay).sort((a, b) => a - b);
const median = counts[Math.floor(counts.length / 2)] ?? 0;
const burstAt = Math.max(8, median * 3);
const burstDays = Object.keys(directByDay).filter((d) => directByDay[d] >= burstAt).sort();
for (const v of visitors.values()) {
  if (v.group) continue;
  v.group = v.source && REFERRAL_SPAM.test(v.source) ? "spam" : v.source ? "referred" : burstDays.includes(v.day) ? "burst" : "direct";
}

// ---------- report ----------

const lines = [];
const out = (s = "") => lines.push(s);
const all = [...visitors.values()];
const of = (g) => all.filter((v) => v.group === g);
const people = all.filter((v) => v.group === "referred" || v.group === "direct");
const tally = (list, key) => Object.entries(list.reduce((m, v) => ((m[key(v)] = (m[key(v)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const sourceKind = (s) => (AI.test(s) ? "AI assistant" : SEARCH.test(s) ? "Search" : "Other site");

out(`# Real visitors from the edge logs`);
out();
out(`${PROJECT}, ${since.slice(0, 10)} to today (${DAYS} days). One visitor = one IP address whose browser loaded the page's stylesheet.`);
out();
out(`**${of("referred").length} confident** (arrived from search, an AI assistant or another site) + **${of("direct").length} probable** (no referer, ordinary day) = **${people.length} real visitors**, about ${(people.length / DAYS).toFixed(1)} a day.`);
out();
out(`| Group | Visitors | Real? |`);
out(`|---|--:|---|`);
const GROUPS = [
  ["own", "Your own IPs", "you"],
  ["bot", "Bot user agent", "no"],
  ["cloud", "Cloud / hosting network", "no"],
  ["crawl", `Over ${CRAWL_PAGES} pages a day, no referer`, "no"],
  ["spam", "Referral spam", "no"],
  ["burst",`No referer on a burst day (${burstDays.join(", ") || "none"})`, "no: scraper on home-broadband proxies"],
  ["referred", "From search, an AI assistant or another site", "**yes**"],
  ["direct", "No referer, ordinary day", "probably"],
];
for (const [g, label, real] of GROUPS) out(`| ${label} | ${of(g).length} | ${real} |`);
out(`| **All IPs that loaded a page** | **${all.length}** | |`);
out();

out(`## Where the confident visitors came from`);
out();
out(`| Source | Kind | Visitors |`);
out(`|---|---|--:|`);
for (const [s, n] of tally(of("referred"), (v) => v.source)) out(`| ${s} | ${sourceKind(s)} | ${n} |`);
out();

out(`## Real visitors by week`);
out();
out(`| Week starting | Confident | Probable |`);
out(`|---|--:|--:|`);
const week = (d) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
};
for (const w of [...new Set(people.map((v) => week(v.day)))].sort())
  out(`| ${w} | ${people.filter((v) => week(v.day) === w && v.group === "referred").length} | ${people.filter((v) => week(v.day) === w && v.group === "direct").length} |`);
out();

out(`## First page of the visit`);
out();
out(`| Landing page | Visitors |`);
out(`|---|--:|`);
for (const [p, n] of tally(people, (v) => decodeURIComponent(v.landing)).slice(0, 20)) out(`| ${p} | ${n} |`);
out();

out(`## Who they are`);
out();
out(`| Country | Visitors |`);
out(`|---|--:|`);
for (const [c, n] of tally(people, (v) => v.cc).slice(0, 12)) out(`| ${c} | ${n} |`);
out();
out(`Devices: ${tally(people, (v) => v.device).map(([d, n]) => `${n} ${d}`).join(", ")}. Came back on another day: ${people.filter((v) => v.days > 1).length}.`);
out();

out(`## Most active real visitors`);
out();
out(`| IP | Network | Source | Pages in a day | Days |`);
out(`|---|---|---|--:|--:|`);
for (const v of [...people].sort((a, b) => b.maxPagesPerDay - a.maxPagesPerDay).slice(0, 10))
  out(`| ${v.ip} | ${v.as.slice(0, 40)} (${v.cc}) | ${v.source ?? "direct"} | ${v.maxPagesPerDay} | ${v.days} |`);
out();
out(`"Pages" include the header links Next.js prefetches when a page loads, so one page view shows up as about a dozen.`);

const report = lines.join("\n");
console.log(report);
if (OUT) fs.writeFileSync(OUT, `${report}\n`);
