import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";

import {
  loadDemoFixtures,
  referencedImagePaths,
  SEEDED_CATEGORY_SLUGS,
} from "@/lib/demo/fixtures";

/**
 * Decision 7 (Content Lab plan): demo fixture images reference only
 * `public/media/v3/*`, the process-pour video, and `public/images/blog/*` —
 * files this repo already ships. This proves it directly against the
 * filesystem rather than trusting the generator that wrote the JSON, so a
 * hand-edit that points at a file nobody committed fails here instead of
 * 400ing `/_next/image` on a live (or demo-visible) page.
 */
describe("Content Lab fixtures", () => {
  const fixtures = loadDemoFixtures();

  it("loads every fixture file without a validation error", () => {
    expect(fixtures.products.length).toBe(100);
    expect(fixtures.productImages.length).toBeGreaterThan(0);
    expect(fixtures.blogCategories.length).toBe(10);
    expect(fixtures.blogPosts.length).toBe(30);
    expect(fixtures.portfolio.length).toBe(12);
    expect(fixtures.testimonials.length).toBe(40);
    expect(fixtures.faqs.length).toBe(30);
    expect(fixtures.customPages.length).toBe(5);
    expect(fixtures.media.length).toBe(40);
    expect(fixtures.inquiries.length).toBe(30);
    expect(fixtures.researchRecords.length).toBe(30);
    expect(fixtures.scrapeJobs.length).toBe(3);
    expect(fixtures.scrapedProducts.length).toBe(40);
    expect(fixtures.importRuns.length).toBe(5);
  });

  it("every referenced image or video path exists on disk under public/", () => {
    const paths = referencedImagePaths(fixtures);
    expect(paths.length).toBeGreaterThan(0);
    const missing = paths.filter(
      (path) =>
        !existsSync(join(process.cwd(), "public", path.replace(/^\//, ""))),
    );
    expect(missing).toEqual([]);
  });

  it("every referenced path stays inside the two allowed pools (decision 7)", () => {
    const paths = referencedImagePaths(fixtures);
    const outside = paths.filter(
      (path) =>
        !path.startsWith("/media/v3/") && !path.startsWith("/images/blog/"),
    );
    expect(outside).toEqual([]);
  });

  it("every product/portfolio/blog-post categorySlug is one of the 16 seeded categories", () => {
    for (const p of fixtures.products) {
      expect(SEEDED_CATEGORY_SLUGS).toContain(p.categorySlug);
    }
    for (const p of fixtures.portfolio) {
      if (p.categorySlug)
        expect(SEEDED_CATEGORY_SLUGS).toContain(p.categorySlug);
    }
    for (const post of fixtures.blogPosts) {
      if (post.categorySlug)
        expect(SEEDED_CATEGORY_SLUGS).toContain(post.categorySlug);
    }
  });

  it("every id is deterministic and unique within its own fixture file", () => {
    const idsOf = (rows: { id: string }[]) => rows.map((r) => r.id);
    for (const rows of [
      fixtures.products,
      fixtures.productImages,
      fixtures.productFields,
      fixtures.blogCategories,
      fixtures.blogPosts,
      fixtures.portfolio,
      fixtures.portfolioImages,
      fixtures.testimonials,
      fixtures.faqs,
      fixtures.customPages,
      fixtures.customBlocks,
      fixtures.media,
      fixtures.inquiries,
      fixtures.researchRecords,
      fixtures.scrapeJobs,
      fixtures.scrapedProducts,
      fixtures.importRuns,
    ]) {
      const ids = idsOf(rows);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every row is marked isDemo (or isDemo does not apply to that table)", () => {
    for (const p of fixtures.products) expect(p.isDemo).toBe(true);
    for (const p of fixtures.blogPosts) expect(p.isDemo).toBe(true);
    for (const p of fixtures.blogCategories) expect(p.isDemo).toBe(true);
    for (const p of fixtures.portfolio) expect(p.isDemo).toBe(true);
    for (const p of fixtures.testimonials) expect(p.isDemo).toBe(true);
    for (const p of fixtures.faqs) expect(p.isDemo).toBe(true);
    for (const p of fixtures.customPages) expect(p.isDemo).toBe(true);
    for (const p of fixtures.media) expect(p.isDemo).toBe(true);
    for (const p of fixtures.inquiries) expect(p.isDemo).toBe(true);
    for (const p of fixtures.researchRecords) expect(p.isDemo).toBe(true);
    for (const p of fixtures.scrapeJobs) expect(p.isDemo).toBe(true);
    for (const p of fixtures.importRuns) expect(p.isDemo).toBe(true);
  });

  it("every product with importSource demo carries a matching importRef", () => {
    for (const p of fixtures.products) {
      expect(p.importSource).toBe("demo");
      expect(p.importRef).toBe(p.id);
    }
  });

  it("demo-product-001 carries one field of every FieldType (the E2E order path)", () => {
    const fields = fixtures.productFields.filter(
      (f) => f.productId === "demo-product-001",
    );
    const types = new Set(fields.map((f) => f.type));
    expect(types).toEqual(
      new Set(["SIZE", "SWATCH", "TEXT", "SELECT", "NUMBER", "FILE"]),
    );
    const size = fields.find((f) => f.type === "SIZE");
    expect(size?.options).toContain("16 inch");
    const swatch = fields.find((f) => f.type === "SWATCH");
    expect(swatch?.options).toContain("Ivory");
  });

  it("at least one portfolio case carries beforeImageUrl and afterImageUrl", () => {
    const withBoth = fixtures.portfolio.filter(
      (p) => p.beforeImageUrl && p.afterImageUrl,
    );
    expect(withBoth.length).toBeGreaterThanOrEqual(1);
  });

  it("title lengths span from 8 to 220 characters", () => {
    const lengths = fixtures.products.map((p) => p.title.length);
    expect(Math.min(...lengths)).toBeLessThanOrEqual(10);
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(200);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(220);
  });

  it("featured products stay at or under the 12-tile budget", () => {
    expect(
      fixtures.products.filter((p) => p.featured).length,
    ).toBeLessThanOrEqual(12);
  });

  it("every ContentStatus appears among the demo products", () => {
    const statuses = new Set(fixtures.products.map((p) => p.status));
    expect(statuses).toEqual(
      new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
    );
  });

  it("every product tier appears, on a PUBLISHED row CI can actually see", () => {
    // The gate for the tier variants that steps 6-8 will build. A card or PDP
    // that branches on sizeTier is only ever exercised if a PUBLISHED demo
    // product carries that tier — CI sweeps the demo routes, and an unseen
    // branch is an untested one.
    const published = fixtures.products.filter(
      (p) => p.status === "PUBLISHED" && p.sizeTier !== null,
    );
    expect(new Set(published.map((p) => p.sizeTier))).toEqual(
      new Set(PRODUCT_SIZE_TIERS),
    );
  });

  it("the three audited demo PDPs are one of each tier, and all three render", () => {
    // ci.yml sweeps these three slugs. They are the only product detail pages
    // any audit ever loads, so between them they must cover all three tiers
    // or two thirds of the PDP variants ship unaudited.
    //
    // STATUS AND IMAGES ARE ASSERTED TOO, and that is not belt and braces:
    // the first pair picked for this list were demo-product-085 (status
    // REVIEW, so its PDP 404s for a visitor) and demo-product-078 (zero
    // images). Adding either to AUDIT_ROUTES would have turned CI red — or
    // worse, audited the monogram fallback and called it a tier variant.
    const AUDITED = {
      "demo-product-001": "LARGE_FORMAT",
      "demo-product-086": "MEDIUM_FORMAT",
      "demo-product-062": "SMALL_FORMAT",
    } as const;
    const imageCount = new Map<string, number>();
    for (const img of fixtures.productImages) {
      imageCount.set(img.productId, (imageCount.get(img.productId) ?? 0) + 1);
    }
    for (const [slug, tier] of Object.entries(AUDITED)) {
      const product = fixtures.products.find((p) => p.slug === slug);
      expect(product, `${slug} must exist`).toBeDefined();
      expect(product?.sizeTier, `${slug} tier`).toBe(tier);
      expect(product?.status, `${slug} must render publicly`).toBe("PUBLISHED");
      expect(imageCount.get(product!.id) ?? 0, `${slug} images`).toBeGreaterThan(
        0,
      );
    }
  });

  it("the two workshops carry NO tier, and they are the only ones that do not", () => {
    // A workshop is a booking, not a piece; the owner's taxonomy has no tier
    // for it and inventing one would be a fabrication. They are also the only
    // demo rows that exercise the "No tier yet" path in the studio.
    const untiered = fixtures.products.filter((p) => p.sizeTier === null);
    expect(untiered.map((p) => p.categorySlug)).toEqual([
      "workshops",
      "workshops",
    ]);
  });

  it("every TestimonialStatus and a PUBLISHED+GRANTED row both appear", () => {
    const statuses = new Set(fixtures.testimonials.map((t) => t.status));
    expect(statuses).toEqual(
      new Set(["DRAFT", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "ARCHIVED"]),
    );
    const publishedGranted = fixtures.testimonials.some(
      (t) => t.status === "PUBLISHED" && t.permissionStatus === "GRANTED",
    );
    expect(publishedGranted).toBe(true);
  });

  it("madeWith links only point at demo products", () => {
    const ids = new Set(fixtures.products.map((p) => p.id));
    for (const link of fixtures.madeWithLinks) {
      expect(ids.has(link.fromId)).toBe(true);
      expect(ids.has(link.toId)).toBe(true);
    }
  });

  it("every InquiryStatus and InquirySource appears among the demo inquiries", () => {
    const statuses = new Set(fixtures.inquiries.map((i) => i.status));
    expect(statuses.size).toBeGreaterThanOrEqual(8);
    const sources = new Set(fixtures.inquiries.map((i) => i.source));
    expect(sources).toEqual(new Set(["PRODUCT", "CUSTOM_ORDER", "CONTACT"]));
  });

  it("one scrape job is DONE, one FAILED, one a stale RUNNING row", () => {
    const statuses = fixtures.scrapeJobs.map((j) => j.status).sort();
    expect(statuses).toEqual(["DONE", "FAILED", "RUNNING"]);
    const running = fixtures.scrapeJobs.find((j) => j.status === "RUNNING")!;
    const ageMs = Date.now() - new Date(running.updatedAt).getTime();
    expect(ageMs).toBeGreaterThan(10 * 60 * 1000); // past any reclaim window
  });
});
