/** @type {import('next').NextConfig} */

/**
 * On Firebase App Hosting the web-app config is injected as FIREBASE_WEBAPP_CONFIG (JSON).
 * Derive any missing NEXT_PUBLIC_FIREBASE_* values from it so the browser bundle is configured
 * without duplicating values in apphosting.yaml.
 */
function firebaseEnvFromWebappConfig() {
  const out = {};
  try {
    const raw = process.env.FIREBASE_WEBAPP_CONFIG;
    if (!raw) return out;
    const c = JSON.parse(raw);
    const map = {
      NEXT_PUBLIC_FIREBASE_API_KEY: c.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: c.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: c.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: c.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: c.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: c.appId,
    };
    for (const [k, v] of Object.entries(map)) if (!process.env[k] && v) out[k] = String(v);
  } catch {
    /* ignore malformed config */
  }
  return out;
}

const derivedEnv = firebaseEnvFromWebappConfig();
const authDomain = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? derivedEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").replace(/^"|"$/g, "");
const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy. Next.js 14 inline scripts (hydration, theme script, JSON-LD) need
 * 'unsafe-inline' without nonce plumbing; 'unsafe-eval' is only needed by the dev overlay.
 * Firebase Auth popups need apis.google.com, the auth domain, and accounts.google.com in frame-src.
 * No Cross-Origin-Opener-Policy header: it would break signInWithPopup.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
  `connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://apis.google.com${authDomain ? ` https://${authDomain}` : ""} https://www.google.com`,
  `frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://apis.google.com${authDomain ? ` https://${authDomain}` : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  env: derivedEnv,
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
