/**
 * Content Lab fixtures — typed, validated loaders over `prisma/fixtures/demo/*.json`.
 *
 * The JSON files are the source of truth for what Content Lab seeds; this
 * module is the only thing that reads them. Every array is parsed through a
 * Zod schema so a hand-edited fixture with a typo or a dropped field fails
 * loudly here, at import time, rather than as an opaque Prisma error deep
 * inside `apply.ts`. Imported (not `fs.readFileSync`) so the files travel
 * with any bundle this module ends up in — a serverless function included
 * from `src/actions/demo.ts` included with them.
 *
 * Plain module: no server-only imports, no database access. Safe to import
 * from `scripts/seed-demo.ts` (a bare Node process) and from the studio
 * action alike.
 */
import { z } from "zod";

import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";

import productsJson from "../../../prisma/fixtures/demo/products.json";
import productImagesJson from "../../../prisma/fixtures/demo/product-images.json";
import productFieldsJson from "../../../prisma/fixtures/demo/product-fields.json";
import madeWithJson from "../../../prisma/fixtures/demo/made-with.json";
import blogCategoriesJson from "../../../prisma/fixtures/demo/blog-categories.json";
import blogPostsJson from "../../../prisma/fixtures/demo/blog-posts.json";
import portfolioJson from "../../../prisma/fixtures/demo/portfolio.json";
import portfolioImagesJson from "../../../prisma/fixtures/demo/portfolio-images.json";
import testimonialsJson from "../../../prisma/fixtures/demo/testimonials.json";
import faqsJson from "../../../prisma/fixtures/demo/faqs.json";
import customPagesJson from "../../../prisma/fixtures/demo/custom-pages.json";
import customBlocksJson from "../../../prisma/fixtures/demo/custom-blocks.json";
import mediaJson from "../../../prisma/fixtures/demo/media.json";
import inquiriesJson from "../../../prisma/fixtures/demo/inquiries.json";
import researchRecordsJson from "../../../prisma/fixtures/demo/research-records.json";
import scrapeJobsJson from "../../../prisma/fixtures/demo/scrape-jobs.json";
import scrapedProductsJson from "../../../prisma/fixtures/demo/scraped-products.json";
import importRunsJson from "../../../prisma/fixtures/demo/import-runs.json";

/**
 * The 16 real categories, mirrored from `prisma/seed.ts`'s `CATEGORIES` (kept
 * by hand — `seed.ts` is a script with a top-level `main()` call and cannot
 * be imported without connecting to a database). Every fixture that names a
 * category must name one of these; `fixtures.test.ts` asserts it, so a typo
 * here or in a fixture file fails a fast unit test instead of a seed run.
 */
export const SEEDED_CATEGORY_SLUGS = [
  "resin-furniture-surfaces",
  "art-craft-pieces",
  "varmala-preservation",
  "wedding-photo-frames",
  "resin-trays-serving-platters",
  "candle-tea-light-holders",
  "resin-wall-clocks",
  "resin-jewelry-keychains",
  "resin-home-decor",
  "resin-vases",
  "drinkware-barware",
  "tablespace-sets",
  "sculptures-objets",
  "vanity-mirrors",
  "kids-room-decor",
  "workshops",
] as const;

const categorySlug = z.enum(SEEDED_CATEGORY_SLUGS);

/* ═══════════════════════ schemas ═══════════════════════ */

const contentStatus = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

export const productSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(300),
  displayName: z.string().nullable(),
  slug: z.string().min(1),
  shortTagline: z.string().nullable(),
  description: z.string(),
  priceMin: z.number().int().nullable(),
  priceMax: z.number().int().nullable(),
  showPrice: z.boolean(),
  timeline: z.string().nullable(),
  materials: z.string().nullable(),
  dimensions: z.string().nullable(),
  occasions: z.array(z.string()),
  lexical: z.array(z.object({ label: z.string(), value: z.string() })),
  careNotes: z.string().nullable(),
  status: contentStatus,
  featured: z.boolean(),
  videoUrl: z.string().nullable(),
  model3dUrl: z.string().nullable(),
  categorySlug,
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  ogImage: z.string().nullable(),
  translations: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .nullable(),
  needsRewrite: z.boolean(),
  importSource: z.literal("demo"),
  importRef: z.string(),
  tier: z.number().int().min(1).max(4).nullable(),
  /**
   * The owner's product tier. Nullable, and two of the hundred fixtures ARE
   * null on purpose: a workshop is a booking, not a piece, and the taxonomy
   * has no tier for it. Inventing one would be a fabrication, and the nulls
   * are also the only demo rows that exercise the "No tier yet" path.
   */
  sizeTier: z.enum(PRODUCT_SIZE_TIERS).nullable(),
  inStock: z.boolean(),
  sourceHash: z.string().nullable(),
  ownerTouched: z.boolean(),
  studioEditedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  confirmedById: z.string().nullable(),
  isDemo: z.literal(true),
});
export type DemoProduct = z.infer<typeof productSchema>;

const productImageRole = z
  .enum(["HERO", "DETAIL", "IN_ROOM", "PROCESS"])
  .nullable();

export const productImageSchema = z.object({
  id: z.string(),
  productId: z.string(),
  url: z.string().min(1),
  alt: z.string(),
  order: z.number().int(),
  role: productImageRole,
});
export type DemoProductImage = z.infer<typeof productImageSchema>;

const fieldType = z.enum([
  "SELECT",
  "TEXT",
  "SWATCH",
  "SIZE",
  "NUMBER",
  "FILE",
]);

export const productFieldSchema = z.object({
  id: z.string(),
  productId: z.string(),
  label: z.string().min(1),
  type: fieldType,
  options: z.array(z.string()),
  required: z.boolean(),
  helpText: z.string().nullable(),
  order: z.number().int(),
});
export type DemoProductField = z.infer<typeof productFieldSchema>;

export const madeWithLinkSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
});
export type DemoMadeWithLink = z.infer<typeof madeWithLinkSchema>;

export const blogCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  translations: z.unknown().nullable(),
  isDemo: z.literal(true),
});
export type DemoBlogCategory = z.infer<typeof blogCategorySchema>;

export const blogPostSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string(),
  content: z.record(z.string(), z.unknown()),
  coverImage: z.string().nullable(),
  authorName: z.string(),
  blogCategoryId: z.string().nullable(),
  status: contentStatus,
  publishedAt: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  translations: z.unknown().nullable(),
  isDemo: z.literal(true),
  categorySlug: categorySlug.nullable(),
});
export type DemoBlogPost = z.infer<typeof blogPostSchema>;

export const portfolioSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  slug: z.string().min(1),
  story: z.string(),
  brief: z.string().nullable(),
  process: z.string().nullable(),
  clientNote: z.string().nullable(),
  location: z.string().nullable(),
  year: z.number().int().nullable(),
  beforeImageUrl: z.string().nullable(),
  afterImageUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  resultsMeta: z.record(z.string(), z.unknown()),
  translations: z.unknown().nullable(),
  categorySlug: categorySlug.nullable(),
  status: contentStatus,
  isDemo: z.literal(true),
});
export type DemoPortfolio = z.infer<typeof portfolioSchema>;

export const portfolioImageSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  url: z.string().min(1),
  alt: z.string(),
  caption: z.string().nullable(),
  translations: z.unknown().nullable(),
  order: z.number().int(),
});
export type DemoPortfolioImage = z.infer<typeof portfolioImageSchema>;

const testimonialStatus = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "VERIFIED",
  "PUBLISHED",
  "ARCHIVED",
]);
const permissionStatus = z.enum([
  "UNKNOWN",
  "REQUESTED",
  "GRANTED",
  "DECLINED",
]);

export const testimonialSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  location: z.string().nullable(),
  quote: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  avatarUrl: z.string().nullable(),
  order: z.number().int(),
  translations: z.unknown().nullable(),
  status: testimonialStatus,
  featured: z.boolean(),
  isDemo: z.literal(true),
  designation: z.string().nullable(),
  category: z.string().nullable(),
  givenAt: z.string().nullable(),
  language: z.string().nullable(),
  productId: z.string().nullable(),
  portfolioId: z.string().nullable(),
  productTitle: z.string().nullable(),
  mediaId: z.string().nullable(),
  installationImageUrl: z.string().nullable(),
  installationMediaId: z.string().nullable(),
  videoUrl: z.string().nullable(),
  videoPosterUrl: z.string().nullable(),
  internalNotes: z.string().nullable(),
  permissionStatus,
  verifiedAt: z.string().nullable(),
  verifiedById: z.string().nullable(),
});
export type DemoTestimonial = z.infer<typeof testimonialSchema>;

export const faqSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  order: z.number().int(),
  status: contentStatus,
  translations: z.unknown().nullable(),
  isDemo: z.literal(true),
});
export type DemoFaq = z.infer<typeof faqSchema>;

export const customPageSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  status: contentStatus,
  publishAt: z.string().nullable(),
  noindex: z.boolean(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  ogImage: z.string().nullable(),
  translations: z.unknown().nullable(),
  isDemo: z.literal(true),
});
export type DemoCustomPage = z.infer<typeof customPageSchema>;

const customBlockType = z.enum([
  "hero",
  "richText",
  "productGrid",
  "imageCta",
  "faqPicker",
  "finalCta",
  "collectionGrid",
  "portfolioGrid",
  "journalGrid",
  "testimonial",
  "testimonialGrid",
  "videoHero",
  "videoStory",
  "masonryGallery",
  "bentoGallery",
  "fullscreenGallery",
]);

export const customBlockSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  type: customBlockType,
  order: z.number().int(),
  data: z.record(z.string(), z.unknown()),
  translations: z.unknown().nullable(),
});
export type DemoCustomBlock = z.infer<typeof customBlockSchema>;

const mediaType = z.enum(["IMAGE", "VIDEO", "DOCUMENT", "MODEL3D"]);
const provenance = z.enum(["UPLOAD", "BUNDLED", "AI"]);

export const mediaSchema = z.object({
  id: z.string(),
  url: z.string().min(1),
  pathname: z.string().min(1),
  type: mediaType,
  folder: z.string(),
  bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  originalName: z.string().nullable(),
  alt: z.string().nullable(),
  checksum: z.string().nullable(),
  blurDataUrl: z.string().nullable(),
  dominantHex: z.string().nullable(),
  provenance,
  isDemo: z.literal(true),
  tags: z.array(z.string()),
  caption: z.string().nullable(),
  favourite: z.boolean(),
  duration: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
});
export type DemoMedia = z.infer<typeof mediaSchema>;

const inquirySource = z.enum(["PRODUCT", "CUSTOM_ORDER", "CONTACT"]);
const inquiryStatus = z.enum([
  "NEW",
  "CONTACTED",
  "DISCUSSION",
  "QUOTED",
  "CONFIRMED",
  "IN_PRODUCTION",
  "DELIVERED",
  "CLOSED",
  "LOST",
]);

export const inquirySchema = z.object({
  id: z.string(),
  source: inquirySource,
  productId: z.string().nullable(),
  customerName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().nullable(),
  selections: z.array(z.object({ label: z.string(), value: z.string() })),
  referenceImageUrls: z.array(z.string()),
  budgetRange: z.string().nullable(),
  timeline: z.string().nullable(),
  notes: z.string(),
  whatsappMessage: z.string().min(1),
  claimTokenHash: z.string().nullable(),
  attribution: z.unknown().nullable(),
  quotedPrice: z.number().int().nullable(),
  finalPrice: z.number().int().nullable(),
  staffNotes: z.string().nullable(),
  status: inquiryStatus,
  isDemo: z.literal(true),
});
export type DemoInquiry = z.infer<typeof inquirySchema>;

export const researchRecordSchema = z.object({
  id: z.string(),
  source: z.string().min(1),
  url: z.string().nullable(),
  title: z.string().min(1),
  category: z.string().nullable(),
  materials: z.string().nullable(),
  dimensions: z.string().nullable(),
  price: z.string().nullable(),
  images: z.array(z.string()),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  extractedAt: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  isDemo: z.literal(true),
  createdById: z.string().nullable(),
});
export type DemoResearchRecord = z.infer<typeof researchRecordSchema>;

const scrapePlatform = z.enum(["SHOPIFY", "WOOCOMMERCE", "JSONLD", "UNKNOWN"]);
const scrapeJobStatus = z.enum(["QUEUED", "RUNNING", "DONE", "FAILED"]);
const scrapeScope = z.enum(["SOURCE", "CATEGORY", "URL"]);

export const scrapeJobSchema = z.object({
  id: z.string(),
  sourceId: z.null(),
  inputUrl: z.string().min(1),
  sourceKey: z.literal("demo"),
  sourceName: z.string(),
  platform: scrapePlatform,
  vertical: z.string(),
  status: scrapeJobStatus,
  cursorPage: z.number().int(),
  totalScraped: z.number().int(),
  newCount: z.number().int(),
  updatedCount: z.number().int(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  isDemo: z.literal(true),
  scope: scrapeScope,
  updatedAt: z.string(),
});
export type DemoScrapeJob = z.infer<typeof scrapeJobSchema>;

const reviewStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "IMPORTED"]);
export const scrapedProductSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  sourceKey: z.literal("demo"),
  externalId: z.string(),
  url: z.string().min(1),
  vertical: z.string(),
  currency: z.string(),
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().nullable(),
  shortTagline: z.string().nullable(),
  description: z.string().nullable(),
  priceMin: z.number().int().nullable(),
  priceMax: z.number().int().nullable(),
  showPrice: z.boolean().nullable(),
  timeline: z.string().nullable(),
  materials: z.string().nullable(),
  dimensions: z.string().nullable(),
  status: z.string().nullable(),
  featured: z.boolean().nullable(),
  images: z.array(z.string()),
  imageAlts: z.array(z.string()),
  fields: z.record(z.string(), z.unknown()),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  contentHash: z.string(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  reviewStatus,
  importedProductId: z.string().nullable(),
  notes: z.string().nullable(),
});
export type DemoScrapedProduct = z.infer<typeof scrapedProductSchema>;

export const importRunSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  dryRun: z.boolean(),
  rowsRead: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
  failed: z.number().int(),
  abortedReason: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  isDemo: z.literal(true),
});
export type DemoImportRun = z.infer<typeof importRunSchema>;

/* ═══════════════════════ loaders ═══════════════════════ */

function load<T>(schema: z.ZodType<T>, raw: unknown, file: string): T[] {
  const array = z.array(schema).safeParse(raw);
  if (!array.success) {
    throw new Error(
      `Content Lab fixture ${file} failed validation: ${array.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return array.data;
}

/** Every demo fixture, parsed and typed. Throws if any file is malformed. */
export function loadDemoFixtures() {
  return {
    products: load(productSchema, productsJson, "products.json"),
    productImages: load(
      productImageSchema,
      productImagesJson,
      "product-images.json",
    ),
    productFields: load(
      productFieldSchema,
      productFieldsJson,
      "product-fields.json",
    ),
    madeWithLinks: load(madeWithLinkSchema, madeWithJson, "made-with.json"),
    blogCategories: load(
      blogCategorySchema,
      blogCategoriesJson,
      "blog-categories.json",
    ),
    blogPosts: load(blogPostSchema, blogPostsJson, "blog-posts.json"),
    portfolio: load(portfolioSchema, portfolioJson, "portfolio.json"),
    portfolioImages: load(
      portfolioImageSchema,
      portfolioImagesJson,
      "portfolio-images.json",
    ),
    testimonials: load(
      testimonialSchema,
      testimonialsJson,
      "testimonials.json",
    ),
    faqs: load(faqSchema, faqsJson, "faqs.json"),
    customPages: load(customPageSchema, customPagesJson, "custom-pages.json"),
    customBlocks: load(
      customBlockSchema,
      customBlocksJson,
      "custom-blocks.json",
    ),
    media: load(mediaSchema, mediaJson, "media.json"),
    inquiries: load(inquirySchema, inquiriesJson, "inquiries.json"),
    researchRecords: load(
      researchRecordSchema,
      researchRecordsJson,
      "research-records.json",
    ),
    scrapeJobs: load(scrapeJobSchema, scrapeJobsJson, "scrape-jobs.json"),
    scrapedProducts: load(
      scrapedProductSchema,
      scrapedProductsJson,
      "scraped-products.json",
    ),
    importRuns: load(importRunSchema, importRunsJson, "import-runs.json"),
  };
}

export type DemoFixtures = ReturnType<typeof loadDemoFixtures>;

/** Every site-root image/video path referenced anywhere in the fixtures — used by
 *  fixtures.test.ts to assert each one exists on disk under `public/`. */
export function referencedImagePaths(fixtures: DemoFixtures): string[] {
  const paths: string[] = [];
  for (const p of fixtures.products) {
    if (p.videoUrl) paths.push(p.videoUrl);
  }
  for (const img of fixtures.productImages) paths.push(img.url);
  for (const p of fixtures.portfolio) {
    if (p.beforeImageUrl) paths.push(p.beforeImageUrl);
    if (p.afterImageUrl) paths.push(p.afterImageUrl);
    if (p.videoUrl) paths.push(p.videoUrl);
  }
  for (const img of fixtures.portfolioImages) paths.push(img.url);
  for (const t of fixtures.testimonials) {
    if (t.avatarUrl) paths.push(t.avatarUrl);
    if (t.installationImageUrl) paths.push(t.installationImageUrl);
    if (t.videoUrl) paths.push(t.videoUrl);
    if (t.videoPosterUrl) paths.push(t.videoPosterUrl);
  }
  for (const m of fixtures.media) {
    paths.push(m.url);
    if (m.posterUrl) paths.push(m.posterUrl);
  }
  for (const r of fixtures.researchRecords) paths.push(...r.images);
  for (const s of fixtures.scrapedProducts) paths.push(...s.images);
  for (const block of fixtures.customBlocks) {
    const data = block.data as Record<string, unknown>;
    if (typeof data.image === "string" && data.image) paths.push(data.image);
  }
  return paths;
}
