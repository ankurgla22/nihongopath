/**
 * Names of the per-user subcollections under users/{uid}.
 *
 * Deliberately free of "server-only" and of any Firebase import: the reset and delete paths
 * (server) and the test that guards them both need this list, and a server-only module cannot
 * be imported from a test or a client component.
 *
 * Anything added here must also be added to firestore.rules, or the client will be denied.
 */
export const USER_SUBCOLLECTIONS = ["progress", "dailyProgress", "studySessions", "quizResults", "examResults", "reviewItems", "saved"] as const;
export type UserSubcollection = (typeof USER_SUBCOLLECTIONS)[number];
