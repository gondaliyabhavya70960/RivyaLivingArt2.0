import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getTestimonials } from "@/lib/testimonials";
import { getTestDb } from "./helpers";

/**
 * B0 · testimonial system: the public resolver returns PUBLISHED rows only,
 * and demo fixtures only when asked (or when the environment allows them).
 * Runs against the real database so the `where` clause is exercised as SQL
 * rather than trusted as a literal.
 */
describe("Database-backed: getTestimonials status + demo gate (B0)", () => {
  let db: PrismaClient | null = null;

  beforeAll(async () => {
    db = await getTestDb();
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
    }
  });

  it("returns PUBLISHED rows only and gates demo fixtures on includeDemo", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }

    const stamp = Date.now();
    const draftId = `test-testimonial-draft-${stamp}`;
    const liveId = `test-testimonial-live-${stamp}`;
    const demoId = `test-testimonial-demo-${stamp}`;
    const ids = [draftId, liveId, demoId];

    await db.testimonial.createMany({
      data: [
        {
          id: draftId,
          name: "Draft row",
          quote: "Not yet reviewed — must never reach a visitor.",
          status: "DRAFT",
          order: 900_000,
        },
        {
          id: liveId,
          name: "Live row",
          quote: "Published and real.",
          status: "PUBLISHED",
          order: 900_001,
        },
        {
          id: demoId,
          name: "Demo row",
          quote: "Published, but a seeded fixture.",
          status: "PUBLISHED",
          isDemo: true,
          order: 900_002,
        },
      ],
    });

    try {
      const idsOf = (rows: { id: string }[]) =>
        new Set(rows.map((r) => r.id).filter((id) => ids.includes(id)));

      const hidden = idsOf(
        await getTestimonials({ includeDemo: false, take: 50 }),
      );
      expect(hidden.has(liveId)).toBe(true);
      expect(hidden.has(demoId)).toBe(false);
      expect(hidden.has(draftId)).toBe(false);

      const shown = idsOf(
        await getTestimonials({ includeDemo: true, take: 50 }),
      );
      expect(shown.has(liveId)).toBe(true);
      expect(shown.has(demoId)).toBe(true);
      expect(shown.has(draftId)).toBe(false);

      // The legacy positional form the homepage, PDP and custom-order page
      // still use: same status gate, demo decided by the environment.
      const positional = idsOf(await getTestimonials(50));
      expect(positional.has(liveId)).toBe(true);
      expect(positional.has(draftId)).toBe(false);

      // internalNotes is staff-only and must never be in the public shape.
      const live = (await getTestimonials({ includeDemo: false, take: 50 })).find(
        (r) => r.id === liveId,
      );
      expect(live).toBeDefined();
      expect(live && "internalNotes" in live).toBe(false);
    } finally {
      await db.testimonial.deleteMany({ where: { id: { in: ids } } });
    }
  });
});
