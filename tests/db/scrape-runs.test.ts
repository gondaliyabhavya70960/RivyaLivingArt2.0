import { beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";

/**
 * Retry and cancel for workflow runs (A9), against a real Postgres.
 *
 * Only a database can prove the two rules the actions announce: a retry
 * leaves the failed row untouched and queues a FRESH job for the same
 * target (history is never rewritten), and a cancel terminal-writes with
 * the operator's name on the error line so the source is never blamed.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const SOURCE = "run-control-test";

async function makeJob(
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED",
): Promise<string> {
  const source = await db!.scrapeSource.findUniqueOrThrow({
    where: { key: SOURCE },
    select: { id: true },
  });
  const job = await db!.scrapeJob.create({
    data: {
      source: { connect: { id: source.id } },
      sourceKey: SOURCE,
      sourceName: SOURCE,
      vertical: "RESIN",
      platform: "SHOPIFY",
      scope: "SOURCE",
      status,
      inputUrl: "https://example.test",
      ...(status === "FAILED" ? { error: "boom" } : {}),
    },
    select: { id: true },
  });
  return job.id;
}

describe.skipIf(!db)("workflow run retry/cancel", () => {
  beforeAll(async () => {
    if (!db) return;
    await db.scrapeJob.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapeSource.deleteMany({ where: { key: SOURCE } });
    await db.scrapeSource.create({
      data: {
        key: SOURCE,
        name: SOURCE,
        baseUrl: "https://example.test",
        tier: "RESIN_GOODS",
      },
    });
  });

  it("retrying a FAILED run queues a FRESH job for the same target and leaves the failed row untouched", async () => {
    const failedId = await makeJob("FAILED");
    const { retryRun } = await import("@/lib/scraper/run-control");
    const outcome = await retryRun(failedId);

    expect(outcome.userError).toBeUndefined();
    expect(outcome.jobId).toBeDefined();
    expect(outcome.jobId).not.toBe(failedId);

    const original = await db!.scrapeJob.findUniqueOrThrow({
      where: { id: failedId },
    });
    expect(original.status).toBe("FAILED");
    expect(original.error).toBe("boom");

    const fresh = await db!.scrapeJob.findUniqueOrThrow({
      where: { id: outcome.jobId },
    });
    expect(fresh.status).toBe("QUEUED");
    expect(fresh.sourceKey).toBe(SOURCE);
    expect(fresh.inputUrl).toBe(original.inputUrl);
    expect(fresh.scope).toBe(original.scope);
  });

  it("retrying a DONE run is refused with the reason, and no job is created", async () => {
    const doneId = await makeJob("DONE");
    const { retryRun } = await import("@/lib/scraper/run-control");
    const outcome = await retryRun(doneId);

    expect(outcome.jobId).toBeUndefined();
    expect(outcome.userError).toContain("Only a failed run");
    expect(
      await db!.scrapeJob.count({ where: { sourceKey: SOURCE, status: "QUEUED" } }),
    ).toBe(0);
  });

  it("retry is refused while the source has a run in flight — the one-run-per-source rule holds", async () => {
    await makeJob("RUNNING");
    const failedId = await makeJob("FAILED");
    const { retryRun } = await import("@/lib/scraper/run-control");
    const outcome = await retryRun(failedId);

    expect(outcome.jobId).toBeUndefined();
    expect(outcome.userError).toContain("already has a run");
  });

  it("cancelling a QUEUED run writes FAILED with the operator's name, and never blames the source", async () => {
    const queuedId = await makeJob("QUEUED");
    const { cancelRun } = await import("@/lib/scraper/run-control");
    const outcome = await cancelRun(queuedId, "Test Operator");

    expect(outcome.cancelled).toBe(true);
    const job = await db!.scrapeJob.findUniqueOrThrow({
      where: { id: queuedId },
    });
    expect(job.status).toBe("FAILED");
    expect(job.error).toContain("Cancelled by Test Operator");
    expect(job.error).toContain("the source did not fail");
    expect(job.finishedAt).not.toBeNull();
  });

  it("cancelling a DONE run is a reported no-op, and the row does not move", async () => {
    const doneId = await makeJob("DONE");
    const { cancelRun } = await import("@/lib/scraper/run-control");
    const outcome = await cancelRun(doneId, "Test Operator");

    expect(outcome.cancelled).toBe(false);
    const job = await db!.scrapeJob.findUniqueOrThrow({
      where: { id: doneId },
    });
    expect(job.status).toBe("DONE");
    expect(job.error).toBeNull();
  });
});
