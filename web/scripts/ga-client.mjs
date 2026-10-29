/**
 * Shared plumbing for the GA scripts (ga-config.mjs, ga-insights.mjs): auth, finding the property,
 * and Admin / Data API calls.
 *
 * The property is found from NEXT_PUBLIC_GA_ID in apphosting.yaml, so there is no id to keep in
 * sync. Auth is the active gcloud account impersonating the ga-admin service account (no key
 * file); that account must be an Editor on the GA property (GA → Admin → Property access
 * management). Override the account with GA_ADMIN_SA, or pass a ready token as GA_ACCESS_TOKEN.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SA = process.env.GA_ADMIN_SA ?? "ga-admin@opusify-japanese.iam.gserviceaccount.com";
const SCOPES = "https://www.googleapis.com/auth/analytics.edit,https://www.googleapis.com/auth/analytics.readonly";

export const ADMIN = "https://analyticsadmin.googleapis.com";
const DATA = "https://analyticsdata.googleapis.com";

/** The site's conversions. Keep in step with the Events type in src/lib/analytics.ts. */
export const KEY_EVENTS = ["sign_up", "quiz_complete", "lesson_complete", "exam_complete", "affiliate_click"];

/** Cloud data-centre cities: their sessions are bots (one page, zero engagement), not people. */
export const DATACENTER_CITIES = ["Singapore", "Council Bluffs", "Ashburn", "Boardman", "The Dalles", "Columbus", "Frankfurt am Main", "Guangzhou"];

export const measurementId = fs.readFileSync(path.join(root, "apphosting.yaml"), "utf8").match(/NEXT_PUBLIC_GA_ID\s*\n\s*value:\s*"?(G-[A-Z0-9]+)/)?.[1];
if (!measurementId) throw new Error("NEXT_PUBLIC_GA_ID not found in apphosting.yaml");

let token;
function getToken() {
  token ??=
    process.env.GA_ACCESS_TOKEN ??
    execSync(`gcloud auth print-access-token --impersonate-service-account=${SA} --scopes=${SCOPES}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return token;
}

export async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${getToken()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${j.error?.message ?? ""}`);
  return j;
}

/** Follows nextPageToken; `key` is the array field of the list response. */
export async function listAll(url, key) {
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

export async function findProperty() {
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

/**
 * Data API runReport, returning rows as objects keyed by dimension and metric names, with metrics
 * as numbers.
 */
export async function runReport(property, body) {
  const j = await api("POST", `${DATA}/v1beta/${property}:runReport`, body);
  const dims = (j.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (j.metricHeaders ?? []).map((h) => h.name);
  return (j.rows ?? []).map((r) => {
    const o = {};
    dims.forEach((d, i) => (o[d] = r.dimensionValues[i].value));
    mets.forEach((m, i) => (o[m] = Number(r.metricValues[i].value)));
    return o;
  });
}
