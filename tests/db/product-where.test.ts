import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { buildProductWhere } from "@/lib/shop";
import { getTestDb } from "./helpers";

describe("Database-backed: buildProductWhere Prisma execution (Prompt 07)", () => {
  let db: PrismaClient | null = null;

  beforeAll(async () => {
    db = await getTestDb();
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
    }
  });

  it("executes default buildProductWhere against Postgres without SQL syntax errors", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const where = buildProductWhere({});
    const products = await db.product.findMany({
      where,
      take: 10,
      select: { id: true, title: true, status: true },
    });

    expect(Array.isArray(products)).toBe(true);
    for (const p of products) {
      expect(p.status).toBe("PUBLISHED");
      expect(p.title.startsWith("DEMO")).toBe(false);
    }
  });

  it("executes search query against Postgres without syntax errors", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const where = buildProductWhere({ q: "resin" });
    const products = await db.product.findMany({
      where,
      take: 5,
      select: { id: true, title: true, shortTagline: true, description: true },
    });

    expect(Array.isArray(products)).toBe(true);
  });

  it("executes ecosystem type constraint against Postgres", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const where = buildProductWhere({ type: "art" });
    const products = await db.product.findMany({
      where,
      take: 5,
      select: { id: true, category: { select: { slug: true } } },
    });

    expect(Array.isArray(products)).toBe(true);
  });

  it("executes price band filters against Postgres", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const where = buildProductWhere({ band: "1k-5k" });
    const products = await db.product.findMany({
      where,
      take: 5,
      select: { id: true, priceMin: true, priceMax: true },
    });

    expect(Array.isArray(products)).toBe(true);
    for (const p of products) {
      if (p.priceMin !== null) {
        expect(p.priceMin).toBeLessThanOrEqual(5000);
      }
    }
  });
});
