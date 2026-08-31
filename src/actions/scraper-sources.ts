"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import type { ScrapePlatform } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  fingerprint,
  isBlockedMarketplace,
  normalizeBaseUrl,
} from "@/lib/scraper/fingerprint";
import { SCRAPEDECK_COLUMNS } from "@/lib/scraper/export";
import { TIER_NUMBER } from "@/lib/scraper/purge";
import { applySeedSources } from "@/lib/scraper/seed-sources";
import {
  deleteRowsFromTab,
  isSheetSyncConfigured,
  TAB_BY_TIER,
} from "@/lib/scraper/sheets";
import { slugify } from "@/lib/slug";

const STUDIO_PATH = "/studio/scraper/sources";

const MARKETPLACE_ERROR =
  "Marketplaces (Amazon, Etsy, Flipkart, Meesho, IndiaMART, TradeIndia) are blocked by design — use their official APIs.";

const ADAPTER_NOTE =
  "This site needs a custom adapter — supported today: Shopify, WooCommerce, JSON-LD Product schema";

/** Module-level clock helper — keeps `new Date()` out of render bodies. */
const now = () => new Date();

/**
 * Upsert the curated seed registry (by key). Verified platforms are never
 * downgraded — see applySeedSources.
 */
export async function seedScrapeSources(): Promise<
  ActionResult<{ seeded: number }>
> {
  return runAction(async () => {
    const session = await requireStaff();
    const seeded = await applySeedSources();

    await logActivity({
      userId: session.user.id,
      action: "seed",
      entity: "ScrapeSource",
      meta: { seeded },
    });
    revalidatePath(STUDIO_PATH);
    return { seeded };
  });
}

const addSchema = z.object({
  url: z.string().trim().min(1, "URL is required").max(2048),
  tier: z.enum(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D"]),
  vertical: z.string().trim().min(1).max(60),
  country: z.string().trim().min(1).max(20),
  supply: z.boolean(),
});

export type AddScrapeSourceInput = z.input<typeof addSchema>;

type AddOutcome =
  | { outcome: "invalid" }
  | { outcome: "blocked" }
  | {
      outcome: "saved";
      id: string;
      platform: ScrapePlatform;
      enabled: boolean;
    };

/**
 * Register a new source by URL. Marketplaces are refused outright; every
 * other site is fingerprinted live — a recognised platform is saved enabled
 * and verified, an UNKNOWN one is saved disabled with an explanatory note.
 */
export async function addScrapeSource(
  input: AddScrapeSourceInput,
): Promise<
  ActionResult<{ id: string; platform: ScrapePlatform; enabled: boolean }>
> {
  const result = await runAction<AddOutcome>(async () => {
    const session = await requireStaff();
    const parsed = addSchema.parse(input);

    let baseUrl: string;
    try {
      baseUrl = normalizeBaseUrl(parsed.url);
    } catch {
      return { outcome: "invalid" };
    }
    if (isBlockedMarketplace(baseUrl)) return { outcome: "blocked" };

    const host = new URL(baseUrl).host;
    const key = slugify(host);
    const platform = await fingerprint(baseUrl);
    const verified = platform !== "UNKNOWN";

    const data = {
      name: host,
      baseUrl,
      tier: parsed.tier,
      vertical: parsed.vertical,
      country: parsed.country.toUpperCase(),
      supply: parsed.supply,
      platform,
      enabled: verified,
      verifiedAt: verified ? now() : null,
      notes: verified ? null : ADAPTER_NOTE,
    };
    const source = await db.scrapeSource.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "ScrapeSource",
      entityId: source.id,
      meta: { key, baseUrl, platform },
    });
    revalidatePath(STUDIO_PATH);
    return { outcome: "saved", id: source.id, platform, enabled: verified };
  });

  if (!result.ok) return result;
  const data = result.data;
  if (!data || data.outcome === "invalid") {
    return { ok: false, error: "That doesn't look like a valid website URL." };
  }
  if (data.outcome === "blocked") {
    return { ok: false, error: MARKETPLACE_ERROR };
  }
  return {
    ok: true,
    data: { id: data.id, platform: data.platform, enabled: data.enabled },
  };
}

const bulkAddSchema = z.object({
  urls: z
    .array(z.string().trim().min(1).max(2048))
    .min(1, "Add at least one URL")
    .max(25, "Add up to 25 URLs at a time"),
  tier: z.enum(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D"]),
  vertical: z.string().trim().min(1).max(60),
  country: z.string().trim().min(1).max(20),
  supply: z.boolean(),
});

export type BulkAddScrapeSourcesInput = z.input<typeof bulkAddSchema>;

export type BulkAddResult = {
  url: string;
  status: "added" | "updated" | "invalid" | "blocked" | "error";
  platform?: ScrapePlatform;
  enabled?: boolean;
  message?: string;
};

export type BulkAddReport = {
  results: BulkAddResult[];
  added: number;
  updated: number;
  failed: number;
};

/**
 * Register MANY sources at once — paste a list of URLs (one per line). Each is
 * normalised, marketplace-checked, fingerprinted live and upserted by host key
 * (re-adding an existing site updates it, never duplicates). Duplicates within
 * the pasted list are collapsed. Returns a per-URL report. Capped per call to
 * respect serverless time limits.
 */
export async function addScrapeSources(
  input: BulkAddScrapeSourcesInput,
): Promise<ActionResult<BulkAddReport>> {
  return runAction<BulkAddReport>(async () => {
    const session = await requireStaff();
    const parsed = bulkAddSchema.parse(input);

    // Normalise + dedupe the pasted list up front.
    const items: { host: string; baseUrl: string; key: string }[] = [];
    const preflight: BulkAddResult[] = [];
    const seen = new Set<string>();
    for (const rawUrl of parsed.urls) {
      let baseUrl: string;
      try {
        baseUrl = normalizeBaseUrl(rawUrl);
      } catch {
        preflight.push({ url: rawUrl, status: "invalid", message: "Not a valid URL" });
        continue;
      }
      if (isBlockedMarketplace(baseUrl)) {
        preflight.push({
          url: rawUrl,
          status: "blocked",
          message: "Marketplaces can't be scraped — use their official API",
        });
        continue;
      }
      const host = new URL(baseUrl).host;
      const key = slugify(host);
      if (seen.has(key)) continue; // same site pasted twice
      seen.add(key);
      items.push({ host, baseUrl, key });
    }

    const results: BulkAddResult[] = [];
    let added = 0;
    let updated = 0;

    for (const { host, baseUrl, key } of items) {
      try {
        const existing = await db.scrapeSource.findUnique({
          where: { key },
          select: { id: true },
        });
        const platform = await fingerprint(baseUrl);
        const verified = platform !== "UNKNOWN";
        const data = {
          name: host,
          baseUrl,
          tier: parsed.tier,
          vertical: parsed.vertical,
          country: parsed.country.toUpperCase(),
          supply: parsed.supply,
          platform,
          enabled: verified,
          verifiedAt: verified ? now() : null,
          notes: verified ? null : ADAPTER_NOTE,
        };
        await db.scrapeSource.upsert({
          where: { key },
          create: { key, ...data },
          update: data,
        });
        if (existing) {
          updated += 1;
          results.push({ url: host, status: "updated", platform, enabled: verified });
        } else {
          added += 1;
          results.push({ url: host, status: "added", platform, enabled: verified });
        }
      } catch (error) {
        results.push({
          url: host,
          status: "error",
          message: error instanceof Error ? error.message : "Failed to add",
        });
      }
    }

    const allResults = [...results, ...preflight];
    const failed = allResults.filter(
      (r) => r.status === "invalid" || r.status === "blocked" || r.status === "error",
    ).length;

    await logActivity({
      userId: session.user.id,
      action: "bulk-create",
      entity: "ScrapeSource",
      meta: { added, updated, failed, total: parsed.urls.length },
    });
    revalidatePath(STUDIO_PATH);
    return { results: allResults, added, updated, failed };
  });
}

const idsSchema = z.array(z.string().min(1)).min(1);
const toggleSchema = z.object({ ids: idsSchema, enabled: z.boolean() });

/** Bulk enable/disable. */
export async function toggleScrapeSources(
  ids: string[],
  enabled: boolean,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = toggleSchema.parse({ ids, enabled });

    const res = await db.scrapeSource.updateMany({
      where: { id: { in: parsed.ids } },
      data: { enabled: parsed.enabled },
    });

    await logActivity({
      userId: session.user.id,
      action: parsed.enabled ? "enable" : "disable",
      entity: "ScrapeSource",
      meta: { count: res.count, ids: parsed.ids },
    });
    revalidatePath(STUDIO_PATH);
    return { updated: res.count };
  });
}

/**
 * Clear a circuit-breaker pause.
 *
 * Resets the failure counter too. Resuming without that would leave the source
 * one failure from tripping again, which is not what "resume" means to the
 * person pressing it — they have looked at the site and believe it is fixed.
 */
export async function resumeScrapeSource(
  id: string,
): Promise<ActionResult<{ name: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = z.string().min(1).parse(id);

    const row = await db.scrapeSource.update({
      where: { id: parsed },
      data: { pausedAt: null, pausedReason: null, consecutiveFailures: 0 },
      select: { key: true, name: true },
    });

    await logActivity({
      userId: session.user.id,
      action: "resume",
      entity: "ScrapeSource",
      entityId: parsed,
      meta: { sourceKey: row.key },
    });
    revalidatePath(STUDIO_PATH);
    return { name: row.name };
  });
}

const policySchema = z.object({
  id: z.string().min(1),
  policy: z.enum(["MANUAL", "ON_COMPLETE", "OFF"]),
});

/**
 * Set when this source's completed scrapes reach the Google Sheet.
 *
 * This is the whole of the owner's "push automatically, but when I say so":
 * the push engine does not change, only the trigger. MANUAL stages and waits;
 * ON_COMPLETE fires at the end of every job; OFF opts the source out.
 */
export async function setSheetSyncPolicy(
  id: string,
  policy: "MANUAL" | "ON_COMPLETE" | "OFF",
): Promise<ActionResult<{ policy: string }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = policySchema.parse({ id, policy });

    const row = await db.scrapeSource.update({
      where: { id: parsed.id },
      data: { sheetSyncPolicy: parsed.policy },
      select: { key: true, name: true },
    });

    await logActivity({
      userId: session.user.id,
      action: "sheet-policy",
      entity: "ScrapeSource",
      entityId: parsed.id,
      meta: { sourceKey: row.key, policy: parsed.policy },
    });
    revalidatePath(STUDIO_PATH);
    return { policy: parsed.policy };
  });
}

/**
 * Re-fingerprint a source live. A recognised platform stamps verifiedAt;
 * an UNKNOWN result also disables the source and explains why in notes.
 * Enabled/notes are otherwise left alone so deliberate operator choices
 * (e.g. "Do NOT scrape" owner entries) survive a verify.
 */
export async function verifyScrapeSource(
  id: string,
): Promise<ActionResult<{ platform: ScrapePlatform }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsedId = z.string().min(1).parse(id);

    const source = await db.scrapeSource.findUnique({
      where: { id: parsedId },
    });
    if (!source) throw new Error("Source not found");

    const platform = await fingerprint(source.baseUrl);
    const verified = platform !== "UNKNOWN";

    await db.scrapeSource.update({
      where: { id: source.id },
      data: verified
        ? { platform, verifiedAt: now() }
        : { platform, verifiedAt: null, enabled: false, notes: ADAPTER_NOTE },
    });

    await logActivity({
      userId: session.user.id,
      action: "verify",
      entity: "ScrapeSource",
      entityId: source.id,
      meta: { key: source.key, platform },
    });
    revalidatePath(STUDIO_PATH);
    return { platform };
  });
}

/** Bulk delete. Jobs keep running history — ScrapeJob.sourceId is SetNull. */
const purgeSchema = z.object({
  tier: z.enum(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D"]).optional(),
  ids: z.array(z.string().min(1)).max(500).optional(),
  deleteCatalogProducts: z.boolean().default(false),
});

/** Counts for the confirmation, computed before anything is removed. */
export async function previewSourcePurge(
  input: z.input<typeof purgeSchema>,
): Promise<
  ActionResult<{
    sources: number;
    stagedProducts: number;
    jobs: number;
    catalogProducts: number;
    sourceKeys: string[];
  }>
> {
  return runAction(async () => {
    await requireStaff();
    const parsed = purgeSchema.parse(input);
    const where = parsed.tier
      ? { tier: parsed.tier }
      : { id: { in: parsed.ids ?? [] } };

    const sources = await db.scrapeSource.findMany({
      where,
      select: { key: true, tier: true },
    });
    const keys = sources.map((s) => s.key);
    const tierNumbers = [
      ...new Set(
        (parsed.tier ? [parsed.tier] : sources.map((s) => s.tier)).map(
          (t) => TIER_NUMBER[t],
        ),
      ),
    ];
    if (keys.length === 0) {
      return {
        sources: 0,
        stagedProducts: 0,
        jobs: 0,
        catalogProducts: 0,
        sourceKeys: [],
      };
    }

    const [stagedProducts, jobs, catalogProducts] = await Promise.all([
      db.scrapedProduct.count({ where: { sourceKey: { in: keys } } }),
      db.scrapeJob.count({ where: { sourceKey: { in: keys } } }),
      // Both spellings: the scraper promotes under the bare key, the
      // deploy-time sheet importer under `sheet:<key>` (audit H6).
      // By TIER NUMBER as well as by source key. Once a source row is gone,
      // its catalog products keep only `Product.tier` — matching on
      // importSource alone strands them, and a purge that reports success
      // while leaving thousands behind is the worst kind of wrong.
      db.product.count({
        where: {
          OR: [
            { importSource: { in: [...keys, ...keys.map((k) => `sheet:${k}`)] } },
            ...(tierNumbers.length > 0 ? [{ tier: { in: tierNumbers } }] : []),
          ],
        },
      }),
    ]);

    return {
      sources: keys.length,
      stagedProducts,
      jobs,
      catalogProducts,
      sourceKeys: keys,
    };
  });
}

/**
 * Remove source websites and everything that came from them.
 *
 * Deleting the ScrapeSource row alone is not enough: jobs survive it with a
 * null sourceId (onDelete: SetNull), their staged products survive with them,
 * and the sheet keeps every row the source ever produced. The registry looks
 * clean and nothing else is.
 *
 * The tier tab IS cleared here, which is the deliberate opposite of the
 * per-product delete rule. There the deck is left alone because it records
 * what a supplier's site said, and removing one product from the catalogue
 * does not un-happen the scrape. Here the supplier itself is going.
 *
 * Catalog products are kept unless explicitly asked for — they are live on the
 * storefront, and "stop scraping this supplier" is not the same request as
 * "take these products off my website". When they ARE deleted, a DeletedImport
 * tombstone goes with each, so the next deploy-time import does not resurrect
 * what was just removed.
 */
export async function purgeScrapeSources(
  input: z.input<typeof purgeSchema>,
): Promise<
  ActionResult<{
    sources: number;
    stagedProducts: number;
    catalogProducts: number;
    sheetRows: number;
  }>
> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = purgeSchema.parse(input);
    const where = parsed.tier
      ? { tier: parsed.tier }
      : { id: { in: parsed.ids ?? [] } };

    const sources = await db.scrapeSource.findMany({
      where,
      select: { id: true, key: true, tier: true },
    });
    if (sources.length === 0) {
      return { sources: 0, stagedProducts: 0, catalogProducts: 0, sheetRows: 0 };
    }
    const keys = sources.map((s) => s.key);
    const tiers = [...new Set(sources.map((s) => s.tier))];

    // Catalog first, while the products can still be found by their keys.
    let catalogProducts = 0;
    if (parsed.deleteCatalogProducts) {
      const importSources = [...keys, ...keys.map((k) => `sheet:${k}`)];
      const tierNumbers = [...new Set(tiers.map((t) => TIER_NUMBER[t]))];
      const catalogWhere = {
        OR: [
          { importSource: { in: importSources } },
          ...(tierNumbers.length > 0 ? [{ tier: { in: tierNumbers } }] : []),
        ],
      };
      const doomed = await db.product.findMany({
        where: catalogWhere,
        select: { importSource: true, importRef: true },
      });
      if (doomed.length > 0) {
        await db.deletedImport.createMany({
          data: doomed.flatMap((p) =>
            p.importSource && p.importRef
              ? [{ importSource: p.importSource, importRef: p.importRef }]
              : [],
          ),
          skipDuplicates: true,
        });
      }
      const res = await db.product.deleteMany({ where: catalogWhere });
      catalogProducts = res.count;
    }

    // Everything the scrape produced. Deleted by sourceKey rather than by
    // relation, so rows whose job was already tidied away still go.
    const [staged] = await db.$transaction([
      db.scrapedProduct.deleteMany({ where: { sourceKey: { in: keys } } }),
      db.priceHistory.deleteMany({ where: { sourceKey: { in: keys } } }),
      db.validationFailure.deleteMany({ where: { sourceKey: { in: keys } } }),
      db.scrapeJob.deleteMany({ where: { sourceKey: { in: keys } } }),
      db.scrapeSource.deleteMany({ where: { id: { in: sources.map((s) => s.id) } } }),
    ]);

    // The sheet's scrape decks. Rows are keyed `sourceKey|externalId`, and the
    // tier tab's first column IS sourceKey — so matching on it removes every
    // row those sources ever produced.
    let sheetRows = 0;
    if (isSheetSyncConfigured()) {
      for (const tier of tiers) {
        try {
          const res = await deleteRowsFromTab({
            tab: TAB_BY_TIER[tier],
            keys,
            keyOf: (row) => row[0] ?? "",
            columns: SCRAPEDECK_COLUMNS.length,
          });
          sheetRows += res.deleted;
        } catch (error) {
          // The database change already happened. Failing here would report a
          // completed purge as an error; the sheet can be re-synced.
          console.error(`purge: sheet cleanup failed for ${tier}:`, error);
        }
      }
    }

    await logActivity({
      userId: session.user.id,
      action: "purge",
      entity: "ScrapeSource",
      meta: {
        sources: keys.length,
        keys,
        stagedProducts: staged.count,
        catalogProducts,
        sheetRows,
        tier: parsed.tier ?? null,
      },
    });
    revalidatePath(STUDIO_PATH);
    return {
      sources: keys.length,
      stagedProducts: staged.count,
      catalogProducts,
      sheetRows,
    };
  });
}

export async function deleteScrapeSources(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = idsSchema.parse(ids);

    const res = await db.scrapeSource.deleteMany({
      where: { id: { in: parsed } },
    });

    await logActivity({
      userId: session.user.id,
      action: parsed.length > 1 ? "bulk-delete" : "delete",
      entity: "ScrapeSource",
      meta: { count: res.count, ids: parsed },
    });
    revalidatePath(STUDIO_PATH);
    return { deleted: res.count };
  });
}
