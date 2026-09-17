import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import { ImportError, parseCsv } from "@/lib/import/parse";
import {
  buildProductImportContext,
  importProductRow,
  MAX_IMPORT_IMAGES,
} from "@/lib/import/product-row";
import {
  CATEGORY_AUTO_MARK,
  PRODUCT_TIER_SUGGESTED_MARK,
} from "@/lib/import/scrape-export";
import { validateRows } from "@/lib/import/validate";
import { DEFAULT_CARE_NOTES } from "@/lib/scraper/product-enrich";
import { rowToScrapeDeck, toCsv } from "@/lib/scraper/export";
import { ShortlistState } from "@/lib/scraper/shortlist";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * A Product Scraper export uploaded at /studio/import as PRODUCTS, against a
 * real Postgres.
 *
 * The pure half (`scrape-export.test.ts`) proves the remap; only a database
 * can prove the guarantees the promote path gives are the ones this door
 * gives too: every row lands DRAFT with the rewrite guard on, the identity
 * pair is written in the promote path's own format (so ITS lookup finds the
 * row), the staged twin is marked IMPORTED and its shortlist entry
 * confirmed, a slug already in the catalogue is uniquified rather than
 * overwritten, the category and the product tier are filled where the
 * listing makes them clear and never where it does not, and a second upload
 * of the same file updates rather than duplicates.
 *
 * The CSV is built by the REAL ScrapeDeck serializer, so the file under
 * test is the file the owner downloads.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const SOURCE = "bulk-scrape-probe";
const SLUG_PREFIX = "bulk-scrape-probe-";
const ACTOR = "bulk-scrape-probe-user";
const CATEGORY = {
  slug: `${SLUG_PREFIX}widgets`,
  // Words no other category's name or keyword list carries, so the
  // auto-map can only land here.
  name: "Probe Widgets",
};
/** A product already in the catalogue whose slug one export row collides with. */
const TAKEN_SLUG = `${SLUG_PREFIX}taken`;

function product(overrides: Partial<RichProduct>): RichProduct {
  const externalId = overrides.externalId ?? "ext";
  return {
    externalId,
    url: `https://${SOURCE}.test/p/${externalId}`,
    sourceKey: SOURCE,
    vertical: "resin",
    currency: "INR",
    title: "Untitled",
    slug: externalId,
    priceMin: 1000,
    images: [],
    imageAlts: [],
    fields: {},
    ...overrides,
  };
}

// Dimensions alone push LARGE (≥ 60 cm on a side); no keyword in the titles
// so nothing else scores, and the source category names only our probe.
const ALPHA = product({
  externalId: "ext-alpha",
  slug: `${SLUG_PREFIX}alpha`,
  title: "Probe Widget Alpha",
  category: "Probe Widgets",
  dimensions: "180 x 90 cm",
  status: "active",
  priceMin: 85000,
  priceMax: 120000,
  showPrice: true,
});
const COLLIDE = product({
  externalId: "ext-collide",
  slug: TAKEN_SLUG,
  title: "Probe Widget Beta",
  category: "Probe Widgets",
  dimensions: "180 x 90 cm",
  status: "out_of_stock",
});
const EXPLICIT = product({
  externalId: "ext-explicit",
  slug: `${SLUG_PREFIX}gamma`,
  title: "Probe Widget Gamma",
  category: "Probe Widgets",
  dimensions: "180 x 90 cm",
  status: "active",
});
const UNMAPPED = product({
  externalId: "ext-unmapped",
  slug: `${SLUG_PREFIX}delta`,
  title: "Zzz Qqq",
  category: "Zzz Nothing Matches Qqq",
});
const PRODUCTS = [ALPHA, COLLIDE, EXPLICIT, UNMAPPED];

/** The owner's download: the staged rows through the real serializer. */
async function exportCsv(): Promise<string> {
  const staged = await db!.scrapedProduct.findMany({
    where: { sourceKey: SOURCE },
    orderBy: { externalId: "asc" },
  });
  return toCsv(staged.map(rowToScrapeDeck));
}

async function cleanup() {
  await db!.product.deleteMany({
    where: {
      OR: [{ importSource: SOURCE }, { slug: { startsWith: SLUG_PREFIX } }],
    },
  });
  await db!.researchProduct.deleteMany({ where: { sourceKey: SOURCE } });
  await db!.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE } });
  await db!.scrapeJob.deleteMany({ where: { sourceKey: SOURCE } });
  await db!.scrapeSource.deleteMany({ where: { key: SOURCE } });
  await db!.category.deleteMany({ where: { slug: CATEGORY.slug } });
}

describe.skipIf(!db)("bulk import of a Product Scraper export", () => {
  let categoryId = "";

  beforeAll(async () => {
    if (!db) return;
    await cleanup();
    categoryId = (
      await db.category.create({
        data: { ...CATEGORY, order: 9_999 },
        select: { id: true },
      })
    ).id;
    await db.product.create({
      data: {
        title: "Already here",
        slug: TAKEN_SLUG,
        categoryId,
        status: "PUBLISHED",
      },
    });

    await db.scrapeSource.create({
      data: {
        key: SOURCE,
        name: SOURCE,
        baseUrl: `https://${SOURCE}.test`,
        tier: "LARGE_FORMAT",
      },
    });
    const source = await db.scrapeSource.findUniqueOrThrow({
      where: { key: SOURCE },
      select: { id: true },
    });
    const job = await db.scrapeJob.create({
      data: {
        source: { connect: { id: source.id } },
        sourceKey: SOURCE,
        sourceName: SOURCE,
        vertical: "RESIN",
        platform: "SHOPIFY",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: `https://${SOURCE}.test`,
      },
      select: { id: true },
    });
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(job.id, SOURCE, PRODUCTS);
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
  });

  it("refuses the file for every type but Products, naming the fix", async () => {
    const rows = parseCsv(await exportCsv());
    for (const typeKey of ["portfolio", "blog-posts", "categories"] as const) {
      await expect(validateRows(typeKey, rows)).rejects.toThrow(ImportError);
      await expect(validateRows(typeKey, rows)).rejects.toThrow(
        /Product Scraper export.*Products only.*pick Products/,
      );
    }
  });

  it("imports the owner's download as guarded drafts with the promote path's identity, twin and slug rules", async () => {
    const parsed = parseCsv(await exportCsv());
    // A hand edit in the spreadsheet: two columns the export never carries.
    const explicit = parsed.find((row) => row.externalid === "ext-explicit")!;
    explicit.product_tier = "SMALL";
    explicit.category_slug = CATEGORY.slug;

    const validation = await validateRows("products", parsed);
    expect(validation.origin).toBe("scraper");
    expect(validation.autoMappedCategories).toBe(2); // ALPHA, COLLIDE
    expect(validation.suggestedTiers).toBe(2); // ALPHA, COLLIDE — EXPLICIT's cell wins
    expect(validation.unmappedCategories).toBe(1); // UNMAPPED

    const byRef = new Map(
      validation.rows.map((row) => [row.data.external_id, row] as const),
    );
    expect(byRef.get("ext-alpha")!.status).toBe("create");
    expect(byRef.get("ext-collide")!.status).toBe("create"); // a slug match is NOT an update
    expect(byRef.get("ext-explicit")!.status).toBe("create");
    const unmapped = byRef.get("ext-unmapped")!;
    expect(unmapped.status).toBe("error");
    expect(unmapped.messages).toContain("category_slug is required");
    expect(unmapped.messages.join(" ")).toMatch(
      /nothing in the catalogue matched/,
    );

    // The validator's fills, and its marks beside them.
    const alpha = byRef.get("ext-alpha")!.data;
    expect(alpha.category_slug).toBe(CATEGORY.slug);
    expect(alpha[CATEGORY_AUTO_MARK]).toBe("TRUE");
    expect(alpha.product_tier).toBe("LARGE_FORMAT");
    expect(alpha[PRODUCT_TIER_SUGGESTED_MARK]).toBe("TRUE");
    expect(alpha.status).toBe("");
    expect(alpha.tier).toBe("");
    expect(alpha.in_stock).toBe("TRUE");
    expect(explicit.product_tier).toBe("SMALL");
    expect(byRef.get("ext-explicit")!.data[PRODUCT_TIER_SUGGESTED_MARK]).toBe(
      "",
    );

    const attempt = validation.rows
      .filter((row) => row.status !== "error")
      .map((row) => row.data);
    const ctx = await buildProductImportContext(attempt, "scraper", ACTOR);
    const outcomes = await Promise.all(
      attempt.map((row) => importProductRow(row, ctx, false)),
    );
    expect(outcomes).toEqual(["created", "created", "created"]);

    // ALPHA: DRAFT, guarded, identity in the promote path's own format.
    const alphaProduct = await db!.product.findUniqueOrThrow({
      // The literal lookup `importOneScrapedRow` makes — if it finds the
      // row, a later approve in the inbox updates it instead of creating a
      // twin under the same pair.
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-alpha",
        },
      },
    });
    expect(alphaProduct).toMatchObject({
      slug: `${SLUG_PREFIX}alpha`,
      status: "DRAFT",
      needsRewrite: true,
      importSource: SOURCE,
      importRef: "ext-alpha",
      categoryId,
      sizeTier: "LARGE_FORMAT",
      tier: null,
      inStock: true,
      priceMin: 85000,
      priceMax: 120000,
      careNotes: DEFAULT_CARE_NOTES,
      ownerTouched: false,
    });

    // The staged twin is IMPORTED and points at the draft; its shortlist
    // entry is CONFIRMED by the actor, the way the promote path records it.
    const twin = await db!.scrapedProduct.findUniqueOrThrow({
      where: {
        sourceKey_externalId: { sourceKey: SOURCE, externalId: "ext-alpha" },
      },
      select: { reviewStatus: true, importedProductId: true },
    });
    expect(twin).toEqual({
      reviewStatus: "IMPORTED",
      importedProductId: alphaProduct.id,
    });
    const research = await db!.researchProduct.findUniqueOrThrow({
      where: {
        sourceKey_externalId: { sourceKey: SOURCE, externalId: "ext-alpha" },
      },
      select: {
        shortlistEntry: {
          select: { state: true, changedBy: true, reason: true },
        },
      },
    });
    expect(research.shortlistEntry).toEqual({
      state: ShortlistState.CONFIRMED,
      changedBy: ACTOR,
      reason: "imported to catalog",
    });

    // COLLIDE: the slug was taken by an unrelated product, which is
    // untouched; the draft got the next free slug and its own identity.
    const taken = await db!.product.findUniqueOrThrow({
      where: { slug: TAKEN_SLUG },
      select: { title: true, status: true, importSource: true },
    });
    expect(taken).toEqual({
      title: "Already here",
      status: "PUBLISHED",
      importSource: null,
    });
    const collide = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-collide",
        },
      },
      select: { slug: true, inStock: true, status: true, needsRewrite: true },
    });
    expect(collide).toEqual({
      slug: `${TAKEN_SLUG}-2`,
      inStock: false,
      status: "DRAFT",
      needsRewrite: true,
    });

    // EXPLICIT: the owner's cell outranks the suggestion.
    const gamma = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-explicit",
        },
      },
      select: { sizeTier: true, categoryId: true },
    });
    expect(gamma).toEqual({ sizeTier: "SMALL_FORMAT", categoryId });

    // UNMAPPED never reached the catalogue.
    expect(
      await db!.product.count({
        where: { importSource: SOURCE, importRef: "ext-unmapped" },
      }),
    ).toBe(0);
  });

  it("a second upload of the same file updates the drafts — never duplicates — and a suggested tier never overwrites a filed one", async () => {
    // The owner filed ALPHA's tier in the studio meanwhile (no ownerTouched:
    // a bulk action, not a form save), and the file still SUGGESTS large.
    await db!.product.update({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-alpha",
        },
      },
      data: { sizeTier: "MEDIUM_FORMAT" },
    });
    const before = await db!.product.count({ where: { importSource: SOURCE } });

    // What the wizard echoes back to runImport: the rows the FIRST
    // validation produced, validated again.
    const first = await validateRows("products", parseCsv(await exportCsv()));
    const echoed = first.rows.map((row) => row.data);
    const second = await validateRows("products", echoed);
    expect(second.origin).toBe("scraper");
    // No hand edits this time, so all three mapped rows were ours — and the
    // marks make the second pass count them again rather than read our own
    // fill as the owner's cells.
    expect(first.autoMappedCategories).toBe(3);
    expect(first.suggestedTiers).toBe(3);
    expect(first.unmappedCategories).toBe(1);
    expect(second.autoMappedCategories).toBe(first.autoMappedCategories);
    expect(second.suggestedTiers).toBe(first.suggestedTiers);
    expect(second.unmappedCategories).toBe(first.unmappedCategories);
    const statuses = new Map(
      second.rows.map((row) => [row.data.external_id, row.status] as const),
    );
    expect(statuses.get("ext-alpha")).toBe("update");
    expect(statuses.get("ext-collide")).toBe("update");
    expect(statuses.get("ext-unmapped")).toBe("error");

    const attempt = second.rows
      .filter((row) => row.status !== "error")
      .map((row) => row.data);
    const ctx = await buildProductImportContext(attempt, "scraper", ACTOR);
    const outcomes = await Promise.all(
      attempt.map((row) => importProductRow(row, ctx, false)),
    );
    expect(new Set(outcomes)).toEqual(new Set(["updated"]));

    expect(await db!.product.count({ where: { importSource: SOURCE } })).toBe(
      before,
    );
    expect(
      await db!.product.count({ where: { slug: { startsWith: TAKEN_SLUG } } }),
    ).toBe(2);

    const alpha = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-alpha",
        },
      },
      select: { sizeTier: true, status: true, needsRewrite: true, slug: true },
    });
    expect(alpha).toEqual({
      sizeTier: "MEDIUM_FORMAT", // the suggestion is fill-only
      status: "DRAFT",
      needsRewrite: true,
      slug: `${SLUG_PREFIX}alpha`, // identity columns are not rewritten
    });
  });

  it("an owner-edited draft is protected: availability refreshes, the copy stays", async () => {
    await db!.product.update({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-collide",
        },
      },
      data: {
        title: "Beta, rewritten by the owner",
        ownerTouched: true,
        inStock: true,
      },
    });

    const validation = await validateRows(
      "products",
      parseCsv(await exportCsv()),
    );
    const row = validation.rows.find(
      (r) => r.data.external_id === "ext-collide",
    )!;
    expect(row.status).toBe("update");
    expect(row.data.in_stock).toBe("FALSE");

    const ctx = await buildProductImportContext([row.data], "scraper", ACTOR);
    expect(await importProductRow(row.data, ctx, false)).toBe("protected");

    const collide = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-collide",
        },
      },
      select: { title: true, inStock: true },
    });
    expect(collide).toEqual({
      title: "Beta, rewritten by the owner",
      inStock: false,
    });

    // The explicit overwrite the wizard's checkbox sends replaces the copy.
    expect(await importProductRow(row.data, ctx, true)).toBe("updated");
    const overwritten = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-collide",
        },
      },
      select: { title: true, needsRewrite: true },
    });
    expect(overwritten).toEqual({
      title: "Probe Widget Beta",
      needsRewrite: true,
    });
  });

  it("an update re-flags a live product but never takes it off the shop", async () => {
    // The owner approved ALPHA from the products list (a bulk action, not a
    // form save, so no ownerTouched) and it went live; the same listing
    // arrives again in a fresh export.
    await db!.product.update({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-alpha",
        },
      },
      data: { status: "PUBLISHED", needsRewrite: false },
    });
    const validation = await validateRows(
      "products",
      parseCsv(await exportCsv()),
    );
    const row = validation.rows.find(
      (r) => r.data.external_id === "ext-alpha",
    )!;
    expect(row.status).toBe("update");
    const ctx = await buildProductImportContext([row.data], "scraper", ACTOR);
    expect(await importProductRow(row.data, ctx, false)).toBe("updated");
    const alpha = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-alpha",
        },
      },
      select: { status: true, needsRewrite: true, title: true },
    });
    expect(alpha).toEqual({
      status: "PUBLISHED", // the promote path's rule: re-flagged, not demoted
      needsRewrite: true,
      title: "Probe Widget Alpha",
    });
  });

  it("a catalog-fill twin is left alone — the promote path's rule — and its staged row marked imported", async () => {
    // The fill wrote this row from the owner's list under `sheet:<key>`; the
    // same listing now arrives in a scraper export of that source.
    const twinProduct = await db!.product.create({
      data: {
        title: "Fill twin, the owner's own",
        slug: `${SLUG_PREFIX}twin`,
        categoryId,
        status: "PUBLISHED",
        importSource: `sheet:${SOURCE}`,
        importRef: "ext-twin",
        needsRewrite: false,
      },
      select: { id: true },
    });
    const job = await db!.scrapeJob.findFirstOrThrow({
      where: { sourceKey: SOURCE },
      select: { id: true },
    });
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(job.id, SOURCE, [
      product({
        externalId: "ext-twin",
        slug: `${SLUG_PREFIX}twin`,
        title: "Fill twin, as the supplier lists it",
        category: "Probe Widgets",
        dimensions: "180 x 90 cm",
        status: "out_of_stock",
      }),
    ]);

    const validation = await validateRows(
      "products",
      parseCsv(await exportCsv()),
    );
    const row = validation.rows.find((r) => r.data.external_id === "ext-twin")!;
    expect(row.status).toBe("update");
    const ctx = await buildProductImportContext([row.data], "scraper", ACTOR);
    expect(await importProductRow(row.data, ctx, false)).toBe("protected");
    // The overwrite box is about owner-edited rows; it does not reach the
    // fill's own.
    expect(await importProductRow(row.data, ctx, true)).toBe("protected");

    const twin = await db!.product.findUniqueOrThrow({
      where: { id: twinProduct.id },
      select: {
        title: true,
        status: true,
        needsRewrite: true,
        inStock: true,
        importSource: true,
      },
    });
    expect(twin).toEqual({
      title: "Fill twin, the owner's own",
      status: "PUBLISHED",
      needsRewrite: false,
      inStock: true,
      importSource: `sheet:${SOURCE}`,
    });
    const staged = await db!.scrapedProduct.findUniqueOrThrow({
      where: {
        sourceKey_externalId: { sourceKey: SOURCE, externalId: "ext-twin" },
      },
      select: { reviewStatus: true, importedProductId: true },
    });
    expect(staged).toEqual({
      reviewStatus: "IMPORTED",
      importedProductId: twinProduct.id,
    });
    expect(await db!.product.count({ where: { importRef: "ext-twin" } })).toBe(
      1,
    );
  });

  it("a scraper row's gallery is capped at the promote path's six images", async () => {
    const job = await db!.scrapeJob.findFirstOrThrow({
      where: { sourceKey: SOURCE },
      select: { id: true },
    });
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(job.id, SOURCE, [
      product({
        externalId: "ext-gallery",
        slug: `${SLUG_PREFIX}gallery`,
        title: "Probe Widget Gallery",
        category: "Probe Widgets",
        dimensions: "180 x 90 cm",
        // A Shopify listing routinely carries ten. Each one is a fetch, a
        // blob write and a Media row inside one server action.
        images: Array.from(
          { length: 10 },
          (_, i) => `https://${SOURCE}.test/img/${i}.jpg`,
        ),
        imageAlts: [],
      }),
    ]);

    const validation = await validateRows(
      "products",
      parseCsv(await exportCsv()),
    );
    const row = validation.rows.find(
      (r) => r.data.external_id === "ext-gallery",
    )!;
    const ctx = await buildProductImportContext([row.data], "scraper", ACTOR);
    expect(await importProductRow(row.data, ctx, false)).toBe("created");

    const created = await db!.product.findUniqueOrThrow({
      where: {
        importSource_importRef: {
          importSource: SOURCE,
          importRef: "ext-gallery",
        },
      },
      select: { _count: { select: { images: true } } },
    });
    expect(created._count.images).toBe(MAX_IMPORT_IMAGES);
  });

  it("an ordinary products file is untouched by all of this: slug identity, status from the cell", async () => {
    const validation = await validateRows("products", [
      {
        title: "Plain Probe",
        slug: `${SLUG_PREFIX}plain`,
        category_slug: CATEGORY.slug,
        status: "REVIEW",
      },
    ]);
    expect(validation.origin).toBeUndefined();
    expect(validation.rows[0].status).toBe("create");

    const ctx = await buildProductImportContext(
      [validation.rows[0].data],
      undefined,
      ACTOR,
    );
    expect(await importProductRow(validation.rows[0].data, ctx, false)).toBe(
      "created",
    );
    const plain = await db!.product.findUniqueOrThrow({
      where: { slug: `${SLUG_PREFIX}plain` },
      select: { status: true, needsRewrite: true, importSource: true },
    });
    expect(plain).toEqual({
      status: "REVIEW",
      needsRewrite: false,
      importSource: null,
    });
  });

  it("an ordinary file cannot publish an untiered row — the form's guard, scoped to the transition", async () => {
    const live = {
      title: "Plain Probe Live",
      slug: `${SLUG_PREFIX}plain-live`,
      category_slug: CATEGORY.slug,
      status: "PUBLISHED",
    };
    const refused = await validateRows("products", [live]);
    expect(refused.rows[0].status).toBe("error");
    expect(refused.rows[0].messages.join(" ")).toMatch(
      /product_tier is required to publish/,
    );

    // With a tier it goes through, and lands live.
    const accepted = await validateRows("products", [
      { ...live, product_tier: "MEDIUM" },
    ]);
    expect(accepted.rows[0].status).toBe("create");
    const ctx = await buildProductImportContext(
      [accepted.rows[0].data],
      undefined,
      ACTOR,
    );
    expect(await importProductRow(accepted.rows[0].data, ctx, false)).toBe(
      "created",
    );
    expect(
      await db!.product.findUniqueOrThrow({
        where: { slug: live.slug },
        select: { status: true, sizeTier: true },
      }),
    ).toEqual({ status: "PUBLISHED", sizeTier: "MEDIUM_FORMAT" });

    // A product that is ALREADY live and untiered (the backlog) keeps
    // saving from a file with no tier cell — the state is not the
    // transition, the same scoping as the form and bulk Publish.
    await db!.product.create({
      data: {
        title: "Plain Probe Backlog",
        slug: `${SLUG_PREFIX}plain-backlog`,
        categoryId,
        status: "PUBLISHED",
      },
    });
    const backlog = await validateRows("products", [
      { ...live, title: "Plain Probe Backlog", slug: `${SLUG_PREFIX}plain-backlog` },
    ]);
    expect(backlog.rows[0].status).toBe("update");

    // And a draft needs no tier — a blank status is DRAFT.
    const draft = await validateRows("products", [
      { ...live, slug: `${SLUG_PREFIX}plain-draft`, status: "" },
    ]);
    expect(draft.rows[0].status).toBe("create");
  });
});
