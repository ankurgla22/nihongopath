/**
 * Firestore security rules tests (tasks.md section 37 / 53).
 *
 * Runs against the Firestore emulator:
 *   npm run test:rules        (firebase emulators:exec starts the emulator, then runs this file)
 *
 * When no emulator is reachable the whole suite is skipped with a message so that the default
 * `npm test` stays green on machines without Java / the Firebase CLI.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const RULES_PATH = path.resolve(__dirname, "..", "firestore.rules");
const PROJECT_ID = "demo-jlpt-rules-test";

function emulatorHost(): { host: string; port: number } {
  const env = process.env.FIRESTORE_EMULATOR_HOST;
  if (env) {
    const [host, port] = env.split(":");
    return { host: host || "127.0.0.1", port: Number(port) || 8080 };
  }
  return { host: "127.0.0.1", port: 8080 };
}

function probe(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

const { host, port } = emulatorHost();
const emulatorUp = await probe(host, port);
if (!emulatorUp) {
  console.warn(
    `[firestore.rules.test] Firestore emulator not reachable at ${host}:${port}; skipping rules tests. ` +
      `Run "npm run test:rules" (requires Firebase CLI + Java) to execute them.`
  );
}

const ALICE = "alice-uid";
const BOB = "bob-uid";

describe.skipIf(!emulatorUp)("firestore.rules", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { host, port, rules: fs.readFileSync(RULES_PATH, "utf8") },
    });
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  type Db = ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["firestore"] extends () => infer R ? R : never;
  const asAlice = () => env.authenticatedContext(ALICE).firestore();
  const asBob = () => env.authenticatedContext(BOB).firestore();
  const asAnon = () => env.unauthenticatedContext().firestore();

  /** Seed data bypassing rules. */
  const seed = (fn: (db: Db) => Promise<unknown>) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await fn(ctx.firestore());
    });

  describe("users/{uid}", () => {
    it("owner can create their profile with matching uid field and read it back", async () => {
      const db = asAlice();
      await assertSucceeds(setDoc(doc(db, "users", ALICE), { uid: ALICE, currentDay: 1, streak: 0 }));
      await assertSucceeds(getDoc(doc(db, "users", ALICE)));
    });

    it("owner cannot create their profile with a mismatched or missing uid field", async () => {
      const db = asAlice();
      await assertFails(setDoc(doc(db, "users", ALICE), { uid: BOB, currentDay: 1 }));
      await assertFails(setDoc(doc(db, "users", ALICE), { currentDay: 1 }));
    });

    it("owner can update their profile but cannot change the uid field", async () => {
      await seed((db) => setDoc(doc(db, "users", ALICE), { uid: ALICE, currentDay: 1 }));
      await assertSucceeds(updateDoc(doc(asAlice(), "users", ALICE), { currentDay: 2 }));
      await assertFails(updateDoc(doc(asAlice(), "users", ALICE), { uid: BOB }));
    });

    it("owner cannot delete their profile", async () => {
      await seed((db) => setDoc(doc(db, "users", ALICE), { uid: ALICE }));
      await assertFails(deleteDoc(doc(asAlice(), "users", ALICE)));
    });

    it("another user cannot read or write it", async () => {
      await seed((db) => setDoc(doc(db, "users", ALICE), { uid: ALICE, currentDay: 1 }));
      const db = asBob();
      await assertFails(getDoc(doc(db, "users", ALICE)));
      await assertFails(setDoc(doc(db, "users", ALICE), { uid: ALICE, currentDay: 99 }));
      await assertFails(updateDoc(doc(db, "users", ALICE), { currentDay: 99 }));
      await assertFails(deleteDoc(doc(db, "users", ALICE)));
      // Bob cannot forge a document under Alice's uid by supplying his own uid field either.
      await assertFails(setDoc(doc(db, "users", ALICE), { uid: BOB }));
    });
  });

  describe("owner-writable subcollections", () => {
    for (const sub of ["progress", "dailyProgress", "reviewItems", "saved"]) {
      it(`owner can create/update/delete/read ${sub}`, async () => {
        const db = asAlice();
        const ref = doc(db, "users", ALICE, sub, "item-1");
        await assertSucceeds(setDoc(ref, { status: "learning", attempts: 1 }));
        await assertSucceeds(updateDoc(ref, { attempts: 2 }));
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(getDocs(collection(db, "users", ALICE, sub)));
        await assertSucceeds(deleteDoc(ref));
      });

      it(`another user cannot read or write ${sub}`, async () => {
        await seed((db) => setDoc(doc(db, "users", ALICE, sub, "item-1"), { status: "learning" }));
        const db = asBob();
        await assertFails(getDoc(doc(db, "users", ALICE, sub, "item-1")));
        await assertFails(getDocs(collection(db, "users", ALICE, sub)));
        await assertFails(setDoc(doc(db, "users", ALICE, sub, "item-2"), { status: "x" }));
        await assertFails(updateDoc(doc(db, "users", ALICE, sub, "item-1"), { status: "x" }));
        await assertFails(deleteDoc(doc(db, "users", ALICE, sub, "item-1")));
      });
    }
  });

  describe("append-only results", () => {
    for (const sub of ["quizResults", "examResults"]) {
      it(`owner can create and read ${sub} but cannot update or delete`, async () => {
        const db = asAlice();
        const ref = doc(db, "users", ALICE, sub, "result-1");
        await assertSucceeds(setDoc(ref, { score: 10, total: 12 }));
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(getDocs(collection(db, "users", ALICE, sub)));
        await assertFails(updateDoc(ref, { score: 12 }));
        await assertFails(setDoc(ref, { score: 12, total: 12 })); // overwriting an existing doc is an update
        await assertFails(deleteDoc(ref));
      });

      it(`another user cannot read or create ${sub}`, async () => {
        await seed((db) => setDoc(doc(db, "users", ALICE, sub, "result-1"), { score: 1 }));
        const db = asBob();
        await assertFails(getDoc(doc(db, "users", ALICE, sub, "result-1")));
        await assertFails(setDoc(doc(db, "users", ALICE, sub, "result-2"), { score: 1 }));
      });
    }

    it("studySessions: owner can create/update/read but not delete", async () => {
      const db = asAlice();
      const ref = doc(db, "users", ALICE, "studySessions", "s1");
      await assertSucceeds(setDoc(ref, { minutes: 10 }));
      await assertSucceeds(updateDoc(ref, { minutes: 20 }));
      await assertSucceeds(getDoc(ref));
      await assertFails(deleteDoc(ref));
    });
  });

  describe("unauthenticated", () => {
    it("cannot read or write anything under users", async () => {
      await seed(async (db) => {
        await setDoc(doc(db, "users", ALICE), { uid: ALICE });
        await setDoc(doc(db, "users", ALICE, "progress", "p1"), { status: "new" });
      });
      const db = asAnon();
      await assertFails(getDoc(doc(db, "users", ALICE)));
      await assertFails(getDoc(doc(db, "users", ALICE, "progress", "p1")));
      await assertFails(getDocs(collection(db, "users")));
      await assertFails(setDoc(doc(db, "users", ALICE), { uid: ALICE }));
      await assertFails(setDoc(doc(db, "users", "anyone"), { uid: "anyone" }));
      await assertFails(setDoc(doc(db, "users", ALICE, "saved", "x"), { type: "grammar" }));
    });
  });

  describe("unrelated collections", () => {
    it("reading or writing a top-level unrelated collection is denied, even when signed in", async () => {
      await seed((db) => setDoc(doc(db, "curriculum", "day-1"), { title: "Day 1" }));
      for (const db of [asAlice(), asAnon()]) {
        await assertFails(getDoc(doc(db, "curriculum", "day-1")));
        await assertFails(getDocs(collection(db, "curriculum")));
        await assertFails(setDoc(doc(db, "curriculum", "day-2"), { title: "Day 2" }));
        await assertFails(setDoc(doc(db, "leaderboard", ALICE), { score: 1 }));
      }
    });

    it("unknown subcollections under users/{uid} are denied", async () => {
      const db = asAlice();
      await assertFails(setDoc(doc(db, "users", ALICE, "secrets", "s"), { a: 1 }));
      await assertFails(getDoc(doc(db, "users", ALICE, "secrets", "s")));
    });
  });
});
