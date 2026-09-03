import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { parseCsv } from "@/lib/import/parse";
import { slugify } from "@/lib/slug";
import { DEFAULT_CARE_NOTES } from "@/lib/scraper/product-sheet";
import {
  CANONICAL_CATEGORIES,
  canonicalCategoryFor,
} from "@/lib/catalog-taxonomy";
import { decideFillWrite, type FillPolicy } from "@/lib/import/fill-policy";

/**
 * The four-tier owner-sheet import (owner brief, 2026-08-13) — extracted
 * from `prisma/import-tiers.ts` so the deploy-time script, the studio's
 * Preview button, and its Run now button all call ONE function instead of
 * the script's logic being duplicated (and drifting) across three places.
 * `prisma/import-tiers.ts` is now a thin caller: read settings, build a
 * `FillPolicy`, call `runTierFill({ trigger: "DEPLOY", policy, db })`.
 *
 * Reads the tier tabs of the owner's scraped-products sheet from
 * data/tiers/<Tab>.csv.gz (full export committed by the fetch-tiers Actions
 * workflow) or, until the sheet is link-public, the partial
 * data/tiers/sample/<Tab>.sample.csv extracts. Volumes per the brief:
 * Tier1_Owner ALL rows · Tier2_ResinGoods top 1,000 · Tier3_Supplies
 * top 2,500 · Tier4_3DPrint top 500. "Top" = the sheet's own row order (the
 * tabs carry no ranking column, and the owner's master prompt directs sheet
 * order in that case); rows falling out of the selection demote to DRAFT.
 * The content-quality score below only picks FEATURED merchandising.
 *
 * Idempotent: rows upsert on the (importSource, importRef) unique pair;
 * unchanged rows (same contentHash → sourceHash) are skipped entirely, so a
 * full 4,000-row pass on an already-imported database costs one indexed
 * SELECT. Rows are PUBLISHED with needsRewrite=false on the owner's explicit
 * instruction to put the sheet catalog live (the studio scraper's rewrite
 * gate stays in force for studio-scraped rows). Never touches products the
 * owner created by hand (importSource null or ≠ sheet:*).
 *
 * `dryRun` runs every read and every decision exactly as a real run would,
 * and skips every WRITE (category creation, the care-notes cleanup pass,
 * per-row create/update, the demote reconciliation, SheetConflict rows, and
 * the ImportRun/ActivityLog record) — so `previewSheetFill()` can show
 * accurate creates/updates/drops without touching the catalog.
 */

const ROOT = path.join(__dirname, "../../..");

/** Bump when cleanText/normalization changes so existing rows re-import.
 *  n4: stop stamping resin DEFAULT_CARE_NOTES on imports (audit M-A2) —
 *  careNotes is now null so the SiteSettings default-care-notes fallback
 *  applies; the bump forces every existing row to re-normalize clean.
 *  n5: trim trailing comma/space artifacts off scraped titles (audit M-S4,
 *  "Kanku – Chawal,") and flag scraped copy that carries source-store
 *  branding, URLs or emoji as needsRewrite (audit L-S3) — the PDP falls
 *  back to tagline + specs for flagged rows until the owner rewrites.
 *  n6: the brand/URL/emoji screen also gates the sheet's own
 *  seoDescription column (a few rows had clean copy but a branded seo
 *  field, invisible to the description-only flag).
 *  n7: the screen matches each row's OWN source-store name derived from
 *  its sourceKey (plus bohriali/baltic-day/banteybanatey statically) —
 *  store self-references the fixed brand list missed.
 *  n8: a flagged row without a clean alternative gets seoDescription NULL
 *  instead of a slice of its branded description — the meta layer holds
 *  the same line as the visible sheet. */
const NORMALIZER_VERSION = "n8";

/**
 * Scraped descriptions that must not read verbatim on a Rivya Living Art PDP
 * (audit L-S3): source-store self-branding, live URLs, or emoji-studded
 * listing copy. Deliberately conservative — ~250 of 4,373 current rows
 * match — and deterministic, so the flag reaches production through the
 * normal deploy import (no one-off DB scripts). Flagged rows keep their
 * data; the PDP simply renders tagline + specs instead of the raw text.
 */
const REWRITE_BRANDS =
  /kanha\s*kreation|atomic\s*filament|coex\s*3d|coex3d|apex\s*resin|resinpro|bohriali|baltic\s*day|banteybanatey/i;
const REWRITE_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
function needsRewriteFor(
  description: string,
  vendor: string | null,
  sourceKey?: string,
): boolean {
  if (!description) return false;
  if (/https?:\/\//i.test(description)) return true;
  if (REWRITE_BRANDS.test(description)) return true;
  if (REWRITE_EMOJI.test(description)) return true;
  const d = description.toLowerCase();
  // Self-referencing store voice: the row's OWN source store named in its
  // copy — derived from the sourceKey so new sheet sources are screened
  // automatically ("baltic-day" → "baltic day" / "balticday").
  if (sourceKey && sourceKey.length > 3) {
    const spaced = sourceKey.replace(/-/g, " ").toLowerCase();
    const collapsed = sourceKey.replace(/-/g, "").toLowerCase();
    if (d.includes(spaced) || d.includes(collapsed)) return true;
  }
  return !!vendor && vendor.length > 3 && d.includes(vendor.toLowerCase());
}

export type TierSpec = {
  tab: string;
  tier: 1 | 2 | 3 | 4;
  cap: number | null;
};

const TIERS: TierSpec[] = [
  { tab: "Tier1_Owner", tier: 1, cap: null },
  { tab: "Tier2_ResinGoods", tier: 2, cap: 1000 },
  { tab: "Tier3_Supplies", tier: 3, cap: 2500 },
  { tab: "Tier4_3DPrint", tier: 4, cap: 500 },
];

/** How many best-scoring Tier-1 rows get featured=true for merchandising. */
const FEATURED_TIER1 = 12;

/** Sources whose stores price in foreign currency while the sheet's currency
 *  column falsely claims INR (audit H4: $100 gift cards rendering as ₹100).
 *  Their prices are hidden ("Enquire") rather than mis-displayed — honest
 *  over wrong; conversion would be invented data. */
const FOREIGN_CURRENCY_SOURCES = new Set([
  "atomic-filament",
  "coex3d",
  "apex-resin",
  "resinpro",
]);

/** Store artifacts that are not products of THIS store. */
const EXCLUDED_TITLE = /gift\s*card/i;

/** Fields SheetConflict tracks — see the module note on conflict detection. */
const CONFLICT_FIELDS = [
  "title",
  "priceMin",
  "priceMax",
  "materials",
  "dimensions",
  "description",
  "inStock",
] as const;

// ————————————————————— row reading —————————————————————

function readTab(tab: string): Record<string, string>[] | null {
  const full = path.join(ROOT, "data/tiers", `${tab}.csv.gz`);
  if (existsSync(full)) {
    return parseCsv(gunzipSync(readFileSync(full)).toString("utf8"));
  }
  const plain = path.join(ROOT, "data/tiers", `${tab}.csv`);
  if (existsSync(plain)) {
    return parseCsv(readFileSync(plain, "utf8"));
  }
  const sample = path.join(ROOT, "data/tiers/sample", `${tab}.sample.csv`);
  if (existsSync(sample)) {
    return parseCsv(readFileSync(sample, "utf8"));
  }
  return null;
}

// ————————————————————— normalization —————————————————————

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Decode HTML entities and strip scraper mojibake without touching real text. */
function cleanText(raw: string): string {
  return (
    raw
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
        String.fromCodePoint(Number.parseInt(h, 16)),
      )
      .replace(/&([a-z]+);/gi, (m, name: string) => {
        const lower = name.toLowerCase();
        return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : m;
      })
      .replace(/�/g, "") // replacement chars from broken source encodings
      .replace(/\u00f0\u0178[\s\S]{0,2}/g, "") // mangled UTF-8 emoji sequences
      // A stray eth (ð) before a non-ASCII char, space or EOL is half-decoded
      // emoji residue, never real text in this catalog.
      .replace(/\u00f0(?=[^\x00-\x7f]|\s|$)/g, "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function intOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function splitImages(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const part of raw.split(/\s*\|\s*|\n/)) {
    const url = part.trim();
    if (!/^https?:\/\//.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= 8) break;
  }
  return urls;
}

export type SheetRow = {
  sourceKey: string;
  vertical: string;
  externalId: string;
  title: string;
  slug: string;
  category: string;
  fieldsCategories: string[];
  vendor: string | null;
  shortTagline: string | null;
  description: string;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean;
  materials: string | null;
  dimensions: string | null;
  inStock: boolean;
  images: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  hash: string;
};

/**
 * L-S3 editorial rewrites: fact-preserving description overrides keyed by
 * `${importSource}|${importRef}`, shipped as repo data (data/rewrites/*.json)
 * so they reach every environment through the normal deploy import. A row
 * with an override imports with the rewritten copy and needsRewrite=false;
 * the override text is salted into sourceHash so an edited rewrite
 * re-imports exactly the rows it touches — no global normalizer bump.
 */
function loadRewriteOverrides(log: (msg: string) => void): Map<string, string> {
  const dir = path.join(ROOT, "data", "rewrites");
  const map = new Map<string, string>();
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return map; // no rewrites shipped — nothing to apply
  }
  for (const f of files.sort()) {
    try {
      const entries: unknown = JSON.parse(
        readFileSync(path.join(dir, f), "utf8"),
      );
      if (!Array.isArray(entries)) continue;
      for (const e of entries as Array<Record<string, unknown>>) {
        if (
          e &&
          typeof e.importSource === "string" &&
          typeof e.importRef === "string" &&
          typeof e.description === "string" &&
          e.description.trim()
        ) {
          map.set(`${e.importSource}|${e.importRef}`, e.description.trim());
        }
      }
    } catch (err) {
      log(`import-tiers: skipping unreadable rewrite file ${f}: ${err}`);
    }
  }
  return map;
}

/** Salt a row hash with its rewrite text so override edits re-import the row. */
function saltedHash(rowHash: string, rewrite: string | undefined): string {
  if (!rewrite) return rowHash;
  const salt = createHash("sha256").update(rewrite).digest("hex").slice(0, 8);
  // "rw1": salt-schema version — bumped when how a rewrite is APPLIED
  // changes (e.g. it now also governs seoDescription), so exactly the
  // overridden rows re-import.
  return `${rowHash}+rw1${salt}`;
}

function parseRow(raw: Record<string, string>): SheetRow | null {
  // Trailing comma/space artifacts are scraper truncation debris ("Kanku –
  // Chawal,") — never meaningful in a title (audit M-S4).
  const title = cleanText(raw.title ?? "").replace(/[\s,]+$/, "");
  const externalId = (raw.externalid ?? "").trim();
  const sourceKey = (raw.sourcekey ?? "").trim();
  if (!title || !externalId || !sourceKey) return null;

  let fieldsCategories: string[] = [];
  let vendor: string | null = null;
  try {
    const fields = JSON.parse(raw.fields || "{}") as {
      categories?: unknown;
      vendor?: unknown;
      productType?: unknown;
    };
    if (Array.isArray(fields.categories)) {
      fieldsCategories = fields.categories
        .filter((c): c is string => typeof c === "string")
        .map(cleanText);
    }
    if (typeof fields.productType === "string") {
      fieldsCategories.push(cleanText(fields.productType));
    }
    if (typeof fields.vendor === "string") vendor = cleanText(fields.vendor);
  } catch {
    // fields cell is best-effort JSON from the scraper — ignore breakage
  }

  let priceMin = intOrNull(raw.pricemin);
  let priceMax = intOrNull(raw.pricemax);
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const description = cleanText(raw.description ?? "");
  const shortTagline = cleanText(raw.shorttagline ?? "") || null;
  const hash = `${
    (raw.contenthash ?? "").trim() ||
    createHash("sha256")
      .update([title, description, raw.pricemin, raw.images].join("|"))
      .digest("hex")
      .slice(0, 16)
  }:${NORMALIZER_VERSION}`;

  return {
    sourceKey,
    vertical: (raw.vertical ?? "").trim() || "resin",
    externalId,
    title: title.slice(0, 180),
    slug: (raw.slug ?? "").trim(),
    category: cleanText(raw.category ?? ""),
    fieldsCategories,
    vendor,
    shortTagline: shortTagline?.slice(0, 160) ?? null,
    description,
    priceMin,
    priceMax,
    showPrice:
      /^(true|yes|1)$/i.test((raw.showprice ?? "").trim()) && priceMin !== null,
    materials: cleanText(raw.materials ?? "") || null,
    dimensions: cleanText(raw.dimensions ?? "") || null,
    inStock: (raw.status ?? "").trim().toLowerCase() !== "out_of_stock",
    images: splitImages(raw.images),
    seoTitle: cleanText(raw.seotitle ?? "") || null,
    seoDescription: cleanText(raw.seodescription ?? "") || null,
    hash,
  };
}

// ————————————————————— ranking —————————————————————

/**
 * Deterministic content-quality score for "top N" selection. The sheet has
 * no sales/popularity data, so quality of presentation stands in for it:
 * rows a customer can actually evaluate (images, real description, a price,
 * in stock, clean title) outrank sparse ones. Never invents data — it only
 * orders what the sheet provides.
 */
function score(row: SheetRow): number {
  let s = 0;
  s += Math.min(row.images.length, 6) * 3;
  s += Math.min(row.description.length / 80, 10);
  if (row.priceMin !== null) s += 2;
  if (row.inStock) s += 2;
  if (row.category || row.fieldsCategories.length > 0) s += 1;
  const letters = row.title.replace(/[^a-z]/gi, "");
  const caps = row.title.replace(/[^A-Z]/g, "");
  if (letters.length > 8 && caps.length / letters.length > 0.6) s -= 2;
  if (/&#|https?:\/\//.test(row.title)) s -= 3;
  return s;
}

// ————————————————————— public types —————————————————————

export type TierFillTrigger = "DEPLOY" | "MANUAL" | "PREVIEW";

/** One row this run did not import, and why. */
export type TierFillDroppedRow = {
  tab: string;
  sourceKey?: string;
  externalId?: string;
  title?: string;
  reason: string;
};

export type TierFillTotals = {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
};

export type TierFillTierSummary = {
  tier: number;
  detected: number;
  selected: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  demoted: number;
};

export type TierFillResult = {
  /** True when the run was refused before touching anything — the master
   *  switch, deploy-on-off, or the blast-radius cap. */
  aborted: false | { reason: string; detail?: Record<string, unknown> };
  totals: TierFillTotals;
  runSummary: Record<string, TierFillTierSummary>;
  dropped: TierFillDroppedRow[];
  /** Fields with a sheet/studio conflict this run detected — see the module
   *  note. Computed the same way whether or not this is a dryRun (a preview
   *  can show what WOULD be flagged); zero on the very first run ever, since
   *  there is nothing to compare against yet. */
  conflictsDetected: number;
  /** Of `conflictsDetected`, how many were actually written as SheetConflict
   *  rows — always 0 in dryRun, since a preview writes nothing. */
  conflictsWritten: number;
  /** OwnerImportReady batch totals, when that tab was present. */
  ownerReady: { created: number; updated: number; failed: number } | null;
  /** The persisted ImportRun's id, or null in dryRun (nothing was written). */
  importRunId: string | null;
};

export type RunTierFillOptions = {
  trigger: TierFillTrigger;
  /** When true, every read and decision runs normally and every write is
   *  skipped — used by previewSheetFill() to show what a real run would do. */
  dryRun?: boolean;
  policy: FillPolicy;
  db: PrismaClient;
  /** Defaults to console.log/console.error — pass one to capture output
   *  instead (the studio actions do, for the run's own record). */
  log?: (message: string) => void;
};

export type TierRowPlan = {
  /** The rows this tier will actually process, in sheet order. */
  rows: SheetRow[];
  /** Every row that left the set, and why — one entry per row for a
   *  row-level reason, one summary entry for the tab-wide "missing fields"
   *  reason (those rows have no parsed identity to name). */
  dropped: TierFillDroppedRow[];
  /** Row count after the gift-card/tombstone screen, before dedupe/cap —
   *  what `runSummary[tab].detected` reports. */
  detectedCount: number;
  /** `${sourceKey}:${externalId}` keys chosen for Tier-1 merchandising. */
  featuredKeys: Set<string>;
};

/**
 * Pure planner: which rows of one tier's tab are selected, which are
 * dropped and why, and (Tier 1 only) which are featured. Extracted from the
 * write loop below so the row-selection logic — the part an operator
 * actually wants to see in a preview — is testable over fixture rows
 * without a database (tier-fill.test.ts).
 */
export function planTierRows(
  spec: TierSpec,
  rawRows: Record<string, string>[],
  tombstoneKeys: ReadonlySet<string>,
): TierRowPlan {
  const dropped: TierFillDroppedRow[] = [];

  const stage1: SheetRow[] = [];
  let missingCount = 0;
  for (const raw of rawRows) {
    const parsedRow = parseRow(raw);
    if (parsedRow) stage1.push(parsedRow);
    else missingCount++;
  }
  if (missingCount > 0) {
    dropped.push({
      tab: spec.tab,
      reason: `${missingCount} row(s) missing title, externalId or sourceKey`,
    });
  }

  const stage2: SheetRow[] = [];
  for (const r of stage1) {
    if (spec.tier !== 1 && EXCLUDED_TITLE.test(r.title)) {
      dropped.push({
        tab: spec.tab,
        sourceKey: r.sourceKey,
        externalId: r.externalId,
        title: r.title,
        reason:
          "gift card — a purchase instrument of that store, not a product of this one",
      });
      continue;
    }
    stage2.push(r);
  }

  const stage3: SheetRow[] = [];
  for (const r of stage2) {
    if (tombstoneKeys.has(`sheet:${r.sourceKey}|${r.externalId}`)) {
      dropped.push({
        tab: spec.tab,
        sourceKey: r.sourceKey,
        externalId: r.externalId,
        title: r.title,
        reason: "deleted by the owner — deletions are honored permanently",
      });
      continue;
    }
    stage3.push(r);
  }
  const detectedCount = stage3.length;

  // Dedupe inside the tab on (sourceKey, externalId).
  const seen = new Set<string>();
  const stage4: SheetRow[] = [];
  for (const r of stage3) {
    const key = `${r.sourceKey}:${r.externalId}`;
    if (seen.has(key)) {
      dropped.push({
        tab: spec.tab,
        sourceKey: r.sourceKey,
        externalId: r.externalId,
        title: r.title,
        reason: "duplicate row in this tab",
      });
      continue;
    }
    seen.add(key);
    stage4.push(r);
  }

  // "Top N" = the sheet's own order (owner brief, master prompt): the
  // tabs carry no ranking/score column, and the brief's rule for that
  // case is explicit — use the existing sheet order. The quality score
  // below still drives FEATURED merchandising picks, never selection.
  let rows = stage4;
  if (spec.cap !== null && rows.length > spec.cap) {
    for (const r of rows.slice(spec.cap)) {
      dropped.push({
        tab: spec.tab,
        sourceKey: r.sourceKey,
        externalId: r.externalId,
        title: r.title,
        reason: `beyond this tier's cap of ${spec.cap}`,
      });
    }
    rows = rows.slice(0, spec.cap);
  }

  // Featured Tier-1 picks: best-scoring owner rows with imagery.
  const featuredKeys = new Set<string>();
  if (spec.tier === 1) {
    [...rows]
      .filter((r) => r.images.length > 0 && r.description.length > 60)
      .sort((a, b) => score(b) - score(a))
      .slice(0, FEATURED_TIER1)
      .forEach((r) => featuredKeys.add(`${r.sourceKey}:${r.externalId}`));
  }

  return { rows, dropped, detectedCount, featuredKeys };
}

/** One field of a sheet/studio conflict — see `runTierFill`'s conflict note. */
export type ConflictFieldDiff = {
  field: (typeof CONFLICT_FIELDS)[number];
  sheetValue: string | null;
  dbValue: string | null;
};

/**
 * Pure: which of `CONFLICT_FIELDS` differ between what the sheet would
 * write and what the database currently holds, serialized the same way
 * `SheetConflict.sheetValue`/`dbValue` are stored (String(...), null stays
 * null). Extracted so the field-diff logic is unit-tested directly.
 */
export function diffConflictFields(
  sheetSide: Record<(typeof CONFLICT_FIELDS)[number], unknown>,
  dbSide: Record<(typeof CONFLICT_FIELDS)[number], unknown>,
): ConflictFieldDiff[] {
  const diffs: ConflictFieldDiff[] = [];
  for (const field of CONFLICT_FIELDS) {
    if (dbSide[field] === sheetSide[field]) continue;
    diffs.push({
      field,
      sheetValue:
        sheetSide[field] === null || sheetSide[field] === undefined
          ? null
          : String(sheetSide[field]),
      dbValue:
        dbSide[field] === null || dbSide[field] === undefined
          ? null
          : String(dbSide[field]),
    });
  }
  return diffs;
}

// ————————————————————— the fill —————————————————————

export async function runTierFill(
  opts: RunTierFillOptions,
): Promise<TierFillResult> {
  const { trigger, policy, db } = opts;
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? ((msg: string) => console.log(msg));

  const dropped: TierFillDroppedRow[] = [];
  const conflictRows: {
    productId: string;
    field: string;
    sheetValue: string | null;
    dbValue: string | null;
  }[] = [];

  // The run this one is reconciling against, for conflict detection: a
  // studioEditedAt AFTER this timestamp means the owner touched the row
  // again since the last time the fill looked at it — a genuine new edit,
  // not one this pipeline already knew about. No prior run (a brand-new
  // environment) means nothing to compare against, so no conflicts fire.
  const previousRun = await db.importRun.findFirst({
    where: { dryRun: false },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const previousRunStartedAt = previousRun?.startedAt ?? null;

  // Canonical categories first (idempotent; translations included).
  const categoryIds = new Map<string, string>();
  const maxOrder = await db.category.aggregate({ _max: { order: true } });
  let nextOrder = (maxOrder._max.order ?? 0) + 1;
  for (const cat of CANONICAL_CATEGORIES) {
    const existingCat = await db.category.findUnique({
      where: { slug: cat.slug },
      select: { id: true },
    });
    if (existingCat) {
      categoryIds.set(cat.slug, existingCat.id);
      continue;
    }
    if (dryRun) {
      // Nothing to key new rows against yet in dry-run — a placeholder id is
      // fine because dryRun never writes a categoryId anywhere.
      categoryIds.set(cat.slug, `dry-run:${cat.slug}`);
      continue;
    }
    const created = await db.category.create({
      data: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        order: nextOrder++,
        translations: cat.translations,
      },
      select: { id: true },
    });
    categoryIds.set(cat.slug, created.id);
    log(`import-tiers: created category ${cat.slug}`);
  }
  const allCats = await db.category.findMany({
    select: { id: true, slug: true },
  });
  for (const c of allCats) categoryIds.set(c.slug, c.id);

  /**
   * Resolve (or create) a category id. Creation is a resilience path for
   * fresh databases where the base seed has not run yet — seed.ts later
   * upserts the proper name/description onto the same slug.
   */
  const categoryIdFor = async (slug: string): Promise<string> => {
    const hit = categoryIds.get(slug);
    if (hit) return hit;
    if (dryRun) {
      categoryIds.set(slug, `dry-run:${slug}`);
      return `dry-run:${slug}`;
    }
    const created = await db.category.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        order: nextOrder++,
      },
      select: { id: true },
    });
    categoryIds.set(slug, created.id);
    return created.id;
  };

  // Legacy M-A2 cleanup: n≤3 runs stamped resin DEFAULT_CARE_NOTES on every
  // sheet row. The import loop below only rewrites rows in the CURRENT cap
  // selection, so demoted drafts would keep the stale stamp forever — clear
  // it here. Matches the exact stamped text only, so owner-authored care
  // notes (or sheet-provided owner-ready notes) are never touched. No-op
  // after the first n4 pass.
  if (!dryRun) {
    const cleaned = await db.product.updateMany({
      where: {
        importSource: { startsWith: "sheet:" },
        careNotes: DEFAULT_CARE_NOTES,
      },
      data: { careNotes: null },
    });
    if (cleaned.count > 0) {
      log(
        `import-tiers: cleared legacy default care notes on ${cleaned.count} rows (M-A2).`,
      );
    }
  }

  const tombstones = new Set(
    (
      await db.deletedImport.findMany({
        select: { importSource: true, importRef: true },
      })
    ).map((t) => `${t.importSource}|${t.importRef}`),
  );

  // ——— Blast-radius pre-pass ———
  // Counts how many products this run would CREATE, and refuses the whole
  // run if that exceeds the owner's cap. Creates are the direction that
  // hurts: a mis-sorted sheet, a re-keyed export or a changed id column
  // turns a routine sync into thousands of inserts into a live storefront.
  // Updates are already held back by `ownerTouched`.
  //
  // This deliberately re-reads and re-parses the tabs rather than sharing
  // state with the write loop below. Parsing ~64k rows twice costs seconds
  // in a deploy script; restructuring a loop that has run on every
  // production build to save them is a much worse trade. PREVIEW/MANUAL
  // runs the same gate — a preview that hid the abort would show creates
  // the real run then refuses.
  if (policy.maxCreates !== null) {
    let plannedCreates = 0;
    for (const spec of TIERS) {
      const rawRows = readTab(spec.tab);
      if (!rawRows) continue;
      let keys = rawRows
        .map(parseRow)
        .filter((r): r is SheetRow => r !== null)
        .filter((r) => spec.tier === 1 || !EXCLUDED_TITLE.test(r.title))
        .filter((r) => !tombstones.has(`sheet:${r.sourceKey}|${r.externalId}`))
        .map((r) => ({ source: `sheet:${r.sourceKey}`, ref: r.externalId }));

      const seenKeys = new Set<string>();
      keys = keys.filter((k) => {
        const id = `${k.source}:${k.ref}`;
        if (seenKeys.has(id)) return false;
        seenKeys.add(id);
        return true;
      });
      if (spec.cap !== null && keys.length > spec.cap) {
        keys = keys.slice(0, spec.cap);
      }
      if (keys.length === 0) continue;

      const existingCount = await db.product.count({
        where: {
          OR: keys.map((k) => ({ importSource: k.source, importRef: k.ref })),
        },
      });
      plannedCreates += keys.length - existingCount;
    }

    const writeGate = decideFillWrite(plannedCreates, policy);
    if (!writeGate.run) {
      log(`import-tiers: ABORTED — ${writeGate.reason}`);
      if (!dryRun) {
        await db.importRun.create({
          data: {
            trigger,
            dryRun,
            abortedReason: writeGate.reason,
            detail: { plannedCreates, maxCreates: policy.maxCreates },
            finishedAt: new Date(),
          },
        });
      }
      return {
        aborted: {
          reason: writeGate.reason,
          detail: { plannedCreates, maxCreates: policy.maxCreates },
        },
        totals: { created: 0, updated: 0, unchanged: 0, failed: 0 },
        runSummary: {},
        dropped: [],
        conflictsDetected: 0,
        conflictsWritten: 0,
        ownerReady: null,
        importRunId: null,
      };
    }
    log(
      `import-tiers: pre-pass — ${plannedCreates} products would be created (cap ${policy.maxCreates}).`,
    );
  }

  const rewriteOverrides = loadRewriteOverrides(log);
  if (rewriteOverrides.size > 0) {
    log(
      `import-tiers: ${rewriteOverrides.size} editorial rewrites loaded (L-S3).`,
    );
  }

  const totals: TierFillTotals = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  };
  const runSummary: Record<string, TierFillTierSummary> = {};

  for (const spec of TIERS) {
    const rawRows = readTab(spec.tab);
    if (!rawRows) {
      log(`import-tiers: ${spec.tab} — no data file, skipping.`);
      continue;
    }

    // See planTierRows (pure, tested directly in tier-fill.test.ts) for the
    // row-selection logic — which rows are selected, which are dropped and
    // why, and (Tier 1 only) which are featured.
    const plan = planTierRows(spec, rawRows, tombstones);
    dropped.push(...plan.dropped);
    const detectedCount = plan.detectedCount;
    const rows = plan.rows;
    const featuredKeys = plan.featuredKeys;

    const tierStats = { created: 0, updated: 0, skipped: 0, failed: 0 };

    for (const row of rows) {
      const importSource = `sheet:${row.sourceKey}`;
      const importRef = row.externalId;
      try {
        const rewrite = rewriteOverrides.get(`${importSource}|${importRef}`);
        const expectedHash = saltedHash(row.hash, rewrite);
        const existing = await db.product.findUnique({
          where: {
            importSource_importRef: { importSource, importRef },
          },
          select: {
            id: true,
            slug: true,
            sourceHash: true,
            ownerTouched: true,
            studioEditedAt: true,
            title: true,
            priceMin: true,
            priceMax: true,
            materials: true,
            dimensions: true,
            description: true,
            inStock: true,
            images: { select: { url: true }, orderBy: { order: "asc" } },
          },
        });

        if (existing && existing.sourceHash === expectedHash) {
          tierStats.skipped++;
          continue;
        }

        const categorySlug = canonicalCategoryFor(
          row.vertical,
          [row.category, ...row.fieldsCategories],
          row.title,
        );
        const categoryId = await categoryIdFor(categorySlug);

        const foreignPriced = FOREIGN_CURRENCY_SOURCES.has(row.sourceKey);
        const flagged = rewrite
          ? false
          : needsRewriteFor(row.description, row.vendor, row.sourceKey);
        // Every candidate for the meta description passes the same screen —
        // a branded description must not leak through the seo field when
        // the display layer is already suppressing it.
        const seoDescCandidate =
          rewrite ??
          (row.seoDescription &&
          !needsRewriteFor(row.seoDescription, row.vendor, row.sourceKey)
            ? row.seoDescription
            : null) ??
          row.shortTagline ??
          (flagged ? null : row.description);
        const data = {
          title: row.title,
          shortTagline: row.shortTagline,
          // Editorial rewrite (L-S3) wins over the scraped source copy.
          description: rewrite ?? row.description,
          priceMin: foreignPriced ? null : row.priceMin,
          priceMax: foreignPriced ? null : (row.priceMax ?? row.priceMin),
          showPrice: foreignPriced ? false : row.showPrice,
          materials: row.materials,
          dimensions: row.dimensions,
          // Never stamp resin care copy on imported rows (audit M-A2: an M3
          // screw got "Wipe clean with a soft, dry cloth…"). Null lets the
          // SiteSettings default-care-notes fallback do its job; written on
          // update too so previously stamped rows get cleaned.
          careNotes: null,
          status: "PUBLISHED" as const,
          // L-S3: scraped copy carrying source-store branding/URLs/emoji is
          // flagged; the PDP falls back to tagline + specs until rewritten.
          // A shipped rewrite clears the flag.
          needsRewrite: flagged,
          featured: featuredKeys.has(`${row.sourceKey}:${row.externalId}`),
          categoryId,
          seoTitle: (row.seoTitle ?? row.title).slice(0, 70),
          seoDescription: seoDescCandidate?.slice(0, 160) ?? null,
          tier: spec.tier,
          inStock: row.inStock,
          sourceHash: expectedHash,
        };

        // C3: a content update must not clobber mirrored imagery back to
        // third-party hosts. The mirror job stores each file under a
        // deterministic catalog/<sha1(sourceUrl)> pathname, so an existing
        // mirrored row for the same source URL is recognizable offline —
        // reuse it instead of resetting to the source URL.
        const existingUrls = existing?.images.map((i) => i.url) ?? [];
        const resolveImageUrl = (src: string) => {
          const key = `catalog/${createHash("sha1").update(src).digest("hex")}`;
          return existingUrls.find((u) => u.includes(key)) ?? src;
        };

        if (existing) {
          if (existing.ownerTouched) {
            // H5 merge-protection: the owner edited this row in the studio.
            // The sheet may refresh availability and the change-detection
            // hash — never content, price, category or images.
            if (!dryRun) {
              await db.product.update({
                where: { id: existing.id },
                data: { inStock: data.inStock, sourceHash: data.sourceHash },
              });
            }

            // Conflict detection: a studio edit made AFTER the run this one
            // is reconciling against, on a row whose sheet content also
            // moved (we are inside `existing.sourceHash !== expectedHash`
            // by construction here) is a genuine new conflict, not one a
            // prior run already knew about and left alone on purpose.
            if (
              previousRunStartedAt &&
              existing.studioEditedAt &&
              existing.studioEditedAt.getTime() > previousRunStartedAt.getTime()
            ) {
              const dbSide: Record<(typeof CONFLICT_FIELDS)[number], unknown> =
                {
                  title: existing.title,
                  priceMin: existing.priceMin,
                  priceMax: existing.priceMax,
                  materials: existing.materials,
                  dimensions: existing.dimensions,
                  description: existing.description,
                  inStock: existing.inStock,
                };
              const sheetSide: Record<
                (typeof CONFLICT_FIELDS)[number],
                unknown
              > = {
                title: data.title,
                priceMin: data.priceMin,
                priceMax: data.priceMax,
                materials: data.materials,
                dimensions: data.dimensions,
                description: data.description,
                inStock: data.inStock,
              };
              for (const diff of diffConflictFields(sheetSide, dbSide)) {
                conflictRows.push({ productId: existing.id, ...diff });
              }
            }
          } else if (!dryRun) {
            await db.product.update({
              where: { id: existing.id },
              data: {
                ...data,
                images: {
                  deleteMany: {},
                  create: row.images.map((url, order) => ({
                    url: resolveImageUrl(url),
                    alt: row.title,
                    order,
                  })),
                },
              },
            });
          }
          tierStats.updated++;
        } else {
          if (!dryRun) {
            // Global slug uniqueness; keep sheet slug where free.
            const base = slugify(row.slug || row.title) || "piece";
            let slug = base;
            for (let i = 2; ; i++) {
              const clash = await db.product.findUnique({
                where: { slug },
                select: { id: true },
              });
              if (!clash) break;
              slug = `${base}-${i}`;
            }
            await db.product.create({
              data: {
                ...data,
                slug,
                importSource,
                importRef,
                images: {
                  create: row.images.map((url, order) => ({
                    url,
                    alt: row.title,
                    order,
                  })),
                },
              },
            });
          }
          tierStats.created++;
        }
      } catch (error) {
        tierStats.failed++;
        log(
          `import-tiers: ${spec.tab} row ${row.externalId} failed: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    // Reconcile: sheet-imported products of this tier that are no longer
    // in the selected set demote to DRAFT (never deleted — records, images
    // and any inquiries are preserved; owner-created products and the
    // owner-ready batch are never touched). Keeps the published counts at
    // exactly the brief's volumes.
    let demotedCount = 0;
    if (!dryRun) {
      try {
        const selectedRefs = rows.map((r) => r.externalId);
        const demoted = await db.product.updateMany({
          where: {
            tier: spec.tier,
            status: "PUBLISHED",
            importSource: { startsWith: "sheet:" },
            NOT: { importSource: "sheet:owner-ready" },
            importRef: { notIn: selectedRefs },
          },
          data: { status: "DRAFT" },
        });
        demotedCount = demoted.count;
        if (demoted.count > 0) {
          log(
            `import-tiers: ${spec.tab} → ${demoted.count} formerly-selected ` +
              `rows demoted to DRAFT (out of the sheet-order top ${
                spec.cap ?? rows.length
              }).`,
          );
        }
      } catch (error) {
        log(
          `import-tiers: ${spec.tab} reconcile failed (continuing): ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    runSummary[spec.tab] = {
      tier: spec.tier,
      detected: detectedCount,
      selected: rows.length,
      created: tierStats.created,
      updated: tierStats.updated,
      unchanged: tierStats.skipped,
      failed: tierStats.failed,
      demoted: demotedCount,
    };

    log(
      `import-tiers: ${spec.tab} → +${tierStats.created} created, ` +
        `${tierStats.updated} updated, ${tierStats.skipped} unchanged, ` +
        `${tierStats.failed} failed (of ${rows.length} selected).`,
    );
    totals.created += tierStats.created;
    totals.updated += tierStats.updated;
    totals.unchanged += tierStats.skipped;
    totals.failed += tierStats.failed;
  }

  // The owner's prepared import-ready batch (45-column studio template).
  // These rows carry status DRAFT in the sheet — respected verbatim so the
  // owner publishes them from the studio when ready. Prefers the full tab
  // fetched via the shared URL's gid when its schema matches the template;
  // otherwise falls back to the committed sample extract.
  let readyRows: Record<string, string>[] | null = null;
  const gidPath = path.join(
    ROOT,
    "data/tiers",
    "OwnerSheet_gid630660076.csv.gz",
  );
  if (existsSync(gidPath)) {
    const rows = parseCsv(gunzipSync(readFileSync(gidPath)).toString("utf8"));
    // Schema sniff: the studio template has category_slug; tier tabs don't.
    if (rows.length > 0 && "category_slug" in rows[0]) {
      readyRows = rows;
      log(
        `import-tiers: OwnerImportReady — using full gid tab (${rows.length} rows).`,
      );
    }
  }
  if (!readyRows) {
    const readyPath = path.join(
      ROOT,
      "data/tiers/sample",
      "OwnerImportReady.sample.csv",
    );
    if (existsSync(readyPath)) {
      readyRows = parseCsv(readFileSync(readyPath, "utf8"));
    }
  }

  let ownerReady: TierFillResult["ownerReady"] = null;
  if (readyRows) {
    const ready = { created: 0, updated: 0, failed: 0 };
    for (const raw of readyRows) {
      const title = cleanText(raw.title ?? "");
      const refSlug = slugify(raw.slug || title);
      if (!title || !refSlug) {
        dropped.push({
          tab: "OwnerImportReady",
          reason: "missing title or slug",
        });
        continue;
      }
      try {
        const importSource = "sheet:owner-ready";
        const rowHash = `${createHash("sha256")
          .update(Object.values(raw).join(" "))
          .digest("hex")
          .slice(0, 16)}:${NORMALIZER_VERSION}`;
        const status = /published/i.test(raw.status ?? "")
          ? ("PUBLISHED" as const)
          : ("DRAFT" as const);
        const priceMin = intOrNull(raw.price_min);
        const images = splitImages(raw.images);
        const data = {
          title: title.slice(0, 180),
          shortTagline: cleanText(raw.short_tagline ?? "") || null,
          description: cleanText(raw.description ?? ""),
          priceMin,
          priceMax: intOrNull(raw.price_max) ?? priceMin,
          showPrice:
            /^(true|yes|1)$/i.test((raw.show_price ?? "").trim()) &&
            priceMin !== null,
          timeline: cleanText(raw.timeline ?? "") || null,
          materials: cleanText(raw.materials ?? "") || null,
          dimensions: cleanText(raw.dimensions ?? "") || null,
          // Owner-provided care notes are kept verbatim; absent ones stay
          // null so the SiteSettings fallback applies (audit M-A2).
          careNotes: cleanText(raw.care_notes ?? "") || null,
          status,
          featured: /^(true|yes|1)$/i.test((raw.featured ?? "").trim()),
          videoUrl: (raw.video_url ?? "").trim() || null,
          model3dUrl: (raw.model3d_url ?? "").trim() || null,
          categoryId: await categoryIdFor(
            (raw.category_slug ?? "").trim() || "resin-home-decor",
          ),
          seoTitle: (cleanText(raw.seo_title ?? "") || title).slice(0, 70),
          seoDescription: (
            cleanText(raw.seo_description ?? "") ||
            cleanText(raw.short_tagline ?? "") ||
            cleanText(raw.description ?? "")
          ).slice(0, 160),
          tier: 1,
          needsRewrite: false,
          sourceHash: rowHash,
        };
        const existing = await db.product.findUnique({
          where: {
            importSource_importRef: { importSource, importRef: refSlug },
          },
          select: { id: true, sourceHash: true, ownerTouched: true },
        });
        if (existing && existing.sourceHash === rowHash) {
          continue;
        }
        if (existing) {
          if (existing.ownerTouched) {
            // H5: owner-edited row — hash refresh only (this tier-1 sheet
            // carries no availability column to merge).
            if (!dryRun) {
              await db.product.update({
                where: { id: existing.id },
                data: { sourceHash: rowHash },
              });
            }
          } else if (!dryRun) {
            await db.product.update({
              where: { id: existing.id },
              data: {
                ...data,
                images: {
                  deleteMany: {},
                  create: images.map((url, order) => ({
                    url,
                    alt: title,
                    order,
                  })),
                },
              },
            });
          }
          ready.updated++;
        } else {
          if (!dryRun) {
            let slug = refSlug;
            for (let i = 2; ; i++) {
              const clash = await db.product.findUnique({
                where: { slug },
                select: { id: true },
              });
              if (!clash) break;
              slug = `${refSlug}-${i}`;
            }
            await db.product.create({
              data: {
                ...data,
                slug,
                importSource,
                importRef: refSlug,
                images: {
                  create: images.map((url, order) => ({
                    url,
                    alt: title,
                    order,
                  })),
                },
              },
            });
          }
          ready.created++;
        }
      } catch (error) {
        ready.failed++;
        log(
          `import-tiers: owner-ready row ${refSlug} failed: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
    ownerReady = ready;
    log(
      `import-tiers: OwnerImportReady → +${ready.created} created, ` +
        `${ready.updated} updated, ${ready.failed} failed (drafts).`,
    );
  }

  log(
    `import-tiers: done — ${totals.created} created, ${totals.updated} ` +
      `updated, ${totals.unchanged} unchanged, ${totals.failed} failed.`,
  );

  // Persist the run for the studio's Sheet Import Center (userId null =
  // system actor; the activity feed labels it accordingly). Never in
  // dryRun — a preview leaves no trace beyond what it returns to the caller.
  let importRunId: string | null = null;
  if (!dryRun) {
    try {
      const run = await db.importRun.create({
        data: {
          trigger,
          dryRun: false,
          rowsRead:
            totals.created + totals.updated + totals.unchanged + totals.failed,
          created: totals.created,
          updated: totals.updated,
          unchanged: totals.unchanged,
          failed: totals.failed,
          detail: {
            tiers: runSummary,
            dropped,
          } as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      importRunId = run.id;
      if (conflictRows.length > 0) {
        await db.sheetConflict.createMany({
          data: conflictRows.map((c) => ({
            productId: c.productId,
            importRunId: run.id,
            field: c.field,
            sheetValue: c.sheetValue,
            dbValue: c.dbValue,
          })),
        });
      }
      await db.activityLog.create({
        data: {
          action: "sheet-import",
          entity: "product",
          meta: {
            tiers: runSummary,
            totals,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      log(
        `import-tiers: could not record run summary (continuing): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  return {
    aborted: false,
    totals,
    runSummary,
    dropped,
    conflictsDetected: conflictRows.length,
    conflictsWritten: dryRun ? 0 : conflictRows.length,
    ownerReady,
    importRunId,
  };
}
