import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import { AUTOMATABLE_SOURCE_WHERE } from "@/lib/scraper/policy";

/**
 * The governance gate, against a real database: **a registered source is not
 * an authorised one.**
 *
 * The claim worth proving here is not that a pure function returns a string —
 * `policy.test.ts` covers that. It is that a job which somehow reaches the
 * runner against an unreviewed source STOPS, and stops without staging
 * anything. The enqueue check can be bypassed by time alone: a job sits QUEUED,
 * the owner blocks the source, and the cron drain picks the job up ten minutes
 * later with no operator present.
 */
const db = await getTestDb();
const SOURCE_KEY = "policy-gate-test";

describe.skipIf(!db)("the governance gate stops a job at the runner", () => {
  let sourceId: string;

  beforeAll(async () => {
    if (!db) return;
    await db.scrapeJob.deleteMany({ where: { sourceKey: SOURCE_KEY } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE_KEY } });
    await db.scrapeSource.deleteMany({ where: { key: SOURCE_KEY } });

    const source = await db.scrapeSource.create({
      data: {
        key: SOURCE_KEY,
        name: "Policy Gate Test",
        baseUrl: "https://policy-gate.test",
        tier: "RESIN_GOODS",
        platform: "JSONLD",
        // collectionMode HTTP / policyReviewStatus PENDING come from the
        // schema defaults — which is exactly the state every row in the
        // registry was migrated into.
      },
      select: { id: true },
    });
    sourceId = source.id;
  });

  // Leave the shared database as this suite found it (the convention the
  // older suites already follow): league-wide medians in analytics.test.ts
  // read EVERY source, so a suite that leaves priced rows behind moves
  // another suite's numbers on the next run.
  afterAll(async () => {
    if (!db) return;
    await db.scrapeJob.deleteMany({ where: { sourceKey: SOURCE_KEY } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE_KEY } });
    await db.scrapeSource.deleteMany({ where: { key: SOURCE_KEY } });
  });

  const queueJob = async () => {
    const job = await db!.scrapeJob.create({
      data: {
        source: { connect: { id: sourceId } },
        sourceKey: SOURCE_KEY,
        sourceName: "Policy Gate Test",
        vertical: "resin",
        platform: "JSONLD",
        scope: "SOURCE",
        status: "QUEUED",
        inputUrl: "https://policy-gate.test",
      },
      select: { id: true },
    });
    return job.id;
  };

  it("fails a queued job against an unreviewed source, and stages nothing", async () => {
    const { advanceScrapeJob } = await import("@/lib/scraper/job-runner");
    const jobId = await queueJob();

    const snapshot = await advanceScrapeJob(jobId, null);

    expect(snapshot.status).toBe("FAILED");
    expect(snapshot.error).toMatch(/has not had a policy review/);
    // Never reached the fetcher: no page was crawled, nothing was staged.
    expect(snapshot.totalScraped).toBe(0);
    expect(
      await db!.scrapedProduct.count({ where: { sourceKey: SOURCE_KEY } }),
    ).toBe(0);
  });

  it("fails it with the reviewer's own words once the source is blocked", async () => {
    const { advanceScrapeJob } = await import("@/lib/scraper/job-runner");
    await db!.scrapeSource.update({
      where: { id: sourceId },
      data: {
        policyReviewStatus: "BLOCKED",
        policyReviewNote: "Terms forbid automated access.",
      },
    });
    const jobId = await queueJob();

    const snapshot = await advanceScrapeJob(jobId, null);

    expect(snapshot.status).toBe("FAILED");
    expect(snapshot.error).toMatch(/Terms forbid automated access\./);
  });

  it("stops refusing on policy grounds once a review is recorded", async () => {
    // Read the row BACK out of Postgres and put it through the gate, rather
    // than advancing a job. Advancing an authorised job runs the whole runner,
    // which ends in `revalidatePath` and throws outside a Next request — the
    // same reason the other db tests reach for `upsertPageForTest`. What is
    // worth proving here is that the enums round-trip through the database
    // into the gate, which this does and a mocked object would not.
    const { describeUnauthorizedRun } = await import("@/lib/scraper/policy");
    await db!.scrapeSource.update({
      where: { id: sourceId },
      data: {
        policyReviewStatus: "APPROVED",
        policyReviewedAt: new Date(),
        policyReviewedBy: "test",
        policyReviewNote: null,
      },
    });

    const stored = await db!.scrapeSource.findUniqueOrThrow({
      where: { id: sourceId },
      select: {
        name: true,
        collectionMode: true,
        policyReviewStatus: true,
        policyReviewNote: true,
      },
    });
    expect(describeUnauthorizedRun(stored.name, stored)).toBeNull();
  });

  it("refuses manual-research even when the review says allowed", async () => {
    const { advanceScrapeJob } = await import("@/lib/scraper/job-runner");
    await db!.scrapeSource.update({
      where: { id: sourceId },
      data: { collectionMode: "MANUAL_RESEARCH" },
    });
    const jobId = await queueJob();

    const snapshot = await advanceScrapeJob(jobId, null);

    expect(snapshot.status).toBe("FAILED");
    expect(snapshot.error).toMatch(/manual research/);
  });
});

describe.skipIf(!db)("the tier fan-out filters in the query", () => {
  it("excludes an unreviewed source and includes a reviewed one", async () => {
    const key = "policy-gate-where";
    await db!.scrapeSource.deleteMany({ where: { key } });
    const row = await db!.scrapeSource.create({
      data: {
        key,
        name: "Where Clause Test",
        baseUrl: "https://where-clause.test",
        tier: "RESIN_GOODS",
        platform: "SHOPIFY",
      },
      select: { id: true },
    });

    const unreviewed = await db!.scrapeSource.findFirst({
      where: { id: row.id, ...AUTOMATABLE_SOURCE_WHERE },
    });
    expect(unreviewed).toBeNull();

    await db!.scrapeSource.update({
      where: { id: row.id },
      data: { policyReviewStatus: "APPROVED", policyReviewedAt: new Date() },
    });
    const reviewed = await db!.scrapeSource.findFirst({
      where: { id: row.id, ...AUTOMATABLE_SOURCE_WHERE },
    });
    expect(reviewed).not.toBeNull();

    await db!.scrapeSource.deleteMany({ where: { key } });
  });
});

describe.skipIf(!db)("a decision the registry already recorded survives", () => {
  it("keeps the enquiry-only source on manual research", async () => {
    // Its seed note has said "Do NOT scrape" all along; before this gate that
    // sentence was prose nothing enforced. Both paths that can produce the row
    // — the migration's backfill and a fresh bootstrap's create — must land it
    // in MANUAL_RESEARCH, so the assertion holds either way.
    const row = await db!.scrapeSource.findUnique({
      where: { key: "poonam-shah-art" },
      select: { collectionMode: true },
    });
    if (!row) return; // registry not seeded in this database
    expect(row.collectionMode).toBe("MANUAL_RESEARCH");
  });
});
