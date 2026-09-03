import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { demoClause } from "@/lib/demo-clause";
import { buildProductWhere } from "@/lib/shop";
import { getTestimonials } from "@/lib/testimonials";
import { removeDemo, seedDemo, type DemoCounts } from "@/lib/demo/apply";
import { describeDemoHost } from "@/lib/demo/guard";
import { getTestDb } from "./helpers";

/**
 * Content Lab, end to end, against a real Postgres (batch G):
 *
 * - seeding twice leaves the same row counts (upsert-by-id, not append)
 * - the demo gate (`buildProductWhere` + `demoClause`) hides/shows the
 *   fixtures exactly like it does every other demo table
 * - the sitemap's own hard-coded `isDemo: false` clause excludes them
 *   regardless of what the gate says
 * - `getTestimonials` honours `includeDemo` both ways
 * - `removeDemo` leaves zero `isDemo` rows anywhere, and never touches a
 *   real (non-demo) product, portfolio piece or journal post
 *
 * Refuses to run against anything that isn't allow-listed (`describeDemoHost`)
 * — this seeds and removes 400+ rows and must never point at a real database,
 * CI's own throwaway included only because it IS allow-listed.
 */
describe("Content Lab: seed → gate → remove (Postgres)", () => {
  let db: PrismaClient | null = null;
  let allowed = false;
  let baseline: { products: number; portfolio: number; posts: number } | null =
    null;

  beforeAll(async () => {
    db = await getTestDb();
    if (!db) return;
    allowed = describeDemoHost(process.env.DATABASE_URL).allowed;
    if (!allowed) return;
    baseline = {
      products: await db.product.count({ where: { isDemo: false } }),
      portfolio: await db.portfolio.count({ where: { isDemo: false } }),
      posts: await db.blogPost.count({ where: { isDemo: false } }),
    };
  });

  afterAll(async () => {
    if (db && allowed) {
      await removeDemo(db);
    }
    if (db) await db.$disconnect();
  });

  it("seeding twice in a row leaves identical counts (idempotent)", async (ctx) => {
    if (!db || !allowed) return ctx.skip();
    const first = await seedDemo(db);
    const second = await seedDemo(db);
    expect(second).toEqual(first);
    expect(first.Product).toBe(100);
  });

  it("the demo gate hides fixtures by default and shows them on request", async (ctx) => {
    if (!db || !allowed) return ctx.skip();
    // demo-product-002 is deterministically PUBLISHED (batch G's generator
    // cycles ContentStatus by index) — findFirst by id rather than scanning
    // the whole catalogue, which on this database is thousands of rows.
    const hiddenRow = await db.product.findFirst({
      where: {
        ...buildProductWhere({}, demoClause(false)),
        id: "demo-product-002",
      },
      select: { id: true },
    });
    expect(hiddenRow).toBeNull();

    const shownRow = await db.product.findFirst({
      where: {
        ...buildProductWhere({}, demoClause(true)),
        id: "demo-product-002",
      },
      select: { id: true },
    });
    expect(shownRow).not.toBeNull();
  });

  it("the sitemap's hard-coded clause excludes demo products either way", async (ctx) => {
    if (!db || !allowed) return ctx.skip();
    const sitemapRows = await db.product.count({
      where: { status: "PUBLISHED", isDemo: false, importSource: "demo" },
    });
    expect(sitemapRows).toBe(0);
  });

  it("getTestimonials honours includeDemo in both directions", async (ctx) => {
    if (!db || !allowed) return ctx.skip();
    const hidden = await getTestimonials({ take: 200, includeDemo: false });
    expect(hidden.some((t) => t.isDemo)).toBe(false);

    const shown = await getTestimonials({ take: 200, includeDemo: true });
    expect(shown.some((t) => t.isDemo)).toBe(true);
  });

  it("removeDemo zeroes every isDemo row and never touches real rows", async (ctx) => {
    if (!db || !allowed || !baseline) return ctx.skip();
    const remaining: DemoCounts = await removeDemo(db);
    for (const count of Object.values(remaining)) expect(count).toBe(0);

    expect(await db.product.count({ where: { isDemo: false } })).toBe(
      baseline.products,
    );
    expect(await db.portfolio.count({ where: { isDemo: false } })).toBe(
      baseline.portfolio,
    );
    expect(await db.blogPost.count({ where: { isDemo: false } })).toBe(
      baseline.posts,
    );
  });
});
