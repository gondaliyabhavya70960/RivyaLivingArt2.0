/**
 * Content Lab — write the fixtures into (or out of) a database.
 *
 * `seedDemo` and `removeDemo` both take a `PrismaClient` as their first
 * argument rather than importing `@/lib/db` directly, so the same functions
 * run from a bare Node script (`scripts/seed-demo.ts`, its own client) and
 * from a studio Server Action (`src/actions/demo.ts`, the shared `db`)
 * without either one importing the other's setup.
 *
 * Dependency order matters because later tables carry foreign keys into
 * earlier ones: blog categories → media → products → product images/fields →
 * portfolio → testimonials → faqs → custom pages (+blocks) → inquiries →
 * research → scrape jobs → staged products → import runs. `removeDemo` runs
 * the reverse, so a parent is never deleted while a child fixture still
 * points at it (most FKs already cascade or set-null, but the order is kept
 * strict rather than leaning on that).
 *
 * Every row is upserted by its fixture id; every child table (images,
 * customization fields, portfolio images, custom blocks) is replaced
 * wholesale per parent — the same delete-then-createMany shape
 * `importProductRow` uses — so running this twice in a row leaves the same
 * rows rather than duplicating anything.
 *
 * Deliberately NOT `import "server-only"` — that guard resolves only inside
 * Next's own bundler alias (it is not an installed package this repo's
 * plain-Node resolution can find), and `scripts/seed-demo.ts` runs this
 * module directly under `tsx`, outside Next entirely. `src/actions/demo.ts`
 * is itself `"use server"`, which is the real client/server boundary here.
 */

import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { loadDemoFixtures, SEEDED_CATEGORY_SLUGS } from "@/lib/demo/fixtures";

export type SeedLog = (message: string) => void;

const noop: SeedLog = () => {};

/** Tables carrying `isDemo`, in seed order — also `removeDemo`'s delete order, reversed. */
export const DEMO_ENTITY_ORDER = [
  "BlogCategory",
  "BlogPost",
  "Media",
  "Product",
  "Portfolio",
  "Testimonial",
  "Faq",
  "CustomPage",
  "Inquiry",
  "ResearchRecord",
  "ScrapeJob",
  "ImportRun",
] as const;

export type DemoCounts = Record<(typeof DEMO_ENTITY_ORDER)[number], number>;

/**
 * Resolve every fixture `categorySlug` to a real `Category.id` in one query.
 * Throws (loudly, before any write) if a fixture names a slug that is not
 * one of the 16 seeded categories or the database has not been seeded yet —
 * both are configuration problems, not partial-success cases.
 */
async function loadCategoryMap(db: PrismaClient): Promise<Map<string, string>> {
  const rows = await db.category.findMany({
    where: { slug: { in: [...SEEDED_CATEGORY_SLUGS] } },
    select: { id: true, slug: true },
  });
  const map = new Map(rows.map((r) => [r.slug, r.id] as const));
  const missing = SEEDED_CATEGORY_SLUGS.filter((slug) => !map.has(slug));
  if (missing.length > 0) {
    throw new Error(
      `Content Lab seed: the base catalogue seed has not run — missing categories: ${missing.join(", ")}. Run \`npm run db:seed\` (or the environment's bootstrap) first.`,
    );
  }
  return map;
}

/**
 * Seed every Content Lab fixture into `db`. Safe to run more than once — every
 * row is upserted by its deterministic id, and every child table is replaced
 * wholesale for its demo parents.
 */
export async function seedDemo(
  db: PrismaClient,
  opts: { log?: SeedLog } = {},
): Promise<DemoCounts> {
  const log = opts.log ?? noop;
  const fx = loadDemoFixtures();
  const categoryIdBySlug = await loadCategoryMap(db);
  const categoryId = (slug: string): string => {
    const id = categoryIdBySlug.get(slug);
    if (!id)
      throw new Error(`Content Lab seed: unknown category slug "${slug}"`);
    return id;
  };

  // ── Blog categories ──────────────────────────────────────────────
  log(`Blog categories (${fx.blogCategories.length})…`);
  for (const c of fx.blogCategories) {
    const data = {
      name: c.name,
      slug: c.slug,
      translations: (c.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      isDemo: true as const,
    };
    await db.blogCategory.upsert({
      where: { id: c.id },
      create: { id: c.id, ...data },
      update: data,
    });
  }

  // ── Blog posts ────────────────────────────────────────────────────
  log(`Blog posts (${fx.blogPosts.length})…`);
  for (const p of fx.blogPosts) {
    const data = {
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content as Prisma.InputJsonValue,
      coverImage: p.coverImage,
      authorName: p.authorName,
      blogCategoryId: p.blogCategoryId,
      status: p.status,
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      translations: (p.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      isDemo: true as const,
      categoryId: p.categorySlug ? categoryId(p.categorySlug) : null,
    };
    await db.blogPost.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }

  // ── Media ─────────────────────────────────────────────────────────
  log(`Media (${fx.media.length})…`);
  for (const m of fx.media) {
    const data = {
      url: m.url,
      pathname: m.pathname,
      type: m.type,
      folder: m.folder,
      bytes: m.bytes,
      width: m.width,
      height: m.height,
      originalName: m.originalName,
      alt: m.alt,
      checksum: m.checksum,
      blurDataUrl: m.blurDataUrl,
      dominantHex: m.dominantHex,
      provenance: m.provenance,
      isDemo: true as const,
      tags: m.tags,
      caption: m.caption,
      favourite: m.favourite,
      duration: m.duration,
      posterUrl: m.posterUrl,
    };
    await db.media.upsert({
      where: { id: m.id },
      create: { id: m.id, ...data },
      update: data,
    });
  }

  // ── Products ──────────────────────────────────────────────────────
  log(`Products (${fx.products.length})…`);
  for (const p of fx.products) {
    const data = {
      title: p.title,
      displayName: p.displayName,
      slug: p.slug,
      shortTagline: p.shortTagline,
      description: p.description,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      showPrice: p.showPrice,
      timeline: p.timeline,
      materials: p.materials,
      dimensions: p.dimensions,
      occasions: p.occasions as Prisma.InputJsonValue,
      lexical: p.lexical as Prisma.InputJsonValue,
      careNotes: p.careNotes,
      status: p.status,
      featured: p.featured,
      videoUrl: p.videoUrl,
      model3dUrl: p.model3dUrl,
      categoryId: categoryId(p.categorySlug),
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      ogImage: p.ogImage,
      translations: (p.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      needsRewrite: p.needsRewrite,
      importSource: p.importSource,
      importRef: p.importRef,
      tier: p.tier,
      inStock: p.inStock,
      sourceHash: p.sourceHash,
      ownerTouched: p.ownerTouched,
      isDemo: true as const,
    };
    await db.product.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }

  // madeWith self-relation — connect both directions per link.
  for (const link of fx.madeWithLinks) {
    await db.product.update({
      where: { id: link.fromId },
      data: { madeWith: { connect: { id: link.toId } } },
    });
  }

  // ── Product images + customization fields (replace-all per product) ─
  const demoProductIds = fx.products.map((p) => p.id);
  log(
    `Product images (${fx.productImages.length}) and fields (${fx.productFields.length})…`,
  );
  await db.productImage.deleteMany({
    where: { productId: { in: demoProductIds } },
  });
  if (fx.productImages.length > 0) {
    await db.productImage.createMany({
      data: fx.productImages.map((img) => ({
        id: img.id,
        productId: img.productId,
        url: img.url,
        alt: img.alt,
        order: img.order,
        role: img.role,
      })),
    });
  }
  await db.customizationField.deleteMany({
    where: { productId: { in: demoProductIds } },
  });
  if (fx.productFields.length > 0) {
    await db.customizationField.createMany({
      data: fx.productFields.map((f) => ({
        id: f.id,
        productId: f.productId,
        label: f.label,
        type: f.type,
        options: f.options as unknown as Prisma.InputJsonValue,
        required: f.required,
        helpText: f.helpText,
        order: f.order,
      })),
    });
  }

  // ── Portfolio ─────────────────────────────────────────────────────
  log(`Portfolio (${fx.portfolio.length})…`);
  for (const p of fx.portfolio) {
    const data = {
      title: p.title,
      slug: p.slug,
      story: p.story,
      brief: p.brief,
      process: p.process,
      clientNote: p.clientNote,
      location: p.location,
      year: p.year,
      beforeImageUrl: p.beforeImageUrl,
      afterImageUrl: p.afterImageUrl,
      videoUrl: p.videoUrl,
      resultsMeta: p.resultsMeta as Prisma.InputJsonValue,
      translations: (p.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      categoryId: p.categorySlug ? categoryId(p.categorySlug) : null,
      status: p.status,
      isDemo: true as const,
    };
    await db.portfolio.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }
  const demoPortfolioIds = fx.portfolio.map((p) => p.id);
  await db.portfolioImage.deleteMany({
    where: { portfolioId: { in: demoPortfolioIds } },
  });
  if (fx.portfolioImages.length > 0) {
    await db.portfolioImage.createMany({
      data: fx.portfolioImages.map((img) => ({
        id: img.id,
        portfolioId: img.portfolioId,
        url: img.url,
        alt: img.alt,
        caption: img.caption,
        translations: (img.translations ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        order: img.order,
      })),
    });
  }

  // ── Testimonials ─────────────────────────────────────────────────
  log(`Testimonials (${fx.testimonials.length})…`);
  for (const t of fx.testimonials) {
    const data = {
      name: t.name,
      location: t.location,
      quote: t.quote,
      rating: t.rating,
      avatarUrl: t.avatarUrl,
      order: t.order,
      translations: (t.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      status: t.status,
      featured: t.featured,
      isDemo: true as const,
      designation: t.designation,
      category: t.category,
      givenAt: t.givenAt ? new Date(t.givenAt) : null,
      language: t.language,
      productId: t.productId,
      portfolioId: t.portfolioId,
      productTitle: t.productTitle,
      mediaId: t.mediaId,
      installationImageUrl: t.installationImageUrl,
      installationMediaId: t.installationMediaId,
      videoUrl: t.videoUrl,
      videoPosterUrl: t.videoPosterUrl,
      internalNotes: t.internalNotes,
      permissionStatus: t.permissionStatus,
      verifiedAt: t.verifiedAt ? new Date(t.verifiedAt) : null,
      verifiedById: t.verifiedById,
    };
    await db.testimonial.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
  }

  // ── FAQs ──────────────────────────────────────────────────────────
  log(`FAQs (${fx.faqs.length})…`);
  for (const f of fx.faqs) {
    const data = {
      question: f.question,
      answer: f.answer,
      order: f.order,
      status: f.status,
      translations: (f.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      isDemo: true as const,
    };
    await db.faq.upsert({
      where: { id: f.id },
      create: { id: f.id, ...data },
      update: data,
    });
  }

  // ── Custom pages + blocks ────────────────────────────────────────
  log(
    `Custom pages (${fx.customPages.length}) and blocks (${fx.customBlocks.length})…`,
  );
  for (const p of fx.customPages) {
    const data = {
      slug: p.slug,
      title: p.title,
      status: p.status,
      publishAt: p.publishAt ? new Date(p.publishAt) : null,
      noindex: p.noindex,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      ogImage: p.ogImage,
      translations: (p.translations ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      isDemo: true as const,
    };
    await db.customPage.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }
  const demoPageIds = fx.customPages.map((p) => p.id);
  await db.customBlock.deleteMany({ where: { pageId: { in: demoPageIds } } });
  if (fx.customBlocks.length > 0) {
    await db.customBlock.createMany({
      data: fx.customBlocks.map((b) => ({
        id: b.id,
        pageId: b.pageId,
        type: b.type,
        order: b.order,
        data: b.data as Prisma.InputJsonValue,
        translations: (b.translations ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      })),
    });
  }

  // ── Inquiries ─────────────────────────────────────────────────────
  log(`Inquiries (${fx.inquiries.length})…`);
  for (const i of fx.inquiries) {
    const data = {
      source: i.source,
      productId: i.productId,
      customerName: i.customerName,
      phone: i.phone,
      email: i.email,
      selections: i.selections as Prisma.InputJsonValue,
      referenceImageUrls: i.referenceImageUrls as Prisma.InputJsonValue,
      budgetRange: i.budgetRange,
      timeline: i.timeline,
      notes: i.notes,
      whatsappMessage: i.whatsappMessage,
      claimTokenHash: i.claimTokenHash,
      attribution: (i.attribution ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      quotedPrice: i.quotedPrice,
      finalPrice: i.finalPrice,
      staffNotes: i.staffNotes,
      status: i.status,
      isDemo: true as const,
    };
    await db.inquiry.upsert({
      where: { id: i.id },
      create: { id: i.id, ...data },
      update: data,
    });
  }

  // ── Research records ─────────────────────────────────────────────
  log(`Research records (${fx.researchRecords.length})…`);
  for (const r of fx.researchRecords) {
    const data = {
      source: r.source,
      url: r.url,
      title: r.title,
      category: r.category,
      materials: r.materials,
      dimensions: r.dimensions,
      price: r.price,
      images: r.images as Prisma.InputJsonValue,
      description: r.description,
      tags: r.tags,
      extractedAt: r.extractedAt ? new Date(r.extractedAt) : null,
      notes: r.notes,
      status: r.status,
      isDemo: true as const,
      createdById: r.createdById,
    };
    await db.researchRecord.upsert({
      where: { id: r.id },
      create: { id: r.id, ...data },
      update: data,
    });
  }

  // ── Scrape jobs + staged products ────────────────────────────────
  log(
    `Scrape jobs (${fx.scrapeJobs.length}) and staged products (${fx.scrapedProducts.length})…`,
  );
  for (const j of fx.scrapeJobs) {
    const data = {
      sourceId: j.sourceId,
      inputUrl: j.inputUrl,
      sourceKey: j.sourceKey,
      sourceName: j.sourceName,
      platform: j.platform,
      vertical: j.vertical,
      status: j.status,
      cursorPage: j.cursorPage,
      totalScraped: j.totalScraped,
      newCount: j.newCount,
      updatedCount: j.updatedCount,
      sheetSynced: j.sheetSynced,
      error: j.error,
      createdAt: new Date(j.createdAt),
      finishedAt: j.finishedAt ? new Date(j.finishedAt) : null,
      isDemo: true as const,
      scope: j.scope,
      updatedAt: new Date(j.updatedAt),
    };
    await db.scrapeJob.upsert({
      where: { id: j.id },
      create: { id: j.id, ...data },
      update: data,
    });
  }
  const demoJobIds = fx.scrapeJobs.map((j) => j.id);
  await db.scrapedProduct.deleteMany({ where: { jobId: { in: demoJobIds } } });
  if (fx.scrapedProducts.length > 0) {
    await db.scrapedProduct.createMany({
      data: fx.scrapedProducts.map((s) => ({
        id: s.id,
        jobId: s.jobId,
        sourceKey: s.sourceKey,
        externalId: s.externalId,
        url: s.url,
        vertical: s.vertical,
        currency: s.currency,
        title: s.title,
        slug: s.slug,
        category: s.category,
        shortTagline: s.shortTagline,
        description: s.description,
        priceMin: s.priceMin,
        priceMax: s.priceMax,
        showPrice: s.showPrice,
        timeline: s.timeline,
        materials: s.materials,
        dimensions: s.dimensions,
        status: s.status,
        featured: s.featured,
        images: s.images as Prisma.InputJsonValue,
        imageAlts: s.imageAlts as Prisma.InputJsonValue,
        fields: s.fields as Prisma.InputJsonValue,
        seoTitle: s.seoTitle,
        seoDescription: s.seoDescription,
        contentHash: s.contentHash,
        firstSeen: new Date(s.firstSeen),
        lastSeen: new Date(s.lastSeen),
        reviewStatus: s.reviewStatus,
        sheetSyncStatus: s.sheetSyncStatus,
        sheetSyncedAt: s.sheetSyncedAt ? new Date(s.sheetSyncedAt) : null,
        sheetSyncError: s.sheetSyncError,
        importedProductId: s.importedProductId,
        notes: s.notes,
      })),
    });
  }

  // ── Import runs ───────────────────────────────────────────────────
  log(`Import runs (${fx.importRuns.length})…`);
  for (const r of fx.importRuns) {
    const data = {
      trigger: r.trigger,
      dryRun: r.dryRun,
      rowsRead: r.rowsRead,
      created: r.created,
      updated: r.updated,
      unchanged: r.unchanged,
      failed: r.failed,
      abortedReason: r.abortedReason,
      detail: r.detail as Prisma.InputJsonValue,
      startedAt: new Date(r.startedAt),
      finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
      isDemo: true as const,
    };
    await db.importRun.upsert({
      where: { id: r.id },
      create: { id: r.id, ...data },
      update: data,
    });
  }

  const counts = await demoCounts(db);
  await db.activityLog.create({
    data: {
      action: "seed",
      entity: "demo",
      meta: { counts: counts as unknown as Prisma.InputJsonValue },
    },
  });
  log("Done.");
  return counts;
}

/**
 * Remove every demo row, in reverse dependency order. Never touches storage
 * (Vercel Blob / local uploads) — demo fixtures reference `public/`
 * site-root paths, not uploaded files, so there is nothing to delete there.
 */
export async function removeDemo(db: PrismaClient): Promise<DemoCounts> {
  const before = await demoCounts(db);

  // ScrapedProduct has no `isDemo` column of its own — it cascades with its
  // ScrapeJob, which does.
  await db.importRun.deleteMany({ where: { isDemo: true } });
  await db.scrapeJob.deleteMany({ where: { isDemo: true } });
  await db.researchRecord.deleteMany({ where: { isDemo: true } });
  await db.inquiry.deleteMany({ where: { isDemo: true } });
  await db.customPage.deleteMany({ where: { isDemo: true } }); // cascades CustomBlock
  await db.faq.deleteMany({ where: { isDemo: true } });
  await db.testimonial.deleteMany({ where: { isDemo: true } });
  await db.portfolio.deleteMany({ where: { isDemo: true } }); // cascades PortfolioImage
  await db.product.deleteMany({ where: { isDemo: true } }); // cascades ProductImage/CustomizationField
  await db.media.deleteMany({ where: { isDemo: true } });
  await db.blogPost.deleteMany({ where: { isDemo: true } });
  await db.blogCategory.deleteMany({ where: { isDemo: true } });

  await db.activityLog.create({
    data: {
      action: "remove",
      entity: "demo",
      meta: { before: before as unknown as Prisma.InputJsonValue },
    },
  });
  return demoCounts(db);
}

async function demoCounts(db: PrismaClient): Promise<DemoCounts> {
  const [
    BlogCategory,
    BlogPost,
    Media,
    Product,
    Portfolio,
    Testimonial,
    Faq,
    CustomPage,
    Inquiry,
    ResearchRecord,
    ScrapeJob,
    ImportRun,
  ] = await Promise.all([
    db.blogCategory.count({ where: { isDemo: true } }),
    db.blogPost.count({ where: { isDemo: true } }),
    db.media.count({ where: { isDemo: true } }),
    db.product.count({ where: { isDemo: true } }),
    db.portfolio.count({ where: { isDemo: true } }),
    db.testimonial.count({ where: { isDemo: true } }),
    db.faq.count({ where: { isDemo: true } }),
    db.customPage.count({ where: { isDemo: true } }),
    db.inquiry.count({ where: { isDemo: true } }),
    db.researchRecord.count({ where: { isDemo: true } }),
    db.scrapeJob.count({ where: { isDemo: true } }),
    db.importRun.count({ where: { isDemo: true } }),
  ]);
  return {
    BlogCategory,
    BlogPost,
    Media,
    Product,
    Portfolio,
    Testimonial,
    Faq,
    CustomPage,
    Inquiry,
    ResearchRecord,
    ScrapeJob,
    ImportRun,
  };
}

export type DemoStatus = {
  counts: DemoCounts;
  lastSeed: { at: string; who: string | null } | null;
  lastRemove: { at: string; who: string | null } | null;
};

/** Current demo-row counts plus the most recent seed/remove from ActivityLog. */
export async function demoStatus(db: PrismaClient): Promise<DemoStatus> {
  const [counts, lastSeedRow, lastRemoveRow] = await Promise.all([
    demoCounts(db),
    db.activityLog.findFirst({
      where: { entity: "demo", action: "seed" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, user: { select: { name: true } } },
    }),
    db.activityLog.findFirst({
      where: { entity: "demo", action: "remove" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, user: { select: { name: true } } },
    }),
  ]);
  return {
    counts,
    lastSeed: lastSeedRow
      ? {
          at: lastSeedRow.createdAt.toISOString(),
          who: lastSeedRow.user?.name ?? null,
        }
      : null,
    lastRemove: lastRemoveRow
      ? {
          at: lastRemoveRow.createdAt.toISOString(),
          who: lastRemoveRow.user?.name ?? null,
        }
      : null,
  };
}
