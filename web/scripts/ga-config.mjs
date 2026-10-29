/**
 * Google Analytics configuration as code: the key events, custom dimensions and settings the
 * site's tracking (src/lib/analytics.ts) relies on, applied through the GA Admin API.
 *
 *   node scripts/ga-config.mjs            # show what differs from the config below (changes nothing)
 *   node scripts/ga-config.mjs --apply    # make GA match it
 *
 * Auth and property lookup: see ga-client.mjs. For reading the data, see ga-insights.mjs.
 *
 * Not covered, because the Admin API does not expose them: internal-traffic rules and data
 * filters. Those stay in the GA UI.
 */
import { ADMIN, KEY_EVENTS, api, findProperty, listAll, measurementId } from "./ga-client.mjs";

// ---------- desired state ----------

// Event parameters become reportable only once registered as custom dimensions.
const CUSTOM_DIMENSIONS = [
  { parameterName: "quiz", displayName: "Quiz kind", description: "quick, lesson, practice or test" },
  { parameterName: "method", displayName: "Auth method", description: "google or email (sign_up, login)" },
  { parameterName: "type", displayName: "Lesson type", description: "grammar, vocabulary, kanji… (lesson_complete)" },
  { parameterName: "level", displayName: "Lesson level", description: "foundation, n5…n1 (lesson_complete)" },
  { parameterName: "mode", displayName: "Exam mode", description: "full or single section (exam_complete)" },
  { parameterName: "book", displayName: "Affiliate book", description: "book id (affiliate_click)" },
  { parameterName: "store", displayName: "Affiliate store", description: "Amazon store id (affiliate_click)" },
  { parameterName: "depth", displayName: "Read depth", description: "25, 50, 75 or 100 percent of the page (read_depth)" },
];

// The default is two months, which makes every exploration older than that empty.
const DATA_RETENTION = { eventDataRetention: "FOURTEEN_MONTHS", resetUserDataOnNewActivity: true };

// ---------- apply ----------

const APPLY = process.argv.includes("--apply");

const changes = [];
async function change(label, fn) {
  changes.push(label);
  console.log(`  ${APPLY ? "✓" : "→"} ${label}`);
  if (APPLY) await fn();
}

async function configure({ property }) {
  console.log("Key events");
  const existing = new Set((await listAll(`${ADMIN}/v1beta/${property}/keyEvents`, "keyEvents")).map((k) => k.eventName));
  for (const eventName of KEY_EVENTS) {
    if (existing.has(eventName)) continue;
    await change(`mark ${eventName} as a key event`, () => api("POST", `${ADMIN}/v1beta/${property}/keyEvents`, { eventName, countingMethod: "ONCE_PER_EVENT" }));
  }

  console.log("Custom dimensions");
  const dims = await listAll(`${ADMIN}/v1beta/${property}/customDimensions`, "customDimensions");
  for (const d of CUSTOM_DIMENSIONS) {
    const have = dims.find((x) => x.parameterName === d.parameterName && x.scope === "EVENT");
    if (!have) {
      await change(`register event parameter "${d.parameterName}" as "${d.displayName}"`, () =>
        api("POST", `${ADMIN}/v1beta/${property}/customDimensions`, { ...d, scope: "EVENT" })
      );
    } else if (have.displayName !== d.displayName || (have.description ?? "") !== d.description) {
      await change(`update "${d.parameterName}" name/description`, () =>
        api("PATCH", `${ADMIN}/v1beta/${have.name}?updateMask=displayName,description`, { displayName: d.displayName, description: d.description })
      );
    }
  }

  console.log("Data retention");
  const ret = await api("GET", `${ADMIN}/v1beta/${property}/dataRetentionSettings`);
  if (ret.eventDataRetention !== DATA_RETENTION.eventDataRetention || ret.resetUserDataOnNewActivity !== DATA_RETENTION.resetUserDataOnNewActivity) {
    await change(`event data retention ${ret.eventDataRetention} → ${DATA_RETENTION.eventDataRetention}`, () =>
      api("PATCH", `${ADMIN}/v1beta/${property}/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity`, DATA_RETENTION)
    );
  }

  // The privacy page promises Google Signals is off. Checked, never switched on.
  console.log("Google Signals");
  try {
    const sig = await api("GET", `${ADMIN}/v1alpha/${property}/googleSignalsSettings`);
    if (sig.state === "GOOGLE_SIGNALS_ENABLED") {
      await change("turn Google Signals off (the privacy page says it is off)", () =>
        api("PATCH", `${ADMIN}/v1alpha/${property}/googleSignalsSettings?updateMask=state`, { state: "GOOGLE_SIGNALS_DISABLED" })
      );
    }
  } catch (e) {
    console.log(`  ! could not read: ${e.message}`);
  }
}

const target = await findProperty();
console.log(`${target.name} (${target.property}, stream ${measurementId})\n`);
await configure(target);
console.log(changes.length === 0 ? "\nGA already matches the config." : APPLY ? `\nApplied ${changes.length} change(s).` : `\n${changes.length} change(s) pending. Run with --apply to make them.`);
