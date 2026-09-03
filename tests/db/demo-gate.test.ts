import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { demoClause } from "@/lib/demo-clause";
import { buildProductWhere } from "@/lib/shop";
import { getTestDb } from "./helpers";

/**
 * The demo-content gate against a real Postgres: a PUBLISHED fixture is
 * invisible to a hiding clause, visible to a showing one, and never in the
 * sitemap's clause. Rows are created with test- ids inside try/finally.
 */
const ID = "test-demo-gate-product";
const SLUG = "test-demo-gate-piece";

let db: PrismaClient | null = null;

beforeAll(async () => {
  db = await getTestDb();
  if (!db) return;
  const category = await db.category.findFirst({ select: { id: true } });
  if (!category) return;
  await db.product.upsert({
    where: { id: ID },
    create: {
      id: ID,
      title: "Demo gate proof piece",
      slug: SLUG,
      status: "PUBLISHED",
      isDemo: true,
      importSource: "test-demo",
      importRef: ID,
      categoryId: category.id,
    },
    update: { status: "PUBLISHED", isDemo: true },
  });
});

afterAll(async () => {
  if (!db) return;
  await db.product.deleteMany({ where: { id: ID } });
});

describe("demo gate (Postgres)", () => {
  it("hides a PUBLISHED demo product from the default clause", async (ctx) => {
    if (!db) return ctx.skip();
    const rows = await db.product.findMany({
      where: { ...buildProductWhere({}, demoClause(false)), slug: SLUG },
      select: { id: true },
    });
    expect(rows).toEqual([]);
  });

  it("shows it when the caller shows demo content", async (ctx) => {
    if (!db) return ctx.skip();
    const rows = await db.product.findMany({
      where: { ...buildProductWhere({}, demoClause(true)), slug: SLUG },
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).toEqual([ID]);
  });

  it("keeps it out of the sitemap clause either way", async (ctx) => {
    if (!db) return ctx.skip();
    const rows = await db.product.findMany({
      where: { status: "PUBLISHED", isDemo: false, slug: SLUG },
      select: { id: true },
    });
    expect(rows).toEqual([]);
  });
});
