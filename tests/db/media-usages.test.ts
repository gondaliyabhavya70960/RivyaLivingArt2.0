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

  // B0 · testimonial system: a testimonial carries four media URLs, and the
  // header rule says every one of them joins the guard in the same commit as
  // the column. Each label is asserted by name so a column silently dropped
  // from the OR clause fails here rather than 404ing the live site.
  it("guards all four testimonial media columns with their own labels", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const id = `test-media-usages-testimonial-${Date.now()}`;
    const urls = {
      avatarUrl: `/uploads/test/${id}-avatar.jpg`,
      installationImageUrl: `/uploads/test/${id}-installation.jpg`,
      videoUrl: `/uploads/test/${id}-film.mp4`,
      videoPosterUrl: `/uploads/test/${id}-poster.jpg`,
    };
    const expectedLabels: Record<keyof typeof urls, string> = {
      avatarUrl: "Testimonial avatar",
      installationImageUrl: "Testimonial installation photo",
      videoUrl: "Testimonial film",
      videoPosterUrl: "Testimonial film poster",
    };

    await db.testimonial.create({
      data: {
        id,
        name: "Media usages test",
        quote: "A row that exists only to be found by the delete guard.",
        ...urls,
      },
    });
    try {
      const all = Object.values(urls);
      const used = await findMediaUsages(all);
      for (const url of all) expect(used.has(url)).toBe(true);

      const details = await findMediaUsageDetails(all);
      for (const [column, url] of Object.entries(urls) as [
        keyof typeof urls,
        string,
      ][]) {
        expect(details.get(url)).toContain(expectedLabels[column]);
      }
    } finally {
      await db.testimonial.delete({ where: { id } });
    }
  });
});
