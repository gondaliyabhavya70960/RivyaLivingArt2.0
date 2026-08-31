import type { ScrapeJobStatus, SheetSyncPolicy } from "@/generated/prisma/enums";

/**
 * Does this finished job push itself to the sheet?
 *
 * The whole of "automatic push" is this one decision, so it lives where it can
 * be tested rather than inside the Server Action that runs a scrape — that one
 * needs a database, a logged-in staff session and a reachable upstream site
 * before it will reach the branch at all.
 *
 * Only DONE pushes. A FAILED job has partial rows by definition — the counts
 * up to the failure point are kept — and publishing a partial catalog to the
 * owner's shared sheet without them asking is the wrong default. They can
 * still push it by hand.
 */
export function shouldPushOnComplete(
  status: ScrapeJobStatus,
  policy: SheetSyncPolicy | null | undefined,
): boolean {
  return status === "DONE" && policy === "ON_COMPLETE";
}

/** Human-readable, for the source page and the activity log. */
export const SHEET_POLICY_LABEL: Record<SheetSyncPolicy, string> = {
  MANUAL: "when I add",
  ON_COMPLETE: "after every scrape",
  OFF: "never",
};
