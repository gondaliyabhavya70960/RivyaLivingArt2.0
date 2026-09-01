import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { findMediaUsages, findMediaUsageDetails } from "@/lib/media-usages";
import { getTestDb } from "./helpers";

describe("Database-backed: findMediaUsages / findMediaUsageDetails (Prompt 07)", () => {
  let db: PrismaClient | null = null;

  beforeAll(async () => {
    db = await getTestDb();
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
    }
  });

  it("executes findMediaUsages query against Postgres without errors", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const testUrls = [
      "https://res.cloudinary.com/dhaqpl1kz/image/upload/sample.jpg",
      "/images/covers/ocean-tray.jpg",
    ];

    const usages = await findMediaUsages(testUrls);
    expect(usages).toBeInstanceOf(Set);
  });

  it("executes findMediaUsageDetails query against Postgres without errors", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const testUrls = ["https://res.cloudinary.com/dhaqpl1kz/image/upload/sample.jpg"];
    const details = await findMediaUsageDetails(testUrls);
    expect(details).toBeInstanceOf(Map);
  });
});
