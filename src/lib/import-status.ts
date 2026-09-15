import { z } from "zod";

/**
 * The status vocabulary of `ImportConflict`, whose column is a plain `String`
 * (B0, following the `ImportRun.trigger` precedent: a new state never needs an
 * enum migration). The column stays free-form in Postgres; THIS is the enum,
 * and every write site spells its value from here rather than as a literal —
 * until the 2026-09-04 plan audit the vocabulary lived only as string literals
 * at each site, which is the drift the precedent exists to prevent.
 *
 * `SHEET_SYNC_STATUSES` and `SHEET_SYNC_DIRECTIONS` used to live here too, for
 * `SheetSyncRun`. Google Sheets is gone (plan C, 2026-09-15) and so is that
 * table; they went with it.
 */
export const IMPORT_CONFLICT_STATUSES = ["OPEN", "RESOLVED"] as const;
export type ImportConflictStatus = (typeof IMPORT_CONFLICT_STATUSES)[number];
export const importConflictStatusSchema = z.enum(IMPORT_CONFLICT_STATUSES);
export const IMPORT_CONFLICT_STATUS = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
} as const satisfies Record<ImportConflictStatus, ImportConflictStatus>;
