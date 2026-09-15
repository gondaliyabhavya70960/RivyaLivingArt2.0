import { describe, expect, it } from "vitest";

import {
  IMPORT_CONFLICT_STATUS,
  importConflictStatusSchema,
} from "@/lib/import-status";

/**
 * `ImportConflict.status` is a String column whose enum lives in code
 * (schema.prisma's own comment). These pin the code half: every constant a
 * write site uses parses, and case or a stray value is refused.
 */
describe("import conflict status vocabulary", () => {
  it("every constant parses through its own schema", () => {
    for (const v of Object.values(IMPORT_CONFLICT_STATUS))
      expect(importConflictStatusSchema.parse(v)).toBe(v);
  });

  it("refuses what the database column would silently accept", () => {
    expect(importConflictStatusSchema.safeParse("open").success).toBe(false);
    expect(importConflictStatusSchema.safeParse("SKIPPED").success).toBe(false);
  });

  it("the default the schema gives a new conflict is in the vocabulary", () => {
    // prisma/schema.prisma: `status String @default("OPEN")`
    expect(importConflictStatusSchema.parse("OPEN")).toBe(
      IMPORT_CONFLICT_STATUS.OPEN,
    );
  });
});
