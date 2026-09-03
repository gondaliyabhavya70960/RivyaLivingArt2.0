"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import type { Prisma } from "@/generated/prisma/client";
import {
  Role,
  type ScrapeJobStatus,
  type ScrapePlatform,
  type ScrapeTier,
} from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  IN_FLIGHT_STATUSES,
  partitionByInFlight,
} from "@/lib/scraper/run-scope";
import {
  describeBlockedRun,
  describeTrip,
  nextFailureCount,
  shouldTrip,
} from "@/lib/scraper/breaker";
import { priceMoved } from "@/lib/scraper/price-history";
import {
  describeFieldFailures,
  resolvedFields,
} from "@/lib/scraper/validation";
import { shouldPushOnComplete } from "@/lib/scraper/sheet-policy";
import { pushJobToSheet } from "@/lib/scraper/sheet-push";
import { getAdapter } from "@/lib/scraper/adapters";
import { isPathAllowed } from "@/lib/scraper/robots";
import {
  fingerprint,
  isBlockedMarketplace,
  normalizeBaseUrl,
} from "@/lib/scraper/fingerprint";
import { contentHash } from "@/lib/scraper/hash";
import {
  MAX_PAGES_PER_JOB,
  PAGES_PER_INVOCATION,
  type RichProduct,
} from "@/lib/scraper/types";
import { slugify } from "@/lib/slug";

const STUDIO_PATH = "/studio/scraper";

const CUSTOM_ADAPTER_MESSAGE =
  "Could not detect a supported platform (Shopify, WooCommerce or JSON-LD product markup). This site needs a custom adapter before it can be scraped.";
const MARKETPLACE_MESSAGE =
  "Marketplaces (Amazon, Etsy, Flipkart, Meesho, IndiaMART…) are never scraped — use their official APIs instead.";

/** Lightweight job state returned to the client runner for polling. */
export type ScrapeJobSnapshot = {
  id: string;
  status: ScrapeJobStatus;
  cursorPage: number;
  totalScraped: number;
  newCount: number;
  updatedCount: number;
  error: string | null;
};

function toSnapshot(job: {
  id: string;
  status: ScrapeJobStatus;
  cursorPage: number;
  totalScraped: number;
  newCount: number;
  updatedCount: number;
  error: string | null;
}): ScrapeJobSnapshot {
  return {
    id: job.id,
    status: job.status,
    cursorPage: job.cursorPage,
    totalScraped: job.totalScraped,
    newCount: job.newCount,
    updatedCount: job.updatedCount,
    error: job.error,
  };
}

/** RichProduct → ScrapedProduct columns. Json columns take arrays/objects directly. */
function mapProductFields(p: RichProduct) {
  return {
    sourceKey: p.sourceKey,
    externalId: p.externalId,
    url: p.url,
    vertical: p.vertical,
    currency: p.currency,
    title: p.title,
    slug: p.slug,
    category: p.category ?? null,
    shortTagline: p.shortTagline ?? null,
    description: p.description ?? null,
    priceMin: p.priceMin == null ? null : Math.round(p.priceMin),
    priceMax: p.priceMax == null ? null : Math.round(p.priceMax),
    showPrice: p.showPrice ?? null,
    timeline: p.timeline ?? null,
    materials: p.materials ?? null,
    dimensions: p.dimensions ?? null,
    status: p.status ?? null,
    featured: p.featured ?? null,
    images: p.images,
    imageAlts: p.imageAlts,
    fields: p.fields as Prisma.InputJsonValue,
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
  };
}

/**
 * Merge one adapter page into the staging table, keyed on
 * `@@unique([sourceKey, externalId])`:
 *  - new row            → create (linked to this job)
 *  - contentHash changed → update all mapped fields + hash + lastSeen
 *  - unchanged           → touch lastSeen only
 */
/**
 * Record what this page could not extract, and close what it fixed.
 *
 * Upserted on (staged product, field), so a source that has been broken for a
 * month shows one row per broken field — not one per scrape. The backlog then
 * measures how many things are wrong rather than how often we looked.
 *
 * A field that now extracts cleanly is RESOLVED automatically. That is not
 * auto-triage closing a judgement call: the condition that raised the failure
 * has demonstrably stopped holding, and leaving it open would make the screen
 * a list of things that used to be wrong. Rows an operator IGNORED stay
 * ignored — reopening those would undo a human decision.
 *
 * Never throws: a scrape that stored its products has succeeded.
 */
async function recordValidationFailures(
  jobId: string,
  sourceKey: string,
  rows: { id: string; product: RichProduct }[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const failures: Prisma.ValidationFailureCreateManyInput[] = [];
    const cleared: { id: string; fields: string[] }[] = [];

    for (const { id, product } of rows) {
      const fields = mapProductFields(product);
      const extracted = {
        title: fields.title,
        description: fields.description,
        priceMin: fields.priceMin,
        priceMax: fields.priceMax,
        images: fields.images,
        category: fields.category,
      };
      for (const f of describeFieldFailures(extracted)) {
        failures.push({
          scrapedProductId: id,
          sourceKey,
          jobId,
          field: f.field,
          reason: f.reason,
          severity: f.severity,
        });
      }
      const ok = resolvedFields(extracted);
      if (ok.length > 0) cleared.push({ id, fields: ok });
    }

    // New failures. skipDuplicates leaves an existing row — including its
    // status — alone, so an operator's REVIEWING or IGNORED is not reset by
    // the next scrape finding the same thing still broken.
    if (failures.length > 0) {
      await db.validationFailure.createMany({
        data: failures,
        skipDuplicates: true,
      });
    }

    // Fields that now extract cleanly. IGNORED rows are left as they are.
    for (const c of cleared) {
      await db.validationFailure.updateMany({
        where: {
          scrapedProductId: c.id,
          field: { in: c.fields },
          status: { in: ["OPEN", "REVIEWING"] },
        },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }
  } catch (error) {
    console.error("validation capture failed (continuing):", error);
  }
}

/**
 * Append price points for a page of scraped products.
 *
 * Never throws: a scrape that fetched and stored its products has succeeded,
 * and losing the run over a bookkeeping insert would be the wrong trade. The
 * next scrape that sees a moved price records one anyway.
 */
async function recordPriceMoves(
  sourceKey: string,
  unique: RichProduct[],
  existingByExternalId: Map<
    string,
    { id: string; priceMin: number | null; priceMax: number | null }
  >,
  changed: { id: string; product: RichProduct }[],
): Promise<void> {
  try {
    const points: Prisma.PriceHistoryCreateManyInput[] = [];

    // First sighting: anchor the series so a later move has something to move
    // FROM. These rows were just created, so their ids are not in hand — the
    // point is keyed by source and external id via a lookup below.
    const firstSeen = unique.filter((p) => !existingByExternalId.has(p.externalId));
    if (firstSeen.length > 0) {
      const rows = await db.scrapedProduct.findMany({
        where: {
          sourceKey,
          externalId: { in: firstSeen.map((p) => p.externalId) },
        },
        select: { id: true, externalId: true, priceMin: true, priceMax: true },
      });
      for (const row of rows) {
        points.push({
          scrapedProductId: row.id,
          sourceKey,
          priceMin: row.priceMin,
          priceMax: row.priceMax,
        });
      }
    }

    for (const c of changed) {
      const before = existingByExternalId.get(c.product.externalId);
      if (!before) continue;
      const fields = mapProductFields(c.product);
      const after = {
        priceMin: fields.priceMin ?? null,
        priceMax: fields.priceMax ?? null,
      };
      if (!priceMoved(before, after)) continue;
      points.push({
        scrapedProductId: c.id,
        sourceKey,
        priceMin: after.priceMin,
        priceMax: after.priceMax,
      });
    }

    if (points.length > 0) {
      await db.priceHistory.createMany({ data: points });
    }
  } catch (error) {
    console.error("price history capture failed (continuing):", error);
  }
}

async function upsertPage(
  jobId: string,
  sourceKey: string,
  products: RichProduct[],
): Promise<{ created: number; updated: number }> {
  if (products.length === 0) return { created: 0, updated: 0 };

  // Dedupe within the page — some feeds repeat a product across sections.
  const byExternalId = new Map<string, RichProduct>();
  for (const p of products) {
    if (!byExternalId.has(p.externalId)) byExternalId.set(p.externalId, p);
  }
  const unique = [...byExternalId.values()];

  const existing = await db.scrapedProduct.findMany({
    where: { sourceKey, externalId: { in: unique.map((p) => p.externalId) } },
    // priceMin/priceMax come along so a price move can be detected without a
    // second query — the row is about to be overwritten with the new values.
    select: {
      id: true,
      externalId: true,
      contentHash: true,
      priceMin: true,
      priceMax: true,
    },
  });
  const existingByExternalId = new Map(existing.map((e) => [e.externalId, e]));

  const now = new Date();
  const creates: Prisma.ScrapedProductCreateManyInput[] = [];
  const changed: { id: string; product: RichProduct; hash: string }[] = [];
  const unchangedIds: string[] = [];

  for (const product of unique) {
    const hash = contentHash(product);
    const row = existingByExternalId.get(product.externalId);
    if (!row) {
      // firstSeen/lastSeen fall back to their schema defaults.
      creates.push({ jobId, ...mapProductFields(product), contentHash: hash });
    } else if (row.contentHash !== hash) {
      changed.push({ id: row.id, product, hash });
    } else {
      unchangedIds.push(row.id);
    }
  }

  let created = 0;
  if (creates.length > 0) {
    const res = await db.scrapedProduct.createMany({
      data: creates,
      skipDuplicates: true,
    });
    created = res.count;
  }
  if (changed.length > 0) {
    await db.$transaction(
      changed.map((c) =>
        db.scrapedProduct.update({
          where: { id: c.id },
          data: {
            ...mapProductFields(c.product),
            contentHash: c.hash,
            lastSeen: now,
          },
        }),
      ),
    );
  }
  if (unchangedIds.length > 0) {
    await db.scrapedProduct.updateMany({
      where: { id: { in: unchangedIds } },
      data: { lastSeen: now },
    });
  }

  // Price history. A point is written on first sighting, to anchor the series,
  // and thereafter only when the price actually MOVES.
  //
  // Recording every scrape of every row instead would be millions of rows a
  // month here, nearly all identical to the one above — and it would say the
  // same thing: a gap between two points means the price held across it.
  //
  // Unchanged rows cannot have moved by definition (same contentHash), so they
  // are not consulted at all.
  await recordPriceMoves(sourceKey, unique, existingByExternalId, changed);

  // Data quality. Assessed for every row on the page, not just the changed
  // ones: a field that has been missing since the first scrape is still
  // missing, and an operator who resolves the backlog wants it to reflect the
  // catalogue as it stands.
  const allRows = await db.scrapedProduct.findMany({
    where: { sourceKey, externalId: { in: unique.map((p) => p.externalId) } },
    select: { id: true, externalId: true },
  });
  const idByExternalId = new Map(allRows.map((r) => [r.externalId, r.id]));
  await recordValidationFailures(
    jobId,
    sourceKey,
    unique.flatMap((product) => {
      const id = idByExternalId.get(product.externalId);
      return id ? [{ id, product }] : [];
    }),
  );

  return { created, updated: changed.length };
}

const createJobSchema = z
  .object({
    sourceId: z.string().min(1).optional(),
    inputUrl: z.string().trim().min(1).max(2048).optional(),
    tier: z.enum(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D"]).optional(),
  })
  .refine((v) => Boolean(v.sourceId) !== Boolean(v.inputUrl), {
    message: "Pass exactly one of sourceId or inputUrl.",
  });

export type CreateScrapeJobInput = z.input<typeof createJobSchema>;

/** Inner outcome — user-facing failures ride out of runAction as data. */
type CreateJobOutcome =
  | { jobId: string; alreadyRunning: boolean; userError?: never }
  | { jobId?: never; alreadyRunning?: never; userError: string };

/**
 * Queue a scrape job, either from a registered source (auto-fingerprinting
 * UNKNOWN platforms and persisting the result) or from a pasted URL — which
 * is blocklist-checked, fingerprinted and SAVED into the source registry
 * (upsert by slugified host, tier defaults to RESIN_GOODS).
 */
export async function createScrapeJob(
  input: CreateScrapeJobInput,
): Promise<ActionResult<{ jobId: string; alreadyRunning: boolean }>> {
  const result = await runAction<CreateJobOutcome>(async () => {
    const session = await requireStaff();
    const parsed = createJobSchema.parse(input);

    let source: {
      id: string;
      key: string;
      name: string;
      baseUrl: string;
      vertical: string;
      // Breaker state travels with the row — both branches below assign a
      // full ScrapeSource, so reading it here costs nothing extra.
      pausedAt: Date | null;
      pausedReason: string | null;
    };
    let platform: ScrapePlatform;

    if (parsed.sourceId) {
      const found = await db.scrapeSource.findUnique({
        where: { id: parsed.sourceId },
      });
      if (!found) {
        return { userError: "Source not found — refresh the registry and try again." };
      }
      platform = found.platform;
      if (platform === "UNKNOWN") {
        // Live-detect and persist so the registry heals itself.
        platform = await fingerprint(found.baseUrl);
        await db.scrapeSource.update({
          where: { id: found.id },
          data: {
            platform,
            ...(platform !== "UNKNOWN" ? { verifiedAt: new Date() } : {}),
          },
        });
        if (platform === "UNKNOWN") return { userError: CUSTOM_ADAPTER_MESSAGE };
      }
      source = found;
    } else {
      let baseUrl: string;
      try {
        baseUrl = normalizeBaseUrl(parsed.inputUrl ?? "");
      } catch {
        return { userError: "That doesn't look like a valid website URL." };
      }
      if (isBlockedMarketplace(baseUrl)) return { userError: MARKETPLACE_MESSAGE };

      platform = await fingerprint(baseUrl);
      if (platform === "UNKNOWN") return { userError: CUSTOM_ADAPTER_MESSAGE };

      const host = new URL(baseUrl).hostname.replace(/^www\./, "");
      const key = slugify(host) || "source";
      source = await db.scrapeSource.upsert({
        where: { key },
        create: {
          key,
          name: host,
          baseUrl,
          tier: parsed.tier ?? "RESIN_GOODS",
          platform,
          verifiedAt: new Date(),
        },
        update: { baseUrl, platform, verifiedAt: new Date() },
      });
    }

    // One run per source at a time. Two jobs against the same site double its
    // request rate for no extra coverage — they crawl the same pages — and the
    // second one's rows land on top of the first's mid-flight. A double click
    // on Scrape was enough to cause it, because nothing here looked.
    //
    // QUEUED counts as in-flight: it has not started, so starting another is
    // the same mistake a moment earlier.
    const inFlight = await db.scrapeJob.findFirst({
      where: { sourceId: source.id, status: { in: [...IN_FLIGHT_STATUSES] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    // Returning the job that is ALREADY running, rather than an error, is what
    // makes this action idempotent: pressing Scrape twice leaves one job and
    // lands the operator on it. An error here would be technically correct and
    // practically useless — they would still have to go and find it.
    if (inFlight) return { jobId: inFlight.id, alreadyRunning: true };

    // The circuit breaker. A source paused after repeated failures does not
    // get new jobs until an operator has looked at it — continuing to send
    // requests to a site that is down or blocking us is useless and is how a
    // soft block becomes a hard one.
    const blocked = describeBlockedRun(source.name, {
      pausedAt: source.pausedAt,
      pausedReason: source.pausedReason,
    });
    if (blocked) return { userError: blocked };

    const job = await db.scrapeJob.create({
      data: {
        sourceId: source.id,
        inputUrl: source.baseUrl,
        sourceKey: source.key,
        sourceName: source.name,
        platform,
        vertical: source.vertical,
        // status QUEUED / cursorPage 0 via schema defaults.
      },
      select: { id: true },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "ScrapeJob",
      entityId: job.id,
      meta: { sourceKey: source.key, platform },
    });
    revalidatePath(STUDIO_PATH);
    return { jobId: job.id, alreadyRunning: false };
  });

  if (!result.ok) return result;
  const outcome = result.data;
  if (!outcome || outcome.userError !== undefined) {
    return {
      ok: false,
      error: outcome?.userError ?? "Something went wrong. Please try again.",
    };
  }
  return {
    ok: true,
    data: { jobId: outcome.jobId, alreadyRunning: outcome.alreadyRunning },
  };
}

/**
 * Advance a job by up to PAGES_PER_INVOCATION pages (serverless budget).
 * The client runner calls this in a loop until the snapshot reports
 * DONE or FAILED. Terminal jobs are returned untouched, so polling and
 * "Resume" are idempotent.
 */
export async function continueScrapeJob(
  jobId: string,
): Promise<ActionResult<ScrapeJobSnapshot>> {
  return runAction(async () => {
    const session = await requireStaff();
    const id = z.string().min(1).parse(jobId);

    const job = await db.scrapeJob.findUnique({
      where: { id },
      include: {
        source: { select: { baseUrl: true, tier: true, requestDelayMs: true } },
      },
    });
    if (!job) throw new Error("Scrape job not found");

    if (job.status !== "QUEUED" && job.status !== "RUNNING") {
      return toSnapshot(job);
    }

    if (job.platform === "UNKNOWN") {
      const failed = await db.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: CUSTOM_ADAPTER_MESSAGE,
          finishedAt: new Date(),
        },
      });
      return toSnapshot(failed);
    }

    if (job.status === "QUEUED") {
      await db.scrapeJob.update({
        where: { id: job.id },
        data: { status: "RUNNING" },
      });
    }

    const adapter = getAdapter(job.platform);

    let cursorPage = job.cursorPage;
    let totalScraped = job.totalScraped;
    let newCount = job.newCount;
    let updatedCount = job.updatedCount;
    let status: ScrapeJobStatus = "RUNNING";
    let error: string | null = null;

    try {
      const baseUrl = normalizeBaseUrl(job.source?.baseUrl ?? job.inputUrl);

      // Politeness: honour robots.txt once, before the first page is fetched.
      // Gate on the site root — the universal "may we crawl you at all" signal.
      // A platform-specific path (e.g. /products.json) would false-fail sites
      // that disallow only that path, even though we can read their JSON-LD
      // product pages instead.
      if (cursorPage === 0 && !(await isPathAllowed(baseUrl, "/"))) {
        let host = baseUrl;
        try {
          host = new URL(baseUrl).host;
        } catch {
          // keep baseUrl as-is
        }
        throw new Error(
          `Blocked by ${host}/robots.txt — this site disallows automated crawling.`,
        );
      }

      for (let i = 0; i < PAGES_PER_INVOCATION; i++) {
        const page = cursorPage + 1;
        const { products, hasMore } = await adapter({
          baseUrl,
          sourceKey: job.sourceKey,
          vertical: job.vertical,
          page,
          // The per-source politeness knob (docs/scraper.md "Politeness");
          // a single pasted URL has no source row and gets the shared default.
          requestDelayMs: job.source?.requestDelayMs ?? null,
        });

        const counts = await upsertPage(job.id, job.sourceKey, products);
        newCount += counts.created;
        updatedCount += counts.updated;
        cursorPage = page;
        totalScraped += products.length;

        if (!hasMore) {
          status = "DONE";
          break;
        }
        if (page >= MAX_PAGES_PER_JOB) {
          status = "DONE";
          error = "page cap reached";
          break;
        }
      }
    } catch (err) {
      // Counts up to the failure point are kept.
      status = "FAILED";
      error = err instanceof Error ? err.message : "Scrape failed unexpectedly.";
    }

    const finished = status === "DONE" || status === "FAILED";
    const updatedJob = await db.scrapeJob.update({
      where: { id: job.id },
      data: {
        status,
        cursorPage,
        totalScraped,
        newCount,
        updatedCount,
        error,
        ...(finished ? { finishedAt: new Date() } : {}),
      },
    });

    // The whole of "automatic push to the sheet": one policy check at the one
    // point a job finishes. A source set to ON_COMPLETE syncs itself; MANUAL
    // (the default) stages and waits for the operator to say add; OFF never
    // touches the sheet. Same engine either way — see `pushJobToSheet`.
    //
    // Deliberately not awaited into the job's own success: `pushJobToSheet`
    // swallows its failures and marks the rows SYNC_PENDING, because a scrape
    // that worked must not be reported as failed by a third party's outage.
    if (finished && job.sourceId) {
      const source = await db.scrapeSource.findUnique({
        where: { id: job.sourceId },
        select: {
          sheetSyncPolicy: true,
          name: true,
          consecutiveFailures: true,
        },
      });

      // Breaker bookkeeping: count consecutive failures, reset on success,
      // and pause the source once it trips.
      if (source) {
        const failures = nextFailureCount(
          source.consecutiveFailures,
          status === "DONE" ? "DONE" : "FAILED",
        );
        const trip = shouldTrip(failures);
        await db.scrapeSource.update({
          where: { id: job.sourceId },
          data: {
            consecutiveFailures: failures,
            ...(trip
              ? {
                  pausedAt: new Date(),
                  pausedReason: describeTrip(source.name, failures),
                }
              : {}),
            // A success clears an old pause as well as the counter.
            ...(status === "DONE" ? { pausedAt: null, pausedReason: null } : {}),
          },
        });
      }
      // THE ONLY SHEET WRITE IN THIS FILE. A second, un-gated push used to
      // run below on every finished job that staged anything — including a
      // FAILED one — which made the MANUAL default, "a FAILED job never
      // auto-pushes" and the one-writer invariant in sheet-push.ts all false
      // in code (D23). It is gone; `sheet-policy.test.ts` asserts both the
      // policy truth table and that this file keeps exactly one writer.
      if (shouldPushOnComplete(status, source?.sheetSyncPolicy)) {
        const outcome = await pushJobToSheet(job.id);
        await logActivity({
          userId: session.user.id,
          action: "sheet-sync-auto",
          entity: "ScrapeJob",
          entityId: job.id,
          meta: { sourceKey: job.sourceKey, outcome: outcome.status },
        });
      }
    }

    if (finished) {
      await logActivity({
        userId: session.user.id,
        action: status === "DONE" ? "scrape-complete" : "scrape-failed",
        entity: "ScrapeJob",
        entityId: job.id,
        meta: {
          sourceKey: job.sourceKey,
          pages: cursorPage,
          totalScraped,
          newCount,
          updatedCount,
          ...(error ? { error } : {}),
        },
      });
      revalidatePath(STUDIO_PATH);
    }

    return toSnapshot(updatedJob);
  });
}

const TIER_RANK: Record<ScrapeTier, number> = {
  OWNER: 0,
  RESIN_GOODS: 1,
  SUPPLIES: 2,
  PRINT3D: 3,
};

/**
 * Queue jobs for every enabled, platform-detected source in a tier (or all
 * tiers, in OWNER → RESIN_GOODS → SUPPLIES → PRINT3D order, then by name).
 * The client runs the returned ids sequentially.
 */
export async function createTierJobs(
  tier: ScrapeTier | "ALL",
): Promise<ActionResult<{ jobIds: string[]; skipped: string[] }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = z
      .enum(["OWNER", "RESIN_GOODS", "SUPPLIES", "PRINT3D", "ALL"])
      .parse(tier);

    const sources = await db.scrapeSource.findMany({
      where: {
        enabled: true,
        platform: { not: "UNKNOWN" },
        ...(parsed === "ALL" ? {} : { tier: parsed }),
      },
      orderBy: { name: "asc" },
    });
    sources.sort(
      (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.name.localeCompare(b.name),
    );

    if (sources.length === 0) return { jobIds: [], skipped: [] };

    // The same one-run-per-source rule as createScrapeJob. Without it the batch
    // is the faster way to cause exactly the duplicate that guard prevents:
    // press a tier button twice and every source gets a second crawl.
    const busy = await db.scrapeJob.findMany({
      where: {
        sourceId: { in: sources.map((s) => s.id) },
        status: { in: [...IN_FLIGHT_STATUSES] },
      },
      select: { sourceId: true },
    });
    const { queueable, skipped } = partitionByInFlight(
      sources,
      busy.map((j) => j.sourceId),
    );

    if (queueable.length === 0) return { jobIds: [], skipped };

    const jobs = await db.$transaction(
      queueable.map((source) =>
        db.scrapeJob.create({
          data: {
            sourceId: source.id,
            inputUrl: source.baseUrl,
            sourceKey: source.key,
            sourceName: source.name,
            platform: source.platform,
            vertical: source.vertical,
          },
          select: { id: true },
        }),
      ),
    );

    await logActivity({
      userId: session.user.id,
      action: "batch-create",
      entity: "ScrapeJob",
      meta: { tier: parsed, count: jobs.length, skipped: skipped.length },
    });
    revalidatePath(STUDIO_PATH);
    return { jobIds: jobs.map((j) => j.id), skipped };
  });
}

/** Snapshot fetch for polling — read-only, no side effects. */
export async function getScrapeJobs(
  ids: string[],
): Promise<ActionResult<ScrapeJobSnapshot[]>> {
  return runAction(async () => {
    await requireStaff();
    const parsed = z.array(z.string().min(1)).parse(ids);
    if (parsed.length === 0) return [];
    const jobs = await db.scrapeJob.findMany({
      where: { id: { in: parsed } },
    });
    return jobs.map(toSnapshot);
  });
}

/** Bulk delete jobs — their staging rows cascade with them. */
export async function deleteScrapeJobs(ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    // Deleting scrape jobs (and their staged competitor rows) is ADMIN-only (SEC-109).
    const session = await requireStaff([Role.ADMIN]);
    const parsed = z.array(z.string().min(1)).min(1).parse(ids);

    await db.scrapeJob.deleteMany({ where: { id: { in: parsed } } });

    await logActivity({
      userId: session.user.id,
      action: parsed.length > 1 ? "bulk-delete" : "delete",
      entity: "ScrapeJob",
      meta: { count: parsed.length, ids: parsed },
    });
    revalidatePath(STUDIO_PATH);
    return undefined;
  });
}
