import "server-only";
import { createVerify, X509Certificate } from "node:crypto";

/**
 * Verifies a Firebase Auth ID token using Google's public certificates, without the
 * Admin SDK. Used when FIREBASE_SERVICE_ACCOUNT_JSON is not set (local development,
 * simple hosting). Checks signature (RS256), issuer, audience, subject and timestamps.
 *
 * ID tokens expire after one hour; `graceSeconds` lets an already-verified token stand
 * in as our own session for up to SESSION_DAYS. The signature still proves Firebase
 * issued the token for this project. The client refreshes the cookie on every token
 * refresh (AuthProvider), so in practice the cookie is rarely older than an hour.
 */
const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { keys: Record<string, string>; expires: number } | null = null;
let lastFetch = 0;
const REFETCH_MIN_MS = 60 * 1000;

async function getCerts(force = false): Promise<Record<string, string>> {
  if (certCache && certCache.expires > Date.now() && !force) return certCache.keys;
  // Unknown `kid`s are attacker-controlled; never let them trigger more than one refetch a minute.
  if (force && certCache && Date.now() - lastFetch < REFETCH_MIN_MS) return certCache.keys;
  lastFetch = Date.now();
  const res = await fetch(CERT_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch Google certificates (${res.status})`);
  const keys = (await res.json()) as Record<string, string>;
  const cc = res.headers.get("cache-control") ?? "";
  const m = cc.match(/max-age=(\d+)/);
  const ttl = m ? Number(m[1]) * 1000 : 60 * 60 * 1000;
  certCache = { keys, expires: Date.now() + Math.max(ttl, 5 * 60 * 1000) };
  return keys;
}

function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type VerifiedToken = { uid: string; email: string | null; name: string | null; picture: string | null; exp: number; iat: number };

export async function verifyFirebaseIdToken(token: string, opts: { projectId: string; graceSeconds?: number }): Promise<VerifiedToken> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const header = JSON.parse(b64url(parts[0]).toString("utf8"));
  const payload = JSON.parse(b64url(parts[1]).toString("utf8"));
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("unexpected token header");

  const kid: string = header.kid;
  // Own-property lookup so a kid like "__proto__" or "constructor" cannot resolve to a non-certificate.
  const lookup = (keys: Record<string, string>) => (Object.prototype.hasOwnProperty.call(keys, kid) ? keys[kid] : undefined);
  let pem = lookup(await getCerts());
  if (typeof pem !== "string") pem = lookup(await getCerts(true));
  if (typeof pem !== "string" || !pem.includes("BEGIN CERTIFICATE")) throw new Error("unknown key id");
  const publicKey = new X509Certificate(pem).publicKey;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(publicKey, b64url(parts[2]))) throw new Error("bad signature");

  const now = Math.floor(Date.now() / 1000);
  const grace = opts.graceSeconds ?? 0;
  if (payload.iss !== `https://securetoken.google.com/${opts.projectId}`) throw new Error("bad issuer");
  if (payload.aud !== opts.projectId) throw new Error("bad audience");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new Error("missing subject");
  if (typeof payload.iat !== "number" || payload.iat > now + 300) throw new Error("token issued in the future");
  if (typeof payload.exp !== "number" || payload.exp + grace < now) throw new Error("token expired");

  return {
    uid: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    exp: payload.exp,
    iat: payload.iat,
  };
}

export function publicProjectId(): string | undefined {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.replace(/^"|"$/g, "");
}
