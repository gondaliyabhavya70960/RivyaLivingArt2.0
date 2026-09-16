import { beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import { ShortlistState } from "@/lib/scraper/shortlist";
import {
  markImportedConfirmed,
  mirrorLegacyReviewStatus,
  setEntryNote,
  transitionEntries,
} from "@/lib/scraper/shortlist-write";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * The shortlist write path, against a real Postgres (B7).
 *
 * Pure tests prove the state machine's SHAPE; only a database can prove the
 * two halves meet — that a move lands as an entry row with its provenance,
 * that the machine's refusal is honoured end-to-end (NEW never reaches
 * CONFIRMED directly), and that the legacy mirror writes the same staged row
 * the import path reads. That meeting point is the whole rule: human
 * confirmation gates the final list.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const SOURCE = "shortlist-write-test";

function product(overrides: Partial<RichProduct> = {}): RichProduct {
  return {
    externalId: "ext-1",
    url: "https://example.test/p/1",
    sourceKey: SOURCE,
    vertical: "resin",
    currency: "INR",
    title: "River Console",
    slug: "river-console",
    priceMin: 45000,
    images: [],
    imageAlts: [],
    fields: {},
    ...overrides,
  };
}

async function researchProductId(externalId: string): Promise<string> {
  const row = await db!.researchProduct.findUniqueOrThrow({
    where: { sourceKey_externalId: { sourceKey: SOURCE, externalId } },
    select: { id: true },
  });
  return row.id;
}

describe.skipIf(!db)("shortlist write path", () => {
  beforeAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapeSource.upsert({
      where: { key: SOURCE },
      create: {
        key: SOURCE,
        name: SOURCE,
        baseUrl: "https://example.test",
        tier: "LARGE_FORMAT",
      },
      update: {},
    });
    const source = await db.scrapeSource.findUniqueOrThrow({
      where: { key: SOURCE },
      select: { id: true },
    });
    const job = await db.scrapeJob.create({
      data: {
        source: { connect: { id: source.id } },
        sourceKey: SOURCE,
        sourceName: SOURCE,
        vertical: "RESIN",
        platform: "SHOPIFY",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: "https://example.test",
      },
      select: { id: true },
    });
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(job.id, SOURCE, [
      product(),
      product({
        externalId: "ext-2",
        url: "https://example.test/p/2",
        title: "Coaster Set",
        slug: "coaster-set",
      }),
    ]);
  });

  it("a first move creates the entry with who/when/why", async () => {
    const id = await researchProductId("ext-1");
    const report = await transitionEntries([id], ShortlistState.REVIEW, {
      changedBy: "user-1",
      reason: "worth a look",
    });
    expect(report).toMatchObject({ moved: 1, already: 0, blocked: [] });

    const entry = await db!.shortlistEntry.findUniqueOrThrow({
      where: { researchProductId: id },
    });
    expect(entry.state).toBe(ShortlistState.REVIEW);
    expect(entry.changedBy).toBe("user-1");
    expect(entry.reason).toBe("worth a look");
    expect(entry.changedAt.getTime()).toBeGreaterThan(0);
  });

  it("NEW never reaches CONFIRMED directly — the gate holds in the database", async () => {
    const id = await researchProductId("ext-2");
    const report = await transitionEntries([id], ShortlistState.CONFIRMED, {
      changedBy: "user-1",
    });
    expect(report.moved).toBe(0);
    expect(report.blocked).toHaveLength(1);
    expect(report.blocked[0]).toMatchObject({
      researchProductId: id,
      from: ShortlistState.NEW,
      to: ShortlistState.CONFIRMED,
    });
    const entry = await db!.shortlistEntry.findUnique({
      where: { researchProductId: id },
    });
    expect(entry).toBeNull();
  });

  it("SHORTLISTED mirrors the staged twin to APPROVED for the import path", async () => {
    const id = await researchProductId("ext-1");
    const report = await transitionEntries([id], ShortlistState.SHORTLISTED, {
      changedBy: "user-1",
    });
    expect(report.moved).toBe(1);

    const twin = await db!.scrapedProduct.findUniqueOrThrow({
      where: {
        sourceKey_externalId: { sourceKey: SOURCE, externalId: "ext-1" },
      },
    });
    expect(twin.reviewStatus).toBe("APPROVED");
  });

  it("SHORTLISTED → CONFIRMED is the one door to the final list", async () => {
    const id = await researchProductId("ext-1");
    const report = await transitionEntries([id], ShortlistState.CONFIRMED, {
      changedBy: "user-1",
      reason: "final list for the festive benchmark",
    });
    expect(report.moved).toBe(1);

    const entry = await db!.shortlistEntry.findUniqueOrThrow({
      where: { researchProductId: id },
    });
    expect(entry.state).toBe(ShortlistState.CONFIRMED);

    // Confirming is not importing — the twin keeps its APPROVED mirror.
    const twin = await db!.scrapedProduct.findUniqueOrThrow({
      where: {
        sourceKey_externalId: { sourceKey: SOURCE, externalId: "ext-1" },
      },
    });
    expect(twin.reviewStatus).toBe("APPROVED");
  });

  it("CONFIRMED leaves only back to SHORTLISTED", async () => {
    const id = await researchProductId("ext-1");
    const rejected = await transitionEntries([id], ShortlistState.REJECTED, {
      changedBy: "user-1",
    });
    expect(rejected.blocked).toHaveLength(1);

    const back = await transitionEntries([id], ShortlistState.SHORTLISTED, {
      changedBy: "user-1",
    });
    expect(back.moved).toBe(1);
  });

  it("the legacy mirror never un-confirms an entry", async () => {
    const id = await researchProductId("ext-1");
    await transitionEntries([id], ShortlistState.CONFIRMED, {
      changedBy: "user-1",
    });
    await mirrorLegacyReviewStatus(
      [{ sourceKey: SOURCE, externalId: "ext-1" }],
      "REJECTED",
      "user-2",
    );
    const entry = await db!.shortlistEntry.findUniqueOrThrow({
      where: { researchProductId: id },
    });
    expect(entry.state).toBe(ShortlistState.CONFIRMED);
  });

  it("the legacy mirror moves an unconfirmed entry with the decision", async () => {
    const id = await researchProductId("ext-2");
    await mirrorLegacyReviewStatus(
      [{ sourceKey: SOURCE, externalId: "ext-2" }],
      "APPROVED",
      "user-2",
    );
    const entry = await db!.shortlistEntry.findUniqueOrThrow({
      where: { researchProductId: id },
    });
    expect(entry.state).toBe(ShortlistState.SHORTLISTED);
    expect(entry.reason).toBe("legacy reviewStatus APPROVED");
  });

  it("markImportedConfirmed lands CONFIRMED from any state, with its reason", async () => {
    const id = await researchProductId("ext-2");
    // Park it first — the import path confirms regardless of where it sat.
    await transitionEntries([id], ShortlistState.INSPIRATION_ONLY, {
      changedBy: "user-1",
    });
    await markImportedConfirmed(
      { sourceKey: SOURCE, externalId: "ext-2" },
      "user-3",
    );
    const entry = await db!.shortlistEntry.findUniqueOrThrow({
      where: { researchProductId: id },
    });
    expect(entry.state).toBe(ShortlistState.CONFIRMED);
    expect(entry.reason).toBe("imported to catalog");
    expect(entry.changedBy).toBe("user-3");
  });

  it("a note is a first touch that creates the entry without moving it", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    const jobs = await db!.scrapeJob.findMany({
      where: { sourceKey: SOURCE },
      select: { id: true },
    });
    await upsertPageForTest(jobs[0].id, SOURCE, [
      product({
        externalId: "ext-3",
        url: "https://example.test/p/3",
        title: "Side Table",
        slug: "side-table",
      }),
    ]);
    const id = await researchProductId("ext-3");
    await setEntryNote(id, "check whether this is cm or mm", "user-1");
    const entry = await db!.shortlistEntry.findUniqueOrThrow({
      where: { researchProductId: id },
    });
    expect(entry.state).toBe(ShortlistState.NEW);
    expect(entry.note).toBe("check whether this is cm or mm");
  });
});
