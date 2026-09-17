"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, enableIndexedDbPersistence } from "firebase/firestore";

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
let db: Firestore | undefined;
let persistenceRequested = false;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase is not configured. Copy .env.example to .env.local and fill in NEXT_PUBLIC_FIREBASE_* values.");
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function getClientAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    if (typeof window !== "undefined" && !persistenceRequested) {
      persistenceRequested = true;
      // Offline cache so quiz progress and reads survive temporary network loss.
      enableIndexedDbPersistence(db).catch(() => {
        /* multiple tabs or unsupported browser: continue without persistence */
      });
    }
  }
  return db;
}
