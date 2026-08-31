/**
 * The vocabulary the activity log's filters share.
 *
 * This lives in a module of its own rather than in the filter bar because that
 * bar is `"use client"`, and a plain constant exported from a client module is
 * NOT its value when a Server Component imports it — the bundler hands the
 * server a client reference instead. The first cut exported `SYSTEM_ACTOR`
 * from the bar and read it in the page: on the client it was "system", on the
 * server it compared unequal to every actor, so the System filter fell through
 * to `userId: "system"` and matched none of the 31 rows it was meant to find.
 *
 * Nothing caught that. Typecheck, lint and a real build all passed — it only
 * surfaced by seeding rows with a null userId and clicking the option.
 */

/**
 * `ActivityLog.userId` is nullable, so "no signed-in staff member" needs a
 * sentinel to travel in the URL. It cannot collide with a real value: user ids
 * are cuids and never this string.
 */
export const SYSTEM_ACTOR = "system";

export type ActivityActor = { id: string; label: string };
