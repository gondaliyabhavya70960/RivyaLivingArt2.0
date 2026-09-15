import { z } from "zod";

/**
 * The status vocabulary of the two Sheets tables whose columns are plain
 * `String` (B0 · sheets, the `ImportRun.trigger` precedent: a new state never
 * needs an enum migration). The column stays free-form in Postgres; THIS is
 * the enum, and every write site spells its value from here rather than as a
 * literal — until the 2026-09-04 plan audit the vocabulary lived only as
 * string literals at each site, which is the drift the precedent exists to
 * prevent.
 */
export const SHEET_CONFLICT_STATUSES = ["OPEN", "RESOLVED"] as const;
export type ImportConflictStatus = (typeof SHEET_CONFLICT_STATUSES)[number];
export const importConflictStatusSchema = z.enum(SHEET_CONFLICT_STATUSES);
export const SHEET_CONFLICT_STATUS = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
} as const satisfies Record<ImportConflictStatus, ImportConflictStatus>;

export const SHEET_SYNC_DIRECTIONS = ["PUSH"] as const;
export type SheetSyncDirection = (typeof SHEET_SYNC_DIRECTIONS)[number];
export const sheetSyncDirectionSchema = z.enum(SHEET_SYNC_DIRECTIONS);
export const SHEET_SYNC_DIRECTION = {
  PUSH: "PUSH",
} as const satisfies Record<SheetSyncDirection, SheetSyncDirection>;

export const SHEET_SYNC_STATUSES = [
  "SYNCED",
  "FAILED",
  "UNCONFIGURED",
  "EMPTY",
] as const;
export type SheetSyncStatus = (typeof SHEET_SYNC_STATUSES)[number];
export const sheetSyncStatusSchema = z.enum(SHEET_SYNC_STATUSES);
export const SHEET_SYNC_STATUS = {
  SYNCED: "SYNCED",
  FAILED: "FAILED",
  UNCONFIGURED: "UNCONFIGURED",
  EMPTY: "EMPTY",
} as const satisfies Record<SheetSyncStatus, SheetSyncStatus>;
