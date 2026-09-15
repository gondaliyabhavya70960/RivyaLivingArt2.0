import { describe, expect, it } from "vitest";

import {
  SHEET_CONFLICT_STATUS,
  SHEET_SYNC_DIRECTION,
  SHEET_SYNC_STATUS,
  importConflictStatusSchema,
  sheetSyncDirectionSchema,
  sheetSyncStatusSchema,
} from "@/lib/sheet-status";

/**
 * `ImportConflict.status`, `SheetSyncRun.status` and `.direction` are String
 * columns whose enum lives in code (schema.prisma's own comment). These pin
 * the code half: every constant a write site uses parses, and case or a
 * stray value is refused.
 */
describe("sheet status vocabulary", () => {
  it("every constant parses through its own schema", () => {
    for (const v of Object.values(SHEET_CONFLICT_STATUS))
      expect(importConflictStatusSchema.parse(v)).toBe(v);
    for (const v of Object.values(SHEET_SYNC_STATUS))
      expect(sheetSyncStatusSchema.parse(v)).toBe(v);
    for (const v of Object.values(SHEET_SYNC_DIRECTION))
      expect(sheetSyncDirectionSchema.parse(v)).toBe(v);
  });

  it("refuses what the database column would silently accept", () => {
    expect(importConflictStatusSchema.safeParse("open").success).toBe(false);
    expect(importConflictStatusSchema.safeParse("SKIPPED").success).toBe(false);
    expect(sheetSyncStatusSchema.safeParse("OK").success).toBe(false);
    expect(sheetSyncDirectionSchema.safeParse("PULL").success).toBe(false);
  });

  it("the default the schema gives a new conflict is in the vocabulary", () => {
    // prisma/schema.prisma: `status String @default("OPEN")`
    expect(importConflictStatusSchema.parse("OPEN")).toBe(SHEET_CONFLICT_STATUS.OPEN);
  });
});
