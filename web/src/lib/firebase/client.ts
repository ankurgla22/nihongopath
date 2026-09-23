"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase is not configured. Copy .env.example to .env.local and fill in NEXT_PUBLIC_FIREBASE_* values.");
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

/**
 * Lazily initialised Auth, for two reasons:
 *
 * 1. The import is dynamic. The root layout's AuthProvider reaches this module on every page,
 *    and a static `firebase/auth` import here put the 87 KB auth SDK into every public
 *    lesson page's initial JavaScript. Now it is fetched after first paint, when it is needed.
 * 2. No popup/redirect resolver. `getAuth()` registers one by default, which makes the SDK
 *    load the auth iframe from the auth domain plus Google's gapi library on every page. The
 *    two Google sign-in buttons pass `browserPopupRedirectResolver` explicitly instead.
 */
export async function getClientAuth(): Promise<Auth> {
  if (!auth) {
    const { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } = await import("firebase/auth");
    auth = initializeAuth(getFirebaseApp(), { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  }
  return auth;
}

// Firestore lives in ./db (see note there).
