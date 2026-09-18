"use client";
/**
 * Firestore client, split from ./client so components that only need auth (header menu, login
 * forms, AuthProvider) do not pull the Firestore SDK into every page's bundle.
 */
import { getFirestore, type Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getFirebaseApp } from "./client";

let db: Firestore | undefined;
let persistenceRequested = false;

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
