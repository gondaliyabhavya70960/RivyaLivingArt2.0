import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

import {
  ROLLOUT_ACTION,
  ROLLOUT_REVIEWER,
  runReferenceRollout,
  type ManualEntry,
  type RolloutEntry,
} from "@/lib/scraper/backlog-rollout";
import { getTestDb } from "./helpers";

/**
 * The reference-site rollout against a real database: it records the review,
 * enables, caps and queues exactly one first job per automatable source,
 * files the rest as manual research, writes one ActivityLog row, and is a
 * no-op the second time. A source a person has reviewed is never touched.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const PREFIX = "rollout-probe-";

const rollout: RolloutEntry[] = [
  {
    key: `${PREFIX}auto`,
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence: "Publishes the WooCommerce Store API; robots.txt allows /.",
  },
  {
    key: `${PREFIX}reviewed`,
    platform: "SHOPIFY",
    maxProducts: 500,
    evidence: "Publishes the Shopify catalogue API; robots.txt allows /.",
  },
];
const manual: ManualEntry[] = [
  { key: `${PREFIX}gated`, reason: "Cloudflare challenge on every page." },
];

describe("Database-backed: the reference-site rollout", () => {
  let db: PrismaClient | null = null;
  const ids: Record<string, string> = {};
  let startedAt = new Date();

  beforeAll(async () => {
    db = await getTestDb();
    if (!db) return;
    startedAt = new Date();
    await db.scrapeSource.deleteMany({
      where: { key: { startsWith: PREFIX } },
    });
    for (const key of [
      ...rollout.map((e) => e.key),
      ...manual.map((e) => e.key),
    ]) {
      const row = await db.scrapeSource.create({
        data: {
          key,
          name: key,
          baseUrl: `https://${key}.test`,
          tier: "LARGE_FORMAT",
          enabled: false,
          platform: "UNKNOWN",
        },
        select: { id: true },
      });
      ids[key] = row.id;
    }
    // A person reviewed this one already (and left it PENDING on purpose).
    await db.activityLog.create({
      data: {
        action: "policy-review",
        entity: "ScrapeSource",
        meta: { count: 1, ids: [ids[`${PREFIX}reviewed`]], status: "PENDING" },
      },
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.scrapeJob.deleteMany({
      where: { sourceKey: { startsWith: PREFIX } },
    });
    await db.activityLog.deleteMany({
      where: {
        OR: [
          { action: ROLLOUT_ACTION, createdAt: { gte: startedAt } },
          {
            action: "policy-review",
            meta: { path: ["ids"], array_contains: [ids[`${PREFIX}reviewed`]] },
          },
        ],
      },
    });
    await db.scrapeSource.deleteMany({
      where: { key: { startsWith: PREFIX } },
    });
    await db.$disconnect();
  });

  it("reviews, enables, caps and queues the automatable source; files the gated one; leaves the reviewed one alone", async (ctx) => {
    if (!db) return ctx.skip();
    const now = new Date();
    const summary = await runReferenceRollout(db, { rollout, manual }, now);
    expect(summary.queued).toEqual([`${PREFIX}auto`]);
    expect(summary.manual).toEqual([`${PREFIX}gated`]);
    expect(summary.skipped).toEqual({
      [`${PREFIX}reviewed`]:
        "a person has recorded a policy review — their decision stands",
    });
    expect(summary.missing).toEqual([]);

    const auto = await db.scrapeSource.findUniqueOrThrow({
      where: { key: `${PREFIX}auto` },
    });
    expect(auto).toMatchObject({
      enabled: true,
      collectionMode: "HTTP",
      policyReviewStatus: "APPROVED",
      policyReviewedBy: ROLLOUT_REVIEWER,
      platform: "WOOCOMMERCE",
      maxProducts: 500,
    });
    expect(auto.policyReviewedAt?.getTime()).toBe(now.getTime());
    expect(auto.policyReviewNote).toContain("robots.txt allows /");

    const jobs = await db.scrapeJob.findMany({
      where: { sourceId: auto.id },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      status: "QUEUED",
      platform: "WOOCOMMERCE",
      inputUrl: auto.baseUrl,
      sourceKey: auto.key,
    });

    const gated = await db.scrapeSource.findUniqueOrThrow({
      where: { key: `${PREFIX}gated` },
    });
    expect(gated).toMatchObject({
      enabled: false,
      collectionMode: "MANUAL_RESEARCH",
      policyReviewStatus: "PENDING",
    });
    expect(gated.policyReviewNote).toContain("Cloudflare");

    const reviewed = await db.scrapeSource.findUniqueOrThrow({
      where: { key: `${PREFIX}reviewed` },
    });
    expect(reviewed).toMatchObject({
      enabled: false,
      policyReviewStatus: "PENDING",
      platform: "UNKNOWN",
      maxProducts: null,
    });

    const log = await db.activityLog.findMany({
      where: { action: ROLLOUT_ACTION, createdAt: { gte: startedAt } },
    });
    expect(log).toHaveLength(1);
    expect(log[0]!.userId).toBeNull();
    expect(log[0]!.meta).toMatchObject({
      reviewer: ROLLOUT_REVIEWER,
      queued: [`${PREFIX}auto`],
      manual: [`${PREFIX}gated`],
    });
  });

  it("is spent the second time: nothing queued, nothing filed, nothing logged", async (ctx) => {
    if (!db) return ctx.skip();
    const summary = await runReferenceRollout(db, { rollout, manual });
    expect(summary.queued).toEqual([]);
    expect(summary.manual).toEqual([]);
    // The first run left it APPROVED (with a job); the review is the first
    // reason that applies, and either one is a spent rollout.
    expect(summary.skipped[`${PREFIX}auto`]).toBe("already approved");
    expect(summary.skipped[`${PREFIX}gated`]).toBe("already manual research");

    const jobs = await db.scrapeJob.count({
      where: { sourceKey: `${PREFIX}auto` },
    });
    expect(jobs).toBe(1);
    const log = await db.activityLog.count({
      where: { action: ROLLOUT_ACTION, createdAt: { gte: startedAt } },
    });
    expect(log).toBe(1);
  });

  it("reports an unregistered key rather than creating it", async (ctx) => {
    if (!db) return ctx.skip();
    const summary = await runReferenceRollout(db, {
      rollout: [{ ...rollout[0]!, key: `${PREFIX}ghost` }],
      manual: [],
    });
    expect(summary.missing).toEqual([`${PREFIX}ghost`]);
    expect(
      await db.scrapeSource.count({ where: { key: `${PREFIX}ghost` } }),
    ).toBe(0);
  });
});
