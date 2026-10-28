/**
 * Google Analytics configuration as code: the key events, custom dimensions and settings the
 * site's tracking (src/lib/analytics.ts) relies on, applied through the GA Admin API.
 *
 *   node scripts/ga-config.mjs            # show what differs from the config below (changes nothing)
 *   node scripts/ga-config.mjs --apply    # make GA match it
 *   node scripts/ga-config.mjs --report   # last 28 days: custom events, and users with data-centre traffic set apart
 *
 * The property is found from NEXT_PUBLIC_GA_ID in apphosting.yaml, so there is no id to keep in
 * sync. Auth is the active gcloud account impersonating the ga-admin service account (no key
 * file); that account must be an Editor on the GA property (GA → Admin → Property access
 * management). Override the account with GA_ADMIN_SA, or pass a ready token as GA_ACCESS_TOKEN.
 *
 * Not covered, because the Admin API does not expose them: internal-traffic rules and data
 * filters. Those stay in the GA UI.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

// ---------- desired state ----------

// Keep in step with the Events type in src/lib/analytics.ts.
const KEY_EVENTS = ["sign_up", "quiz_complete", "lesson_complete", "exam_complete", "affiliate_click"];

// Event parameters become reportable only once registered as custom dimensions.
const CUSTOM_DIMENSIONS = [
  { parameterName: "quiz", displayName: "Quiz kind", description: "quick, lesson, practice or test" },
  { parameterName: "method", displayName: "Auth method", description: "google or email (sign_up, login)" },
  { parameterName: "type", displayName: "Lesson type", description: "grammar, vocabulary, kanji… (lesson_complete)" },
  { parameterName: "level", displayName: "Lesson level", description: "foundation, n5…n1 (lesson_complete)" },
  { parameterName: "mode", displayName: "Exam mode", description: "full or single section (exam_complete)" },
  { parameterName: "book", displayName: "Affiliate book", description: "book id (affiliate_click)" },
  { parameterName: "store", displayName: "Affiliate store", description: "Amazon store id (affiliate_click)" },
];

// The default is two months, which makes every exploration older than that empty.
const DATA_RETENTION = { eventDataRetention: "FOURTEEN_MONTHS", resetUserDataOnNewActivity: true };

// Cities that are cloud data centres, not people (see the traffic notes in the report).
const DATACENTER_CITIES = ["Singapore", "Council Bluffs", "Ashburn", "Boardman", "The Dalles", "Columbus", "Frankfurt am Main", "Guangzhou"];

// ---------- plumbing ----------

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const REPORT = args.has("--report");
const SA = process.env.GA_ADMIN_SA ?? "ga-admin@opusify-japanese.iam.gserviceaccount.com";
const SCOPES = "https://www.googleapis.com/auth/analytics.edit,https://www.googleapis.com/auth/analytics.readonly";

const measurementId = fs.readFileSync(path.join(root, "apphosting.yaml"), "utf8").match(/NEXT_PUBLIC_GA_ID\s*\n\s*value:\s*"?(G-[A-Z0-9]+)/)?.[1];
if (!measurementId) throw new Error("NEXT_PUBLIC_GA_ID not found in apphosting.yaml");

const token =
  process.env.GA_ACCESS_TOKEN ??
  execSync(`gcloud auth print-access-token --impersonate-service-account=${SA} --scopes=${SCOPES}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${j.error?.message ?? ""}`);
  return j;
}
const ADMIN = "https://analyticsadmin.googleapis.com";

/** Follows nextPageToken; `key` is the array field of the list response. */
async function listAll(url, key) {
  const out = [];
  let pageToken;
  do {
    const sep = url.includes("?") ? "&" : "?";
    const j = await api("GET", `${url}${sep}pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`);
    out.push(...(j[key] ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

async function findProperty() {
  const accounts = await listAll(`${ADMIN}/v1beta/accountSummaries`, "accountSummaries");
  for (const a of accounts) {
    for (const p of a.propertySummaries ?? []) {
      const streams = await listAll(`${ADMIN}/v1beta/${p.property}/dataStreams`, "dataStreams");
      const stream = streams.find((s) => s.webStreamData?.measurementId === measurementId);
      if (stream) return { property: p.property, name: p.displayName, stream: stream.name };
    }
  }
  const seen = accounts.flatMap((a) => (a.propertySummaries ?? []).map((p) => p.displayName));
  throw new Error(
    `No property with stream ${measurementId} is visible to ${SA}. ` +
      (seen.length ? `It can see: ${seen.join(", ")}.` : "It can see no properties: add it as an Editor in GA → Admin → Property access management.")
  );
}

const changes = [];
async function change(label, fn) {
  changes.push(label);
  console.log(`  ${APPLY ? "✓" : "→"} ${label}`);
  if (APPLY) await fn();
}

// ---------- config ----------

async function configure({ property }) {
  console.log("Key events");
  const existing = new Set((await listAll(`${ADMIN}/v1beta/${property}/keyEvents`, "keyEvents")).map((k) => k.eventName));
  for (const eventName of KEY_EVENTS) {
    if (existing.has(eventName)) continue;
    await change(`mark ${eventName} as a key event`, () => api("POST", `${ADMIN}/v1beta/${property}/keyEvents`, { eventName, countingMethod: "ONCE_PER_EVENT" }));
  }

  console.log("Custom dimensions");
  const dims = await listAll(`${ADMIN}/v1beta/${property}/customDimensions`, "customDimensions");
  for (const d of CUSTOM_DIMENSIONS) {
    const have = dims.find((x) => x.parameterName === d.parameterName && x.scope === "EVENT");
    if (!have) {
      await change(`register event parameter "${d.parameterName}" as "${d.displayName}"`, () =>
        api("POST", `${ADMIN}/v1beta/${property}/customDimensions`, { ...d, scope: "EVENT" })
      );
    } else if (have.displayName !== d.displayName || (have.description ?? "") !== d.description) {
      await change(`update "${d.parameterName}" name/description`, () =>
        api("PATCH", `${ADMIN}/v1beta/${have.name}?updateMask=displayName,description`, { displayName: d.displayName, description: d.description })
      );
    }
  }

  console.log("Data retention");
  const ret = await api("GET", `${ADMIN}/v1beta/${property}/dataRetentionSettings`);
  if (ret.eventDataRetention !== DATA_RETENTION.eventDataRetention || ret.resetUserDataOnNewActivity !== DATA_RETENTION.resetUserDataOnNewActivity) {
    await change(`event data retention ${ret.eventDataRetention} → ${DATA_RETENTION.eventDataRetention}`, () =>
      api("PATCH", `${ADMIN}/v1beta/${property}/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity`, DATA_RETENTION)
    );
  }

  // The privacy page promises Google Signals is off. Checked, never switched on.
  console.log("Google Signals");
  try {
    const sig = await api("GET", `${ADMIN}/v1alpha/${property}/googleSignalsSettings`);
    if (sig.state === "GOOGLE_SIGNALS_ENABLED") {
      await change("turn Google Signals off (the privacy page says it is off)", () =>
        api("PATCH", `${ADMIN}/v1alpha/${property}/googleSignalsSettings?updateMask=state`, { state: "GOOGLE_SIGNALS_DISABLED" })
      );
    }
  } catch (e) {
    console.log(`  ! could not read: ${e.message}`);
  }
}

// ---------- report ----------

async function runReport(property, body) {
  const j = await api("POST", `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, { dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], ...body });
  return (j.rows ?? []).map((r) => [...r.dimensionValues.map((v) => v.value), ...r.metricValues.map((v) => Number(v.value))]);
}

async function report({ property }) {
  const events = await runReport(property, {
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["quiz_start", "exercise_complete", "login", ...KEY_EVENTS] } } },
  });
  console.log("\nCustom events, last 28 days");
  if (events.length === 0) console.log("  (none yet — they appear after the tracking code is deployed)");
  for (const [name, count, users] of events) console.log(`  ${name.padEnd(18)} ${String(count).padStart(6)} events  ${String(users).padStart(5)} users`);

  const rows = await runReport(property, {
    dimensions: [{ name: "city" }, { name: "sessionSourceMedium" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "userEngagementDuration" }],
    limit: 1000,
  });
  const sum = (rs) => rs.reduce((a, r) => ({ users: a.users + r[2], sessions: a.sessions + r[3], secs: a.secs + r[4] }), { users: 0, sessions: 0, secs: 0 });
  const bots = rows.filter((r) => DATACENTER_CITIES.includes(r[0]));
  const people = rows.filter((r) => !DATACENTER_CITIES.includes(r[0]));
  const fmt = (s) => `${String(s.users).padStart(5)} users  ${String(s.sessions).padStart(5)} sessions  ${(s.sessions ? s.secs / s.sessions : 0).toFixed(0).padStart(4)}s engaged/session`;
  console.log("\nUsers, last 28 days (city × source rows, so users can be counted twice)");
  console.log(`  data-centre cities  ${fmt(sum(bots))}`);
  console.log(`  everyone else       ${fmt(sum(people))}`);
  const bySource = new Map();
  for (const r of people) bySource.set(r[1], (bySource.get(r[1]) ?? 0) + r[2]);
  console.log("\n  everyone else, by source");
  for (const [src, n] of [...bySource].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${src.padEnd(28)} ${String(n).padStart(5)}`);
}

// ---------- main ----------

const target = await findProperty();
console.log(`${target.name} (${target.property}, stream ${measurementId})\n`);
if (REPORT) {
  await report(target);
} else {
  await configure(target);
  console.log(changes.length === 0 ? "\nGA already matches the config." : APPLY ? `\nApplied ${changes.length} change(s).` : `\n${changes.length} change(s) pending. Run with --apply to make them.`);
}
