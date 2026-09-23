/**
 * Submit the site's URLs to IndexNow (https://www.indexnow.org), which Bing, Yandex, Seznam
 * and Naver read. Bing's index also feeds ChatGPT search and Copilot. Google does not use it.
 *
 *   node scripts/indexnow.mjs            # every URL in the sitemap index (max 10,000 per call)
 *   node scripts/indexnow.mjs /about /jlpt   # just these paths
 *
 * The key is public by design: IndexNow verifies ownership by fetching /<key>.txt from the
 * host, so it lives in src/lib/seo/indexnow.ts and public/<key>.txt, both committed.
 * Reads NEXT_PUBLIC_SITE_URL from the environment or .env; defaults to the production host.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  for (const f of [".env.local", ".env"]) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  }
  return undefined;
}

const site = (readEnv("NEXT_PUBLIC_SITE_URL") ?? "https://nihongopath.opusify.co.in").replace(/\/$/, "");
const host = new URL(site).host;
const keySrc = fs.readFileSync(path.join(root, "src/lib/seo/indexnow.ts"), "utf8");
const key = keySrc.match(/INDEXNOW_KEY = "([0-9a-f]{32})"/)?.[1];
if (!key) throw new Error("INDEXNOW_KEY not found in src/lib/seo/indexnow.ts");

async function fetchText(url) {
  const r = await fetch(url, { headers: { "user-agent": "nihongopath-indexnow/1.0" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

async function sitemapUrls() {
  const index = await fetchText(`${site}/sitemap.xml`);
  const parts = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const part of parts) {
    const xml = await fetchText(part);
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1]);
  }
  return urls;
}

async function main() {
  // The key file must be reachable before anything is submitted, or every URL is rejected.
  const served = (await fetchText(`${site}/${key}.txt`)).trim();
  if (served !== key) throw new Error(`Key file at ${site}/${key}.txt does not contain the key (got "${served.slice(0, 40)}")`);

  const args = process.argv.slice(2);
  const urlList = args.length ? args.map((p) => (p.startsWith("http") ? p : `${site}${p.startsWith("/") ? p : `/${p}`}`)) : await sitemapUrls();
  if (urlList.length === 0) throw new Error("No URLs to submit");
  if (urlList.length > 10000) throw new Error(`${urlList.length} URLs exceeds the 10,000-per-request limit; split the call`);

  const body = { host, key, keyLocation: `${site}/${key}.txt`, urlList };
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  // 200 = accepted, 202 = accepted and key validation pending. Anything else is a real failure,
  // except one: on a new key IndexNow answers 403 SiteVerificationNotCompleted until its crawler
  // has fetched /<key>.txt, which can take hours. That is "try again later", not a broken setup,
  // so it must not fail the deploy script that runs this after every rollout.
  const ok = r.status === 200 || r.status === 202;
  console.log(`IndexNow: submitted ${urlList.length} URL(s) for ${host} -> HTTP ${r.status}${ok ? " (accepted)" : ""}`);
  if (!ok) {
    const text = await r.text();
    if (r.status === 403 && text.includes("SiteVerificationNotCompleted")) {
      console.warn("IndexNow has not verified the key file yet. Re-run `npm run seo:indexnow` later; nothing is wrong with the setup.");
      return;
    }
    console.error(text);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
