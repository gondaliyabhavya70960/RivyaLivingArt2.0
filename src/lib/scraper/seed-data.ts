import type { Prisma } from "@/generated/prisma/client";
import type {
  CollectionMode,
  ScrapePlatform,
  ScrapeTier,
} from "@/generated/prisma/enums";

/**
 * Curated scrape-source registry (Phase 11 research spec). Seeded on first
 * visit to /studio/scraper/sources and re-applied via "Re-seed registry".
 * Merge key: `key` — re-seeding upserts and never downgrades a platform
 * that was already verified live.
 */
export type SeedSource = {
  key: string;
  name: string;
  baseUrl: string;
  tier: ScrapeTier;
  vertical: string;
  country: string;
  platform: ScrapePlatform;
  supply: boolean;
  enabled: boolean;
  notes?: string;
  /**
   * Governance, for the rows where the registry itself already records a
   * decision. Applied on CREATE only — like `enabled`, an operator's later
   * choice in the Studio outranks the seed and must survive a re-seed.
   * Omitted means HTTP, the schema default.
   */
  collectionMode?: CollectionMode;
};

/** The row as it exists today, or undefined when this seed is new. */
export type SeedSourceCurrent =
  | { platform: ScrapePlatform; verifiedAt: Date | null }
  | undefined;

/**
 * The upsert payload for one seed — the ONE definition of what re-seeding
 * writes.
 *
 * It lives in this db-free module because TWO callers reconcile the registry
 * and they must not drift: `applySeedSources` (the Studio's "Re-seed registry"
 * button) and `prisma/seed-sources.ts` (the deploy-time script bootstrap runs
 * on every build, which cannot import the Studio one because that pulls in
 * `@/lib/db`). The second used to be a hand-copy of the first under a comment
 * promising it "mirrors applySeedSources exactly". It stopped being true the
 * moment `collectionMode` was added to one of them: a fresh deploy seeded the
 * enquiry-only source as automatable, and only CI's clean database caught it —
 * a developer database already had the row, so the migration's backfill hid
 * the bug locally.
 *
 * WHAT THE UPDATE BRANCH DELIBERATELY OMITS is the whole rule: `enabled`,
 * `collectionMode` and every policy-review column. Those are the operator's
 * decisions, and a deploy that runs on every build must never overwrite one.
 * A seed's `collectionMode` therefore applies on CREATE only — it records what
 * the registry already knew about a brand-new row, not an opinion to re-impose
 * on an existing one.
 */
export function seedSourceUpsertData(
  seed: SeedSource,
  current: SeedSourceCurrent,
): {
  create: Prisma.ScrapeSourceCreateInput;
  update: Prisma.ScrapeSourceUpdateInput;
} {
  // A platform confirmed against the live site outranks the seed's guess.
  const keepVerifiedPlatform =
    current !== undefined &&
    current.verifiedAt !== null &&
    current.platform !== "UNKNOWN";

  return {
    create: {
      key: seed.key,
      name: seed.name,
      baseUrl: seed.baseUrl,
      tier: seed.tier,
      vertical: seed.vertical,
      country: seed.country,
      platform: seed.platform,
      supply: seed.supply,
      enabled: seed.enabled,
      notes: seed.notes ?? null,
      ...(seed.collectionMode ? { collectionMode: seed.collectionMode } : {}),
    },
    update: {
      name: seed.name,
      baseUrl: seed.baseUrl,
      tier: seed.tier,
      vertical: seed.vertical,
      country: seed.country,
      supply: seed.supply,
      ...(seed.notes !== undefined ? { notes: seed.notes } : {}),
      ...(keepVerifiedPlatform ? {} : { platform: seed.platform }),
    },
  };
}

const FINGERPRINT_FALLBACK_NOTE =
  "fingerprint at runtime → JSON-LD fallback if not Shopify/Woo";

export const SEED_SOURCES: SeedSource[] = [
  // ————————— Tier 1 — Owner's list —————————
  {
    key: "sumaiya-resin",
    name: "Sumaiya Resin",
    baseUrl: "https://sumaiyaresin.art",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: true,
  },
  {
    key: "resin-arts-jaipur",
    name: "Resin Arts Jaipur",
    baseUrl: "https://resinartsjaipur.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: true,
  },
  {
    key: "kanha-kreation",
    name: "Kanha Kreation",
    baseUrl: "https://kanhakreation.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: true,
  },
  {
    key: "saashi",
    name: "Saashi",
    baseUrl: "https://saashi.co.in",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: true,
    notes: "WordPress/Woo expected — fingerprint confirms at runtime",
  },
  {
    key: "leoberry-gifts",
    name: "Leoberry Gifts",
    baseUrl: "https://leoberrygifts.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: true,
    notes: FINGERPRINT_FALLBACK_NOTE,
  },
  {
    key: "resinart-in",
    name: "ResinArt.in",
    baseUrl: "https://resinart.in",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: true,
    notes: FINGERPRINT_FALLBACK_NOTE,
  },
  {
    key: "woodensure",
    name: "WoodenSure",
    baseUrl: "https://www.woodensure.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: true,
    notes: FINGERPRINT_FALLBACK_NOTE,
  },
  {
    key: "poonam-shah-art",
    name: "Poonam Shah Art",
    baseUrl: "https://www.poonamshahart.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "NO scrapeable catalog (verified: enquiry-only). Do NOT scrape; her category lines are covered by the Phase 11 category structure.",
  },
];
