import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin is used only on the server: to verify session cookies and
 * for privileged reads in server components. Credentials come from
 * FIREBASE_SERVICE_ACCOUNT_JSON (a JSON string) or Application Default
 * Credentials on Firebase App Hosting / Cloud Run. Never import this from client code.
 */
let app: App | undefined;

/**
 * True when the Admin SDK can obtain credentials:
 * - FIREBASE_SERVICE_ACCOUNT_JSON: explicit service account (local, other hosts)
 * - GOOGLE_APPLICATION_CREDENTIALS: ADC key file
 * - FIREBASE_CONFIG: injected by Firebase App Hosting (and Cloud Functions)
 * - K_SERVICE: set by Cloud Run, which App Hosting backends run on; the metadata
 *   server supplies the backend's service account through ADC.
 */
export function adminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_CONFIG ||
      process.env.K_SERVICE,
  );
}

function resolveProjectId(): string | undefined {
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const cfg = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : undefined;
    if (typeof cfg?.projectId === "string") return cfg.projectId;
  } catch {
    /* ignore malformed FIREBASE_CONFIG */
  }
  return undefined;
}

export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]!);
  const projectId = resolveProjectId();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const sa = JSON.parse(json);
    app = initializeApp({ credential: cert(sa), projectId: sa.project_id ?? projectId });
  } else {
    // Application Default Credentials: GOOGLE_APPLICATION_CREDENTIALS locally,
    // the attached service account on App Hosting / Cloud Run.
    app = initializeApp({ credential: applicationDefault(), projectId });
  }
  return app;
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
