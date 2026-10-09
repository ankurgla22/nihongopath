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
// HSTS and upgrade-insecure-requests only make sense when the site is actually served over https.
// A production build run locally on http://localhost must not send them, or the browser pins https.
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * Content Security Policy. Next.js 14 inline scripts (hydration, theme script, JSON-LD) need
 * 'unsafe-inline' without nonce plumbing; 'unsafe-eval' is only needed by the dev overlay.
 * Firebase Auth popups need apis.google.com, the auth domain, and accounts.google.com in frame-src.
 * No Cross-Origin-Opener-Policy header: it would break signInWithPopup.
 */
// GA4 needs three directives, not just script-src: the tag loads from googletagmanager.com, beacons
// to *.google-analytics.com, and falls back to a tracking pixel on google-analytics.com when
// sendBeacon is unavailable. Allowing only the script would leave analytics silently reporting
// nothing. These stay in the policy whether or not NEXT_PUBLIC_GA_ID is set — they permit a
// connection, they do not open one.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com https://www.google-analytics.com https://www.googletagmanager.com",
  `connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://apis.google.com${authDomain ? ` https://${authDomain}` : ""} https://www.google.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
  `frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://apis.google.com${authDomain ? ` https://${authDomain}` : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd && isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

/**
 * Build time in HTTP-date form. Pages are statically generated, so the build is genuinely when
 * their content last changed. Crawlers use Last-Modified to decide what to re-fetch; without it
 * they can only compare ETags, which costs them a request per page.
 */
const BUILD_DATE = new Date().toUTCString();

const securityHeaders = [
  { key: "Last-Modified", value: BUILD_DATE },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isProd && isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
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
    // On localhost never send HSTS or upgrade-insecure-requests, whatever NEXT_PUBLIC_SITE_URL says:
    // a production build run locally would otherwise make the browser pin https://localhost and
    // fail to load every chunk. Everywhere else the full policy applies.
    const local = { type: "host", value: "localhost" };
    const localHeaders = securityHeaders
      .filter((h) => h.key !== "Strict-Transport-Security")
      .map((h) => (h.key === "Content-Security-Policy" ? { ...h, value: h.value.replace(/;\s*upgrade-insecure-requests/, "") } : h));
    return [
      { source: "/:path*", has: [local], headers: localHeaders },
      { source: "/:path*", missing: [local], headers: securityHeaders },
    ];
  },
  async redirects() {
    // Next.js prefetches pages as `<url>?_rsc=<hash>`, and the browser sends an `RSC: 1` header
    // with each one. Crawlers that run JavaScript see those URLs and fetch them *without* the
    // header, getting a full HTML render of a page they already hold — and since the hash varies,
    // there is no end to them. Meta's crawler did that on 8 October: 68,952 requests in a day,
    // 93% of all traffic, 63,000 distinct URLs. robots.txt disallows ?_rsc= too, but that storm
    // began five hours after the rule went live.
    //
    // This has to be a config redirect, not middleware: Next strips `_rsc` from the URL before
    // middleware ever sees it (stripInternalSearchParams in the middleware adapter), so a
    // middleware check can never fire. The config router does see it, and prepareDestination drops
    // `_rsc` from the destination query while keeping every other parameter — so no loop, and
    // `?page=2&_rsc=x` lands on `?page=2`. A browser's own prefetch carries the header and is
    // untouched.
    // Two rules, not one `/:path*`: with zero segments that pattern compiles to an empty
    // destination and the homepage answered with a blank Location header — a broken redirect on
    // the one page that matters most. Seen on a dev server before shipping.
    const prefetchFromACrawler = { has: [{ type: "query", key: "_rsc" }], missing: [{ type: "header", key: "rsc" }], permanent: true };
    return [
      { source: "/", destination: "/", ...prefetchFromACrawler },
      { source: "/:path+", destination: "/:path+", ...prefetchFromACrawler },
    ];
  },
  async rewrites() {
    // The conventional sitemap URL. Next's generateSitemaps() owns "/sitemap.xml[[...id]]" for the
    // per-section parts, so the index lives at /sitemap-index.xml and is rewritten here.
    return [{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }];
  },
};

export default nextConfig;
