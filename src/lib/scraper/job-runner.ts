/**
 * The scrape job runner — everything that ADVANCES a job, with no session.
 *
 * This used to live inside `src/actions/scraper-jobs.ts`, which carries
 * `"use server"`. That matters more than tidiness: **every export of a
 * `"use server"` module is a callable server action**, reachable by anything
 * that can POST to the app. `continueScrapeJob` is safe there because it calls
 * `requireStaff()` first; a session-free `advanceScrapeJob` exported from the
 * same file would be an unauthenticated "crawl this site for me" endpoint. So
 * the runner lives here, in a plain module that only the action and the cron
 * route import, and each of those does its own authorization.
 *
 * The split exists because a scrape used to advance ONLY while an operator's
 * browser tab was open on the scraper page — `continueScrapeJob` had exactly
 * one caller, the `use-scrape-runner.ts` polling hook. Closing the laptop
 * stopped the crawl mid-source. `/api/cron/scrape-drain` now drives the same
 * function on a schedule.
 *
 * Concurrency was already handled and is worth not re-deriving: the per-page
 * write is a compare-and-swap on `cursorPage`, so two workers on one job
 * cannot both fold the same page's counts in — the loser reads the real state
 * and returns it. The drain's idle-heartbeat rule (see the route) is about
 * POLITENESS, not correctness: fetching a supplier's pages twice over is what
 * `requestDelayMs` and the robots gate exist to avoid.
 */

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { AnalyticsLeague, ScrapeJobStatus } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  BENCHMARK_LEAGUE,
  isBenchmarkLeague,
  referenceReasonForLeague,
} from "@/lib/scraper/leagues";
import {
  describeBreakerSkip,
  describeTrip,
  nextFailureCount,
  shouldTrip,
} from "@/lib/scraper/breaker";
import { describeUnauthorizedRun } from "@/lib/scraper/policy";
import { priceMoved } from "@/lib/scraper/price-history";
import {
  describeFieldFailures,
  resolvedFields,
} from "@/lib/scraper/validation";
import { getAdapter } from "@/lib/scraper/adapters";
import { jsonldAdapter } from "@/lib/scraper/adapters/jsonld";
import {
  canonicalizeUrl,
  normalizeColour,
  normalizeMaterial,
  normalizeUnit,
} from "@/lib/scraper/normalize";
import { isPathAllowed } from "@/lib/scraper/robots";
import { normalizeBaseUrl, normalizePageUrl } from "@/lib/scraper/fingerprint";
import { contentHash } from "@/lib/scraper/hash";
import {
  derivePriceBasis,
  priceForBasis,
  toMinorUnits,
} from "@/lib/scraper/price-basis";
import {
  MAX_PAGES_PER_JOB,
  PAGES_PER_INVOCATION,
  type RichProduct,
} from "@/lib/scraper/types";

const STUDIO_PATH = "/studio/scraper";

export const CUSTOM_ADAPTER_MESSAGE =
  "Could not detect a supported platform (Shopify, WooCommerce or JSON-LD product markup). This site needs a custom adapter before it can be scraped.";

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

export function toSnapshot(job: {
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

/**
 * Free-text cleanup, applied once at staging — BEFORE `contentHash` is
 * computed from the result, though `contentHash` reads none of the fields
 * touched here (title/price/status/images only; see normalize.ts's header
 * for why that means no NORMALIZER_VERSION bump is needed for this change).
 * `materials`/`dimensions` fall back to the raw value when normalization
 * yields nothing (an empty string stays an empty string, not a lost field).
 */
function normalizeStagedProduct(p: RichProduct): RichProduct {
  let fields = p.fields;
  for (const key of Object.keys(p.fields)) {
    if (/^colou?r$/i.test(key) && typeof p.fields[key] === "string") {
      const normalized = normalizeColour(p.fields[key] as string);
      if (normalized) fields = { ...fields, [key]: normalized };
    }
  }
  return {
    ...p,
    url: canonicalizeUrl(p.url),
    materials: p.materials
      ? (normalizeMaterial(p.materials) ?? p.materials)
      : p.materials,
    dimensions: p.dimensions
      ? (normalizeUnit(p.dimensions) ?? p.dimensions)
      : p.dimensions,
    fields,
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
    const firstSeen = unique.filter(
      (p) => !existingByExternalId.has(p.externalId),
    );
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

/**
 * Keep `ResearchProduct` identity current and append a `ProductSnapshot` for
 * anything that is new or has changed (workstream B, phase 6a).
 *
 * Runs alongside the `ScrapedProduct` upsert rather than replacing it: the
 * promote path, the review grid and the quality queue all still read the
 * staged row, and this phase changes none of them. What it adds is the thing
 * an upsert destroys — the previous version.
 *
 * Every product on the page gets its `lastSeen` touched, because "we looked
 * and it was still listed" is a fact worth keeping and is exactly what saves
 * a snapshot from having to be written to record it.
 */
async function recordResearchSnapshots(
  jobId: string,
  sourceKey: string,
  products: RichProduct[],
  ctx: {
    createdExternalIds: Set<string>;
    changedExternalIds: Set<string>;
    hashByExternalId: Map<string, string>;
    /** Pre-normalization, straight off the adapter. What a snapshot stores. */
    rawByExternalId: Map<string, RichProduct>;
    seenAt: Date;
  },
  league: AnalyticsLeague = BENCHMARK_LEAGUE,
): Promise<void> {
  if (products.length === 0) return;

  // Upsert identity for every product seen, changed or not. `canonicalUrl` is
  // refreshed on purpose — a store that re-slugs a product has not given us a
  // different product, and the unique key is (sourceKey, externalId).
  await db.$transaction(
    products.map((product) =>
      db.researchProduct.upsert({
        where: {
          sourceKey_externalId: { sourceKey, externalId: product.externalId },
        },
        create: {
          sourceKey,
          externalId: product.externalId,
          canonicalUrl: product.url,
          firstSeen: ctx.seenAt,
          lastSeen: ctx.seenAt,
        },
        update: { canonicalUrl: product.url, lastSeen: ctx.seenAt },
      }),
    ),
  );

  // Only new or changed rows get a snapshot. An unchanged row would write a
  // byte-identical duplicate of the newest one, which is the "millions of
  // rows a month" trade `PriceHistory` already refused.
  const worth = products.filter(
    (p) =>
      ctx.createdExternalIds.has(p.externalId) ||
      ctx.changedExternalIds.has(p.externalId),
  );
  if (worth.length === 0) return;

  const identities = await db.researchProduct.findMany({
    where: { sourceKey, externalId: { in: worth.map((p) => p.externalId) } },
    select: { id: true, externalId: true },
  });
  const idByExternalId = new Map(identities.map((r) => [r.externalId, r.id]));

  // One create per snapshot rather than a createMany, because each snapshot's
  // variants hang off its id. Nested writes keep that in a single statement
  // per product instead of a second round trip.
  await db.$transaction(
    worth.flatMap((product) => {
      const researchProductId = idByExternalId.get(product.externalId);
      const hash = ctx.hashByExternalId.get(product.externalId);
      if (!researchProductId || !hash) return [];
      return [
        db.productSnapshot.create({
          data: {
            researchProductId,
            jobId,
            capturedAt: ctx.seenAt,
            contentHash: hash,
            /* The PRE-normalization product, straight off the adapter.
               B2 shipped this taking the normalized row by mistake, which
               quietly defeated the point: a snapshot is meant to be what the
               SOURCE said, and compute-time normalization (B4) can only
               re-apply a corrected mapping if the raw value survived. Falls
               back to the normalized row only if the raw one is somehow
               missing, which cannot happen on this path but beats writing
               nothing. */
            rawPayload: (ctx.rawByExternalId.get(product.externalId) ??
              product) as unknown as Prisma.InputJsonValue,
            variants: { create: variantRowsFor(product, league) },
          },
          select: { id: true },
        }),
      ];
    }),
  );
}

/**
 * A snapshot's variant rows, with each one's price basis decided (phase 6b).
 *
 * An adapter that surfaced no variants still yields ONE row, built from the
 * product's own price. That is not padding: a product with a single implicit
 * option is the common case, and a bespoke piece with no price at all is the
 * case this whole table exists to stop becoming a zero.
 *
 * The basis is read from the product's TEXT as well as its price, so
 * "price on request" beside a placeholder number is honoured. Every row runs
 * through `priceForBasis`, which is what guarantees a QUOTE_ONLY row carries
 * NULL and never 0.
 *
 * Every row is also stamped with the source's LEAGUE standing (B6): variants
 * from a MATERIALS_DIY or MARKETPLACE_B2B source are `isReference` with a
 * `referenceReason` of `league:<LEAGUE>`, so a per-kilo pigment price or an
 * MOQ starting point is kept as context but can never enter a finished-art
 * benchmark. The stamp is write-time provenance; the current classification
 * is enforced again at query time (`variantWhereForLeague`), because an
 * owner re-leaguing a source expects the change to bite immediately and
 * dated snapshots are not rewritten (D24).
 */
function variantRowsFor(
  product: RichProduct,
  league: AnalyticsLeague = BENCHMARK_LEAGUE,
): Prisma.ProductVariantCreateWithoutSnapshotInput[] {
  const text = [product.title, product.shortTagline, product.description]
    .filter(Boolean)
    .join(" \n ");

  const reference = !isBenchmarkLeague(league);
  const referenceReason = referenceReasonForLeague(league);

  const source =
    product.variants && product.variants.length > 0
      ? product.variants
      : [{ priceMajor: product.priceMin ?? null }];

  return source.map((variant) => {
    const priceMinor = toMinorUnits(variant.priceMajor);
    const basis = derivePriceBasis({ priceMinor, text });
    return {
      label: variant.label ?? null,
      optionsJson: (variant.options ?? {}) as Prisma.InputJsonValue,
      priceMinor: priceForBasis(basis, priceMinor),
      currency: product.currency,
      priceBasis: basis,
      available:
        variant.available ??
        (product.status ? product.status === "active" : null),
      isReference: reference,
      referenceReason,
    };
  });
}

async function upsertPage(
  jobId: string,
  sourceKey: string,
  products: RichProduct[],
  league: AnalyticsLeague = BENCHMARK_LEAGUE,
): Promise<{ created: number; updated: number }> {
  if (products.length === 0) return { created: 0, updated: 0 };

  // Dedupe within the page — some feeds repeat a product across sections.
  const byExternalId = new Map<string, RichProduct>();
  for (const p of products) {
    if (!byExternalId.has(p.externalId)) byExternalId.set(p.externalId, p);
  }
  // Normalized BEFORE contentHash is computed from these rows below.
  // Kept side by side on purpose. `unique` is what the staged row and the
  // content hash are built from; `rawByExternalId` is what the SOURCE actually
  // said, which is what a snapshot has to store — see recordResearchSnapshots.
  const rawByExternalId = new Map(byExternalId);
  const unique = [...byExternalId.values()].map(normalizeStagedProduct);

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

  // ——— Research identity + snapshots (workstream B, phase 6a) ———
  //
  // A DUAL WRITE, deliberately: `ScrapedProduct` above stays the promote
  // path's input and is unchanged by this. What it cannot do is remember —
  // it is upserted on (sourceKey, externalId), so a re-scrape overwrites the
  // previous title, price and description. `ResearchProduct` is the identity
  // that survives that, and `ProductSnapshot` is the history hanging off it.
  //
  // Snapshots are written on FIRST SIGHTING and thereafter only when the
  // contentHash moves — the same rule, for the same reason, as the price
  // history immediately below. Unchanged rows still bump `lastSeen`, which is
  // what records that we looked and found it listed.
  await recordResearchSnapshots(jobId, sourceKey, unique, {
    createdExternalIds: new Set(creates.map((c) => c.externalId)),
    changedExternalIds: new Set(changed.map((c) => c.product.externalId)),
    hashByExternalId: new Map(
      unique.map((p) => [p.externalId, contentHash(p)]),
    ),
    rawByExternalId,
    seenAt: now,
  }, league);

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

/**
 * `upsertPage` under test. The dual-write's whole contract is which rows land
 * in two tables across successive scrapes, which no pure test can see —
 * `job-runner.db.test.ts` drives this directly under `npm run test:db`.
 * Exported for that and nothing else; the runner calls `upsertPage`.
 */
export const upsertPageForTest = upsertPage;

/**
 * Advance one job by up to `PAGES_PER_INVOCATION` pages.
 *
 * Terminal jobs are returned untouched, so calling this repeatedly — the
 * client runner's poll loop, the operator's Resume button, the cron drain —
 * is idempotent. `actorUserId` is stamped on the activity entry: a staff id
 * when a person drove it, `null` when the cron did.
 */
export async function advanceScrapeJob(
  id: string,
  actorUserId: string | null,
): Promise<ScrapeJobSnapshot> {
  const job = await db.scrapeJob.findUnique({
    where: { id },
    include: {
      // `tier` used to be selected here for the legacy push's tier tab; D23
      // removed the only reader, so the job no longer loads it.
      source: {
        select: {
          baseUrl: true,
          requestDelayMs: true,
          // The governance gate is re-checked on every advance, not just at
          // enqueue — see below.
          name: true,
          collectionMode: true,
          policyReviewStatus: true,
          policyReviewNote: true,
          // The source's league is threaded to the write path, which stamps
          // non-benchmark leagues' variants isReference — see variantRowsFor.
          analyticsLeague: true,
        },
      },
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

  // THE GOVERNANCE GATE, re-checked here rather than trusted from enqueue.
  // A job can sit QUEUED for a long time and is advanced by the cron drain as
  // well as by an operator's tab, so "it was allowed when it was created" is
  // not the same statement as "it is allowed now". An owner who blocks a
  // source, or switches it to manual research, expects the crawl to stop —
  // including the one already in flight.
  //
  // A missing source row (sourceId is SetNull, so a source can be deleted out
  // from under its jobs) refuses too: an unregistered source cannot have been
  // reviewed.
  const policyError = job.source
    ? describeUnauthorizedRun(job.source.name, job.source)
    : `${job.sourceName} is no longer in the source registry, so there is no policy review to run under.`;
  if (policyError) {
    const stopped = await db.scrapeJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: policyError, finishedAt: new Date() },
    });
    return toSnapshot(stopped);
  }

  if (job.status === "QUEUED") {
    await db.scrapeJob.update({
      where: { id: job.id },
      data: { status: "RUNNING" },
    });
  }

  // URL scope always goes through the JSON-LD path, one product page,
  // regardless of the source's detected platform — a Shopify/WooCommerce
  // API has no concept of "just this one URL" the way a JSON-LD fetch does.
  const adapter =
    job.scope === "URL" ? jsonldAdapter : getAdapter(job.platform);

  let cursorPage = job.cursorPage;
  let totalScraped = job.totalScraped;
  let newCount = job.newCount;
  let updatedCount = job.updatedCount;
  let status: ScrapeJobStatus = "RUNNING";
  let error: string | null = null;

  try {
    // SOURCE crawls the registered source's site; CATEGORY/URL crawl the
    // specific page `createScrapeJob` stored in `inputUrl` for this job —
    // `job.source.baseUrl` would be the wrong target for those. The
    // adapters read the listing / product page from `baseUrl`, so a scoped
    // job keeps its PATH (`normalizePageUrl`); only the robots gate below
    // wants the origin. Running the scoped URL through `normalizeBaseUrl`
    // here used to hand the adapters the bare origin, which turned every
    // category and single-URL job into a whole-source crawl.
    const siteOrigin = normalizeBaseUrl(
      job.scope === "SOURCE"
        ? (job.source?.baseUrl ?? job.inputUrl)
        : job.inputUrl,
    );
    const baseUrl =
      job.scope === "SOURCE" ? siteOrigin : normalizePageUrl(job.inputUrl);

    // Politeness: honour robots.txt once, before the first page is fetched.
    // Gate on the site root — the universal "may we crawl you at all" signal.
    // A platform-specific path (e.g. /products.json) would false-fail sites
    // that disallow only that path, even though we can read their JSON-LD
    // product pages instead.
    if (cursorPage === 0 && !(await isPathAllowed(siteOrigin, "/"))) {
      let host = siteOrigin;
      try {
        host = new URL(siteOrigin).host;
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
        scope: job.scope,
      });

      const counts = await upsertPage(
        job.id,
        job.sourceKey,
        products,
        // Null only when the source row was deleted mid-flight, which the
        // governance gate above already refused on — the default never
        // actually fires on this path.
        job.source?.analyticsLeague ?? BENCHMARK_LEAGUE,
      );

      // Optimistic per-page advance: the `where` only matches while
      // cursorPage is still what THIS invocation last saw. Two workers
      // resuming the same job at once — two tabs both pressing Resume, or
      // a stale-reclaimed job that turns out not to be dead after all —
      // would otherwise both fold the same page's counts in. The write is
      // also the heartbeat (`updatedAt`) STALE_RUNNING_MS reads.
      const advanced = await db.scrapeJob.updateMany({
        where: { id: job.id, cursorPage },
        data: {
          cursorPage: page,
          totalScraped: totalScraped + products.length,
          newCount: newCount + counts.created,
          updatedCount: updatedCount + counts.updated,
        },
      });
      if (advanced.count === 0) {
        // Lost the race — another invocation already advanced this job
        // past the page just fetched. Report its real state instead of
        // fighting over whose numbers land.
        const current = await db.scrapeJob.findUniqueOrThrow({
          where: { id: job.id },
        });
        return toSnapshot(current);
      }

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

  if (finished) {
    // Looked up by sourceKey, not job.sourceId: the FK is nullable
    // (onDelete: SetNull) and goes null the moment a source row is
    // deleted, while sourceKey is a plain string that survives that — and
    // a source re-registered under the same key keeps its failure history
    // instead of restarting silently disconnected from it (breaker.ts).
    const source = await db.scrapeSource.findUnique({
      where: { key: job.sourceKey },
      select: { id: true, name: true, consecutiveFailures: true },
    });

    // Breaker bookkeeping: count consecutive failures, reset on success,
    // and pause the source once it trips. No source row under this key
    // means there is nothing left to trip or reset — log and move on.
    if (source) {
      const failures = nextFailureCount(
        source.consecutiveFailures,
        status === "DONE" ? "DONE" : "FAILED",
      );
      const trip = shouldTrip(failures);
      await db.scrapeSource.update({
        where: { id: source.id },
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
    } else {
      console.warn(describeBreakerSkip(job.sourceKey));
    }
    // A finished job used to push itself to the owner's Google Sheet here,
    // gated by the source's ON_COMPLETE/MANUAL/OFF policy. Google Sheets is
    // removed (plan C); the confirmed list is exported from /studio/exports
    // as CSV or XLSX instead, on demand rather than on every scrape.
  }

  if (finished) {
    await logActivity({
      userId: actorUserId,
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
}
