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

    const testUrls = [
      "https://res.cloudinary.com/dhaqpl1kz/image/upload/sample.jpg",
    ];
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

  // B0 · media metadata: a film's poster frame is a URL on the Media row
  // itself, so the guard walks it under its own label.
  it("guards a video's poster frame", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-poster-${Date.now()}`;
    const posterUrl = `/uploads/test/${id}-poster.jpg`;
    await db.media.create({
      data: {
        id,
        url: `/uploads/test/${id}.mp4`,
        pathname: `test/${id}.mp4`,
        type: "VIDEO",
        folder: "site",
        bytes: 1,
        originalName: `${id}.mp4`,
        posterUrl,
      },
    });
    try {
      const details = await findMediaUsageDetails([posterUrl]);
      expect(details.get(posterUrl)?.[0]).toMatch(/^Video poster · /);
    } finally {
      await db.media.delete({ where: { id } });
    }
  });

  // B0 · research library: pictures live in a Json array on the record.
  it("guards research record pictures", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-research-${Date.now()}`;
    const url = `/uploads/test/${id}-1.jpg`;
    await db.researchRecord.create({
      data: { id, source: "test", title: "Research row", images: [url] },
    });
    try {
      const details = await findMediaUsageDetails([url]);
      expect(details.get(url)).toContain("Research · Research row");
    } finally {
      await db.researchRecord.delete({ where: { id } });
    }
  });

  // C2 · block catalogue growth: `videoHero` carries two URLs (the film and
  // its poster) on one block row, each guarded under its own label — a
  // delete guard that only saw one of the two would let the other 404 the
  // page's opening band with no warning.
  it("guards a videoHero block's video and poster", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-videohero-${Date.now()}`;
    const videoUrl = `/uploads/test/${id}-film.mp4`;
    const posterUrl = `/uploads/test/${id}-poster.jpg`;
    const page = await db.customPage.create({
      data: {
        id,
        slug: id,
        title: "Media usages test lander",
      },
    });
    await db.customBlock.create({
      data: {
        pageId: page.id,
        type: "videoHero",
        order: 0,
        data: { videoUrl, posterUrl },
      },
    });
    try {
      const details = await findMediaUsageDetails([videoUrl, posterUrl]);
      expect(details.get(videoUrl)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(video\)$/,
      );
      expect(details.get(posterUrl)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(poster\)$/,
      );
    } finally {
      // Deletes the block via the page's cascade.
      await db.customPage.delete({ where: { id } });
    }
  });

  // C2 · block catalogue growth: `videoStory` carries the same two URLs as
  // videoHero (film + poster) on a light band; the walker treats both types
  // alike, and this case keeps that true if either branch is ever split.
  it("guards a videoStory block's video and poster", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-videostory-${Date.now()}`;
    const videoUrl = `/uploads/test/${id}-film.mp4`;
    const posterUrl = `/uploads/test/${id}-poster.jpg`;
    const page = await db.customPage.create({
      data: {
        id,
        slug: id,
        title: "Media usages test lander",
      },
    });
    await db.customBlock.create({
      data: {
        pageId: page.id,
        type: "videoStory",
        order: 0,
        data: { videoUrl, posterUrl },
      },
    });
    try {
      const details = await findMediaUsageDetails([videoUrl, posterUrl]);
      expect(details.get(videoUrl)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(video\)$/,
      );
      expect(details.get(posterUrl)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(poster\)$/,
      );
    } finally {
      // Deletes the block via the page's cascade.
      await db.customPage.delete({ where: { id } });
    }
  });

  // C2 · block catalogue growth: the gallery blocks carry an ARRAY of
  // pictures on one row; every entry is guarded under the page label with
  // its position, so a delete guard can say which tile would go dark.
  it("guards every picture of a masonryGallery block", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-masonry-${Date.now()}`;
    const first = `/uploads/test/${id}-1.jpg`;
    const second = `/uploads/test/${id}-2.jpg`;
    const page = await db.customPage.create({
      data: { id, slug: id, title: "Media usages test lander" },
    });
    await db.customBlock.create({
      data: {
        pageId: page.id,
        type: "masonryGallery",
        order: 0,
        data: {
          heading: "",
          images: [
            { url: first, alt: "one", caption: "" },
            { url: second, alt: "two", caption: "" },
          ],
          spacing: "standard",
        },
      },
    });
    try {
      const details = await findMediaUsageDetails([first, second]);
      expect(details.get(first)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(picture 1\)$/,
      );
      expect(details.get(second)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(picture 2\)$/,
      );
    } finally {
      await db.customPage.delete({ where: { id } });
    }
  });

  // bentoGallery shares the masonry walker branch; this case keeps that true
  // if the branches are ever split.
  it("guards every picture of a bentoGallery block", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-bento-${Date.now()}`;
    const first = `/uploads/test/${id}-1.jpg`;
    const second = `/uploads/test/${id}-2.jpg`;
    const page = await db.customPage.create({
      data: { id, slug: id, title: "Media usages test lander" },
    });
    await db.customBlock.create({
      data: {
        pageId: page.id,
        type: "bentoGallery",
        order: 0,
        data: {
          heading: "",
          images: [
            { url: first, alt: "one", caption: "" },
            { url: second, alt: "two", caption: "" },
          ],
          spacing: "standard",
        },
      },
    });
    try {
      const details = await findMediaUsageDetails([first, second]);
      expect(details.get(first)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(picture 1\)$/,
      );
      expect(details.get(second)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(picture 2\)$/,
      );
    } finally {
      await db.customPage.delete({ where: { id } });
    }
  });

  // fullscreenGallery is the third block on the gallery walker branch.
  it("guards every picture of a fullscreenGallery block", async (ctx) => {
    if (!db) {
      ctx.skip();
      return;
    }
    const id = `test-media-usages-fullscreen-${Date.now()}`;
    const first = `/uploads/test/${id}-1.jpg`;
    const second = `/uploads/test/${id}-2.jpg`;
    const page = await db.customPage.create({
      data: { id, slug: id, title: "Media usages test lander" },
    });
    await db.customBlock.create({
      data: {
        pageId: page.id,
        type: "fullscreenGallery",
        order: 0,
        data: {
          heading: "",
          images: [
            { url: first, alt: "one", caption: "" },
            { url: second, alt: "two", caption: "" },
          ],
        },
      },
    });
    try {
      const details = await findMediaUsageDetails([first, second]);
      expect(details.get(first)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(picture 1\)$/,
      );
      expect(details.get(second)?.[0]).toMatch(
        /^Landing page · Media usages test lander \(picture 2\)$/,
      );
    } finally {
      await db.customPage.delete({ where: { id } });
    }
  });
});
