import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseCsv } from "../src/lib/import/parse";
import { slugify } from "../src/lib/slug";
import { DEFAULT_CARE_NOTES } from "../src/lib/scraper/product-sheet";
import {
  CANONICAL_CATEGORIES,
  canonicalCategoryFor,
} from "../src/lib/catalog-taxonomy";
import {
  DEFAULT_FILL_POLICY,
  decideFillRun,
  decideFillWrite,
  type FillPolicy,
} from "../src/lib/import/fill-policy";

/**
 * Four-tier owner-sheet import (owner brief, 2026-08-13).
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
 */

const ROOT = path.join(__dirname, "..");

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

type TierSpec = {
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
    console.log(`import-tiers: ${tab} — full export absent, using sample.`);
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
  return raw
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
    .trim();
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

type SheetRow = {
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
function loadRewriteOverrides(): Map<string, string> {
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
      console.warn(`import-tiers: skipping unreadable rewrite file ${f}:`, err);
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
      /^(true|yes|1)$/i.test((raw.showprice ?? "").trim()) &&
      priceMin !== null,
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

// ————————————————————— import —————————————————————

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("import-tiers: DATABASE_URL not set — skipping.");
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // ——— Phase 7: the owner's switch ———
    // This importer has run on every deploy since it was written. It still
    // does; the defaults below reproduce that exactly, so a fresh environment
    // self-populates from the sheet on first boot as it always has. What is
    // new is that the owner can turn it off, cap it, and see what it did.
    //
    // A missing settings row IS the fresh-environment case, and it fills.
    const settings = await db.siteSettings.findUnique({
      where: { id: "main" },
      select: {
        sheetFillEnabled: true,
        sheetFillOnDeploy: true,
        sheetFillMaxCreates: true,
      },
    });
    const policy: FillPolicy = settings
      ? {
          enabled: settings.sheetFillEnabled,
          onDeploy: settings.sheetFillOnDeploy,
          maxCreates: settings.sheetFillMaxCreates,
        }
      : DEFAULT_FILL_POLICY;

    const gate = decideFillRun("DEPLOY", policy);
    if (!gate.run) {
      console.log(`import-tiers: skipped — ${gate.reason}`);
      await db.importRun.create({
        data: {
          trigger: "DEPLOY",
          abortedReason: gate.reason,
          finishedAt: new Date(),
        },
      });
      return;
    }

    // Canonical categories first (idempotent; translations included).
    const categoryIds = new Map<string, string>();
    const maxOrder = await db.category.aggregate({ _max: { order: true } });
    let nextOrder = (maxOrder._max.order ?? 0) + 1;
    for (const cat of CANONICAL_CATEGORIES) {
      const existing = await db.category.findUnique({
        where: { slug: cat.slug },
        select: { id: true },
      });
      if (existing) {
        categoryIds.set(cat.slug, existing.id);
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
      console.log(`import-tiers: created category ${cat.slug}`);
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
    const cleaned = await db.product.updateMany({
      where: {
        importSource: { startsWith: "sheet:" },
        careNotes: DEFAULT_CARE_NOTES,
      },
      data: { careNotes: null },
    });
    if (cleaned.count > 0) {
      console.log(
        `import-tiers: cleared legacy default care notes on ${cleaned.count} rows (M-A2).`,
      );
    }

    const tombstones = new Set(
      (await db.deletedImport.findMany({
        select: { importSource: true, importRef: true },
      })).map((t) => `${t.importSource}|${t.importRef}`),
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
    // production build to save them is a much worse trade.
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

        const existing = await db.product.count({
          where: { OR: keys.map((k) => ({ importSource: k.source, importRef: k.ref })) },
        });
        plannedCreates += keys.length - existing;
      }

      const writeGate = decideFillWrite(plannedCreates, policy);
      if (!writeGate.run) {
        console.error(`import-tiers: ABORTED — ${writeGate.reason}`);
        await db.importRun.create({
          data: {
            trigger: "DEPLOY",
            abortedReason: writeGate.reason,
            detail: { plannedCreates, maxCreates: policy.maxCreates },
            finishedAt: new Date(),
          },
        });
        return;
      }
      console.log(
        `import-tiers: pre-pass — ${plannedCreates} products would be created (cap ${policy.maxCreates}).`,
      );
    }

    const rewriteOverrides = loadRewriteOverrides();
    if (rewriteOverrides.size > 0) {
      console.log(
        `import-tiers: ${rewriteOverrides.size} editorial rewrites loaded (L-S3).`,
      );
    }

    const totals = { created: 0, updated: 0, skipped: 0, failed: 0 };
    /** Per-tier stats persisted to ActivityLog for the studio import center. */
    const runSummary: Record<
      string,
      {
        tier: number;
        detected: number;
        selected: number;
        created: number;
        updated: number;
        unchanged: number;
        failed: number;
        demoted: number;
      }
    > = {};

    for (const spec of TIERS) {
      const rawRows = readTab(spec.tab);
      if (!rawRows) {
        console.log(`import-tiers: ${spec.tab} — no data file, skipping.`);
        continue;
      }
      let rows = rawRows
        .map(parseRow)
        .filter((r): r is SheetRow => r !== null)
        // Gift cards scraped from OTHER stores are purchase instruments of
        // those shops, not products of this one (audit H4). Tier 1 is the
        // owner's own store — their own gift card is a real product.
        .filter((r) => spec.tier === 1 || !EXCLUDED_TITLE.test(r.title))
        // Owner deletions are honored permanently (audit H5) — a tombstoned
        // (source, ref) pair never resurrects on re-import.
        .filter((r) => !tombstones.has(`sheet:${r.sourceKey}|${r.externalId}`));
      const detectedCount = rows.length;

      // Dedupe inside the tab on (sourceKey, externalId).
      const seen = new Set<string>();
      rows = rows.filter((r) => {
        const key = `${r.sourceKey}:${r.externalId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // "Top N" = the sheet's own order (owner brief, master prompt): the
      // tabs carry no ranking/score column, and the brief's rule for that
      // case is explicit — use the existing sheet order. The quality score
      // below still drives FEATURED merchandising picks, never selection.
      if (spec.cap !== null && rows.length > spec.cap) {
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
              await db.product.update({
                where: { id: existing.id },
                data: { inStock: data.inStock, sourceHash: data.sourceHash },
              });
            } else {
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
            tierStats.created++;
          }
        } catch (error) {
          tierStats.failed++;
          console.error(
            `import-tiers: ${spec.tab} row ${row.externalId} failed:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      // Reconcile: sheet-imported products of this tier that are no longer
      // in the selected set demote to DRAFT (never deleted — records, images
      // and any inquiries are preserved; owner-created products and the
      // owner-ready batch are never touched). Keeps the published counts at
      // exactly the brief's volumes.
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
        runSummary[spec.tab] = {
          tier: spec.tier,
          detected: detectedCount,
          selected: rows.length,
          created: tierStats.created,
          updated: tierStats.updated,
          unchanged: tierStats.skipped,
          failed: tierStats.failed,
          demoted: demoted.count,
        };
        if (demoted.count > 0) {
          console.log(
            `import-tiers: ${spec.tab} → ${demoted.count} formerly-selected ` +
              `rows demoted to DRAFT (out of the sheet-order top ${
                spec.cap ?? rows.length
              }).`,
          );
        }
      } catch (error) {
        console.error(
          `import-tiers: ${spec.tab} reconcile failed (continuing):`,
          error instanceof Error ? error.message : error,
        );
      }

      console.log(
        `import-tiers: ${spec.tab} → +${tierStats.created} created, ` +
          `${tierStats.updated} updated, ${tierStats.skipped} unchanged, ` +
          `${tierStats.failed} failed (of ${rows.length} selected).`,
      );
      totals.created += tierStats.created;
      totals.updated += tierStats.updated;
      totals.skipped += tierStats.skipped;
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
        console.log(
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
    if (readyRows) {
      const ready = { created: 0, updated: 0, failed: 0 };
      for (const raw of readyRows) {
        const title = cleanText(raw.title ?? "");
        const refSlug = slugify(raw.slug || title);
        if (!title || !refSlug) continue;
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
              await db.product.update({
                where: { id: existing.id },
                data: { sourceHash: rowHash },
              });
            } else {
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
            ready.created++;
          }
        } catch (error) {
          ready.failed++;
          console.error(
            `import-tiers: owner-ready row ${refSlug} failed:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
      console.log(
        `import-tiers: OwnerImportReady → +${ready.created} created, ` +
          `${ready.updated} updated, ${ready.failed} failed (drafts).`,
      );
    }

    console.log(
      `import-tiers: done — ${totals.created} created, ${totals.updated} ` +
        `updated, ${totals.skipped} unchanged, ${totals.failed} failed.`,
    );

    // Persist the run for the studio's Sheet Import Center (userId null =
    // system actor; the activity feed labels it accordingly).
    try {
      await db.importRun.create({
        data: {
          trigger: "DEPLOY",
          rowsRead:
            totals.created + totals.updated + totals.skipped + totals.failed,
          created: totals.created,
          updated: totals.updated,
          unchanged: totals.skipped,
          failed: totals.failed,
          detail: { tiers: runSummary },
          finishedAt: new Date(),
        },
      });
      await db.activityLog.create({
        data: {
          action: "sheet-import",
          entity: "product",
          meta: { tiers: runSummary, totals },
        },
      });
    } catch (error) {
      console.error(
        "import-tiers: could not record run summary (continuing):",
        error instanceof Error ? error.message : error,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("import-tiers: fatal:", error);
  process.exitCode = 1;
});
