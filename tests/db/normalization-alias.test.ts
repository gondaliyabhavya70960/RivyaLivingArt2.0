import { beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import { AliasKind } from "@/generated/prisma/enums";
import { aliasKey, resolveWithMap } from "@/lib/scraper/alias-resolver";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * B4's whole claim, end to end: **a mapping fix needs no re-scrape.**
 *
 * The test captures a snapshot once, then changes an alias row, then re-reads
 * the SAME snapshot and expects a different normalized answer — with no second
 * call to the scraper. That only works because `rawPayload` keeps the source's
 * own words, which is the bug B4 also fixes (B2 stored the normalized row).
 */
const db = await getTestDb();
const SOURCE = "alias-test";

describe.skipIf(!db)("aliases re-label history without a re-scrape", () => {
  let jobId: string;
  let snapshotId: string;

  beforeAll(async () => {
    if (!db) return;
    await db.normalizationAlias.deleteMany({
      where: { rawValue: { in: [aliasKey("sheesham"), aliasKey("teakwood")] } },
    });
    await db.researchProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE } });

    const source = await db.scrapeSource.findFirstOrThrow({ select: { id: true } });
    const job = await db.scrapeJob.create({
      data: {
        source: { connect: { id: source.id } },
        sourceKey: SOURCE,
        sourceName: SOURCE,
        vertical: "RESIN",
        platform: "JSONLD",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: "https://example.test",
      },
      select: { id: true },
    });
    jobId = job.id;

    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, SOURCE, [
      {
        externalId: "table-1",
        url: "https://example.test/p/table",
        sourceKey: SOURCE,
        vertical: "resin",
        currency: "INR",
        title: "River table",
        slug: "river-table",
        materials: "sheesham",
        images: [],
        imageAlts: [],
        fields: {},
      },
    ]);

    const identity = await db.researchProduct.findUniqueOrThrow({
      where: { sourceKey_externalId: { sourceKey: SOURCE, externalId: "table-1" } },
      select: { id: true },
    });
    const snap = await db.productSnapshot.findFirstOrThrow({
      where: { researchProductId: identity.id },
      select: { id: true },
    });
    snapshotId = snap.id;
  });

  /** Read the snapshot's raw material and normalize it against the table NOW. */
  async function materialAsReadToday(): Promise<string> {
    const snap = await db!.productSnapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      select: { rawPayload: true },
    });
    const raw = (snap.rawPayload as unknown as RichProduct).materials ?? "";
    const rows = await db!.normalizationAlias.findMany({
      where: { kind: AliasKind.MATERIAL },
      select: { rawValue: true, canonicalValue: true },
    });
    const map = Object.fromEntries(
      rows.map((r) => [r.rawValue, r.canonicalValue]),
    );
    return resolveWithMap(map, AliasKind.MATERIAL, raw);
  }

  it("falls back to the built-in map while the table is empty", async () => {
    const before = await materialAsReadToday();
    // normalize.ts title-cases it; the exact string is its business, not ours.
    expect(before.toLowerCase()).toContain("sheesham");
  });

  it("an alias added AFTER capture changes how the snapshot reads", async () => {
    await db!.normalizationAlias.create({
      data: {
        kind: AliasKind.MATERIAL,
        rawValue: aliasKey("sheesham"),
        canonicalValue: "Indian Rosewood",
        createdBy: null,
      },
    });

    // No re-scrape. Same snapshot row, same rawPayload, different answer.
    expect(await materialAsReadToday()).toBe("Indian Rosewood");

    const snap = await db!.productSnapshot.findUniqueOrThrow({
      where: { id: snapshotId },
      select: { rawPayload: true },
    });
    // The source's own word is untouched — that is what makes this reversible.
    expect((snap.rawPayload as unknown as RichProduct).materials).toBe("sheesham");
  });

  it("correcting the alias again re-labels it again", async () => {
    await db!.normalizationAlias.update({
      where: {
        kind_rawValue: { kind: AliasKind.MATERIAL, rawValue: aliasKey("sheesham") },
      },
      data: { canonicalValue: "Sheesham Wood" },
    });
    expect(await materialAsReadToday()).toBe("Sheesham Wood");
  });

  it("the unique constraint de-duplicates on the stored key", async () => {
    await expect(
      db!.normalizationAlias.create({
        data: {
          kind: AliasKind.MATERIAL,
          rawValue: aliasKey("  SHEESHAM  "),
          canonicalValue: "Something else",
        },
      }),
    ).rejects.toThrow();
  });
});
