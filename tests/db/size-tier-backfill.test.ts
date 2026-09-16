import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

import {
  applySizeTierBackfill,
  planSizeTierBackfill,
  SIZE_TIER_SUGGEST_ACTION,
  summarizeSizeTierPlan,
} from "@/lib/catalog-size-tier-backfill";
import { getTestDb } from "./helpers";

/**
 * The write side of the catalogue tiering against a real database: WHICH
 * rows the plan reads (untiered, un-edited, non-demo — nothing else), that
 * apply writes exactly the plan and re-checks `sizeTier IS NULL` per row so
 * an owner's tier set in between wins, that one ActivityLog row records the
 * run, and that a second run is a no-op. The pure rule has its own unit
 * suite; this is the contract `prisma/suggest-size-tiers.ts` runs on every
 * production deploy.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const PREFIX = "size-tier-probe-";
const PROBE_SOURCE = "db-test:size-tier-backfill";

/** Categories the probe rows sit in. Seeded by prisma/seed.ts or the CSV
 *  fill in every environment the suite runs in; created here only when
 *  missing (and removed again), so the suite owns its own fixtures. */
const CATEGORIES = {
  jewelry: {
    slug: "resin-jewelry-keychains",
    name: "Resin Jewelry & Keychains",
  },
  supplies: { slug: "supplies-resin", name: "Supplies · Resin" },
  decor: { slug: "resin-home-decor", name: "Resin Home Decor" },
} as const;

type Row = {
  key: string;
  title: string;
  category: keyof typeof CATEGORIES;
  ownerTouched?: boolean;
  isDemo?: boolean;
  sizeTier?: "LARGE_FORMAT" | "MEDIUM_FORMAT" | "SMALL_FORMAT";
};

const ROWS: Row[] = [
  { key: "memory", title: "Engagement Ring Tray", category: "jewelry" },
  {
    key: "personal",
    title: "Resin Bookmark with Real Flowers",
    category: "jewelry",
  },
  {
    key: "supply-title",
    title: "Glass Beads Blue Color 100 Pcs Approx",
    category: "jewelry",
  },
  { key: "supply-category", title: "Resin Coaster Set", category: "supplies" },
  { key: "unsure", title: "Round placemats", category: "decor" },
  {
    key: "edited",
    title: "Resin Coaster Set",
    category: "jewelry",
    ownerTouched: true,
  },
  {
    key: "demo",
    title: "Resin Coaster Set",
    category: "jewelry",
    isDemo: true,
  },
  {
    key: "tiered",
    title: "Resin Coaster Set",
    category: "jewelry",
    sizeTier: "LARGE_FORMAT",
  },
];

const slugOf = (key: string) => `${PREFIX}${key}`;

describe("Database-backed: the size-tier backfill (docs/plan/07 step 3)", () => {
  let db: PrismaClient | null = null;
  const createdCategoryIds: string[] = [];
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    db = await getTestDb();
    if (!db) return;

    const categoryIds: Record<string, string> = {};
    for (const [key, category] of Object.entries(CATEGORIES)) {
      const existing = await db.category.findUnique({
        where: { slug: category.slug },
        select: { id: true },
      });
      if (existing) {
        categoryIds[key] = existing.id;
      } else {
        const created = await db.category.create({
          data: { slug: category.slug, name: category.name },
          select: { id: true },
        });
        categoryIds[key] = created.id;
        createdCategoryIds.push(created.id);
      }
    }

    await db.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    for (const row of ROWS) {
      const created = await db.product.create({
        data: {
          title: row.title,
          slug: slugOf(row.key),
          categoryId: categoryIds[row.category]!,
          ownerTouched: row.ownerTouched ?? false,
          isDemo: row.isDemo ?? false,
          sizeTier: row.sizeTier ?? null,
        },
        select: { id: true },
      });
      ids[row.key] = created.id;
    }
  });

  afterAll(async () => {
    if (!db) return;
    await db.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await db.activityLog.deleteMany({
      where: {
        action: SIZE_TIER_SUGGEST_ACTION,
        meta: { path: ["source"], equals: PROBE_SOURCE },
      },
    });
    if (createdCategoryIds.length > 0) {
      await db.category.deleteMany({
        where: { id: { in: createdCategoryIds } },
      });
    }
    await db.$disconnect();
  });

  const scoped = { slug: { startsWith: PREFIX } };

  it("plans only the untiered, un-edited, non-demo rows, and decides each", async (ctx) => {
    if (!db) return ctx.skip();

    const plan = await planSizeTierBackfill(db, scoped);
    expect(plan.scanned).toBe(5);
    expect(plan.ids.MEDIUM_FORMAT).toEqual([ids.memory]);
    expect(plan.ids.SMALL_FORMAT).toEqual([ids.personal]);
    expect(plan.ids.LARGE_FORMAT).toEqual([]);
    expect(plan.samples.MEDIUM_FORMAT).toEqual(["Engagement Ring Tray"]);
    expect(plan.samples.SMALL_FORMAT).toEqual([
      "Resin Bookmark with Real Flowers",
    ]);
    expect(plan.skipped).toEqual({ supplies: 2, unsure: 1 });

    const summary = summarizeSizeTierPlan(plan);
    expect(summary).toEqual({
      total: 2,
      byTier: { LARGE_FORMAT: 0, MEDIUM_FORMAT: 1, SMALL_FORMAT: 1 },
    });
  });

  it("writes exactly the plan, keeps a tier set in between, and logs one row", async (ctx) => {
    if (!db) return ctx.skip();

    const plan = await planSizeTierBackfill(db, scoped);
    // The owner tiers one planned row by hand between the plan and the apply.
    await db.product.update({
      where: { id: ids.personal },
      data: { sizeTier: "MEDIUM_FORMAT" },
    });

    const result = await applySizeTierBackfill(db, plan, {
      source: PROBE_SOURCE,
    });
    expect(result).toEqual({
      total: 1,
      updated: { LARGE_FORMAT: 0, MEDIUM_FORMAT: 1, SMALL_FORMAT: 0 },
    });

    const rows = await db.product.findMany({
      where: scoped,
      select: { slug: true, sizeTier: true },
      orderBy: { slug: "asc" },
    });
    const tierOf = Object.fromEntries(rows.map((r) => [r.slug, r.sizeTier]));
    expect(tierOf[slugOf("memory")]).toBe("MEDIUM_FORMAT");
    expect(tierOf[slugOf("personal")]).toBe("MEDIUM_FORMAT"); // the owner's, kept
    expect(tierOf[slugOf("supply-title")]).toBeNull();
    expect(tierOf[slugOf("supply-category")]).toBeNull();
    expect(tierOf[slugOf("unsure")]).toBeNull();
    expect(tierOf[slugOf("edited")]).toBeNull();
    expect(tierOf[slugOf("demo")]).toBeNull();
    expect(tierOf[slugOf("tiered")]).toBe("LARGE_FORMAT");

    const logs = await db.activityLog.findMany({
      where: {
        action: SIZE_TIER_SUGGEST_ACTION,
        meta: { path: ["source"], equals: PROBE_SOURCE },
      },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.userId).toBeNull();
    expect(logs[0]!.entity).toBe("Product");
    expect(logs[0]!.meta).toMatchObject({
      source: PROBE_SOURCE,
      total: 1,
      scanned: 5,
      updated: { MEDIUM_FORMAT: 1, SMALL_FORMAT: 0 },
      skipped: { supplies: 2, unsure: 1 },
    });
  });

  it("is a no-op the second time — nothing written, nothing logged", async (ctx) => {
    if (!db) return ctx.skip();

    const plan = await planSizeTierBackfill(db, scoped);
    expect(plan.scanned).toBe(3);
    expect(summarizeSizeTierPlan(plan).total).toBe(0);
    expect(plan.skipped).toEqual({ supplies: 2, unsure: 1 });

    const result = await applySizeTierBackfill(db, plan, {
      source: PROBE_SOURCE,
    });
    expect(result.total).toBe(0);

    const logs = await db.activityLog.count({
      where: {
        action: SIZE_TIER_SUGGEST_ACTION,
        meta: { path: ["source"], equals: PROBE_SOURCE },
      },
    });
    expect(logs).toBe(1);
  });
});
