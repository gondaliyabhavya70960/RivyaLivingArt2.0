import type { Prisma } from "@/generated/prisma/client";
import type { ManualEntry, RolloutEntry } from "@/lib/scraper/backlog-rollout";
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

export const SEED_SOURCES: SeedSource[] = [
  // ————————— Source tier OWNER — "Owner's store" (retired provenance value) —————————
  {
    key: "sumaiya-resin",
    name: "Sumaiya Resin",
    baseUrl: "https://sumaiyaresin.art",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    notes:
      "Verified 2026-09-16: the WooCommerce Store API answers but lists 0 products — nothing to collect until the store publishes.",
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
    notes: "Verified 2026-09-16: WooCommerce Store API, 22 products.",
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
    notes: "Verified 2026-09-16: WooCommerce Store API, 151 products.",
    enabled: true,
  },
  {
    key: "saashi",
    name: "Saashi",
    baseUrl: "https://saashi.co.in",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: true,
    notes: "Verified 2026-09-16: WooCommerce Store API, 338 products.",
  },
  {
    key: "leoberry-gifts",
    name: "Leoberry Gifts",
    baseUrl: "https://leoberrygifts.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    notes:
      "Verified 2026-09-16: WooCommerce Store API, 210 products (gifting).",
    enabled: true,
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
    notes:
      "Verified 2026-09-16: no catalogue API and no product JSON-LD — no automated path.",
    enabled: true,
  },
  {
    key: "woodensure",
    name: "WoodenSure",
    baseUrl: "https://www.woodensure.com",
    tier: "OWNER",
    vertical: "resin",
    country: "IN",
    platform: "JSONLD",
    supply: false,
    notes:
      "Verified 2026-09-16: no catalogue API, but product JSON-LD on every page and a product sitemap; 147 products in a capped run.",
    enabled: true,
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

  // The owner's PREVIOUS storefront is NOT registered here, and its removal on
  // 2026-09-18 is the owner's instruction, not a cleanup: every reference to
  // `store.bhavyagondaliya.co.in` comes out of live code. It had been listed
  // since 2026-09-16 under an earlier instruction ("put his website in the
  // scraper and in the competitor list"), disabled and MANUAL_RESEARCH, and it
  // answered HTTP 402 — a frozen store — to every probe that day, so it never
  // collected anything.
  //
  // Nothing is lost with it. That catalogue is `data/tiers/Tier1_Owner.csv.gz`,
  // committed, and /studio/catalog-fill imports it — which is also why the
  // string "sheet:*" and `Product.tier === 1` still mean "the owner's previous
  // store" everywhere they appear. Those are stored data and did not move.
  //
  // `applySeedSources` only ever UPSERTS, so dropping the entry here does not
  // delete a row an environment already has; it stops being re-seeded. Removing
  // the row itself is the operator's call on /studio/scraper/sources.

  // ————————— Source tier LARGE_FORMAT — "Tier 1 sources — Collectible Furniture & Spatial Art" —————————
  // The owner's own reference set, 2026-09-15. Registered, NOT approved:
  // every one lands policyReviewStatus PENDING, so the gate refuses to collect
  // any of them until a human records a review. Several are design references
  // first and competitors second — reading a site for art direction is not the
  // same act as crawling its catalogue, and only the second one needs a review.
  {
    key: "draga-aurel",
    name: "Draga & Aurel",
    baseUrl: "https://www.draga-aurel.com",
    tier: "LARGE_FORMAT",
    vertical: "resin",
    country: "IT",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "Reference: collectible resin furniture, material storytelling. Verified 2026-09-16: no catalogue API, no product JSON-LD, no recognised markup shape — no automated path.",
  },
  {
    key: "materia-aurea",
    name: "Materia Aurea",
    baseUrl: "https://www.materiaaurea.com",
    tier: "LARGE_FORMAT",
    vertical: "resin",
    country: "IT",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "Reference: bespoke commissions, sculptural presentation. Verified 2026-09-16: WordPress without the Store API, no product JSON-LD — a portfolio, not a shop.",
  },
  {
    key: "scarlet-splendour",
    name: "Scarlet Splendour",
    baseUrl: "https://www.scarletsplendour.com",
    tier: "LARGE_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "Reference: Indian luxury collectible furniture, editorial art direction. Verified 2026-09-16: every page answers a Cloudflare challenge to a server-side fetch — no automated path.",
  },
  {
    key: "within-design",
    name: "WITHIN",
    baseUrl: "https://within.net.in",
    tier: "LARGE_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "Reference: furniture and art presentation, collection storytelling. Verified 2026-09-16: custom Next.js site, no catalogue API, no product JSON-LD, six product URLs in its sitemap — no automated path.",
  },
  {
    key: "korepox-arts",
    name: "Korepox Arts",
    baseUrl: "https://korepox.com",
    tier: "LARGE_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: false,
    notes:
      "Competitor: epoxy tables, bespoke furniture, commission CTAs. Verified 2026-09-16: WooCommerce Store API, 9 listed tables.",
  },

  // ————————— Source tier MEDIUM_FORMAT — "Tier 2 sources — Memory & Celebration Art" —————————
  {
    key: "vedumi",
    name: "VEDUMI",
    baseUrl: "https://vedumi.in",
    tier: "MEDIUM_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "Competitor: varmala preservation, clocks, personalised resin. Verified 2026-09-16: custom React site, no catalogue API, no product JSON-LD, no product URLs in its sitemap — no automated path.",
  },
  {
    key: "the-art-galaxy",
    name: "The Art Galaxy",
    baseUrl: "https://theartgalaxy.com",
    tier: "MEDIUM_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "UNKNOWN",
    supply: false,
    enabled: false,
    collectionMode: "MANUAL_RESEARCH",
    notes:
      "Competitor: memory-preservation positioning. Verified 2026-09-16: no catalogue API, no product JSON-LD, service pages only — no automated path.",
  },
  {
    key: "radhika-art",
    name: "Radhika Art",
    baseUrl: "https://www.theradhikaart.in",
    tier: "MEDIUM_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "JSONLD",
    supply: false,
    enabled: false,
    notes:
      "Competitor: engagement trays, ring platters, wedding preservation. Verified 2026-09-16: no catalogue API (Store API 403) but product JSON-LD on every page and a product sitemap; 148 products in a capped run.",
  },

  {
    key: "varmala-preservation",
    name: "Varmala Preservation",
    baseUrl: "https://varmalapreservation.com",
    tier: "MEDIUM_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: false,
    notes:
      "Comparator: a Jaipur studio (Krishna Tower, Ajmer Rd) dedicated to varmala and wedding-flower preservation — frames, planters, LED globes. The deepest Tier 2 catalogue found. Verified 2026-09-18: WooCommerce Store API answers, 643 products, prices ₹299–₹27,499 on page 1, robots.txt allows /wp-json/wc/store/v1/products. Its mass is MEDIUM (324 Flower Preservation Frame · 257 Varmala Preservation · 161 Couple Photo Frame) with a SMALL tail (43 Epoxy Resin Jewelry, 12 keychains) and one LARGE row — so the review inbox's suggested product tier will differ from this source tier on some rows, which is the two-filter inbox working.",
  },
  {
    key: "canvas-by-priya",
    name: "Canvas by Priya",
    baseUrl: "https://canvasbypriya.in",
    tier: "MEDIUM_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: false,
    notes:
      "Comparator: wedding-card and bangle preservation, baby-cord keepsakes, geode wall clocks. Verified 2026-09-18: WooCommerce Store API, 204 products, robots.txt allows the Store API. Filed MEDIUM_FORMAT for its centre of gravity, but it CROSS-FILES — the same catalogue carries ₹16,999–₹24,999 epoxy river tables, which are LARGE_FORMAT pieces. Source tier is where we went looking; the review inbox's suggested product tier is what files each row.",
  },

  // ————————— Source tier SMALL_FORMAT — "Tier 3 sources — Personal Art & Gifting" —————————
  {
    key: "dinosaur-designs",
    name: "Dinosaur Designs",
    baseUrl: "https://www.dinosaurdesigns.com",
    tier: "SMALL_FORMAT",
    vertical: "resin",
    country: "AU",
    platform: "SHOPIFY",
    supply: false,
    enabled: false,
    notes:
      "Reference: resin jewellery to homewares under one premium identity. Verified 2026-09-16: Shopify catalogue API, 331 products (AU brand, foreign prices — the review queue decides what belongs).",
  },
  {
    key: "resin-art-store-india",
    name: "Resin Art Store India",
    baseUrl: "https://resinartstore.in",
    tier: "SMALL_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: false,
    notes:
      "Competitor: rakhi, jewellery, coasters, broad small-product taxonomy. Verified 2026-09-16: WooCommerce Store API, 31 products (pooja thalis, trays, candles).",
  },
  {
    key: "leafy-affair",
    name: "Leafy Affair",
    baseUrl: "https://leafyaffair.com",
    tier: "SMALL_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "SHOPIFY",
    supply: false,
    enabled: false,
    notes:
      "Comparator: preserved real flowers, ferns and dandelion seed set in resin as necklaces, earrings, rings, bookmarks and rakhis — the Tier 3 vocabulary almost item for item. Verified 2026-09-18: Shopify catalogue API, 223 products on the first page, robots.txt allows /products.json.",
  },
  {
    key: "bling-on",
    name: "Bling On",
    baseUrl: "https://blingon.co.in",
    tier: "SMALL_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: false,
    notes:
      "Comparator: the widest Tier 3 assortment found — dried-flower resin earrings, bookmarks and paper clips, pendants, brooches, coaster sets, trinket trays, ₹220–₹1,999. Verified 2026-09-18: WooCommerce Store API, 639 products, robots.txt allows the Store API.",
  },
  {
    key: "sixtin",
    name: "Sixtin",
    baseUrl: "https://www.sixtin.in",
    tier: "SMALL_FORMAT",
    vertical: "resin",
    country: "IN",
    platform: "WOOCOMMERCE",
    supply: false,
    enabled: false,
    notes:
      "Comparator: the low-price end of Tier 3 — resin jhumkas, studs and pendants from ₹160, a Delhi maker with a published workshop address. Verified 2026-09-18: WooCommerce Store API, 85 products, robots.txt allows the Store API.",
  },
];

/**
 * The reference-site rollout (the owner's 2026-09-16 instruction: rebuild the
 * emptied catalogue from the reference sites, ~500 per tier, 75–100 at least).
 * Applied ONCE per source by `prisma/seed-scrape-backlog.ts` through
 * `runReferenceRollout` — see `backlog-rollout.ts` for the three rules that
 * keep it from re-deciding anything a person has decided.
 *
 * Every entry below was verified from this repository's own scraper on
 * 2026-09-16: `fingerprint()` and then a full job, run locally through the
 * same adapters production uses. The evidence is what a reviewer would want
 * on record — what the site itself publishes, and what its robots.txt says.
 */
export const REFERENCE_ROLLOUT: readonly RolloutEntry[] = [
  // The owner's own list first — registered and enabled by the owner on
  // 2026-09-15, and only ever awaiting the policy review the gate demands.
  {
    key: "saashi",
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence:
      "Publishes the WooCommerce Store API; the runner's robots.txt check passed for the site root. A full local run staged 338 products in four pages.",
  },
  {
    key: "leoberry-gifts",
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence:
      "Publishes the WooCommerce Store API; the runner's robots.txt check passed for the site root. A full local run staged 210 products.",
  },
  {
    key: "kanha-kreation",
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence:
      "Publishes the WooCommerce Store API; the runner's robots.txt check passed for the site root. A full local run staged 151 products.",
  },
  {
    key: "woodensure",
    platform: "JSONLD",
    maxProducts: 500,
    evidence:
      "No catalogue API, but every product page carries schema.org Product JSON-LD and the sitemap lists them; the runner's robots.txt check passed. A local run capped at 150 staged 147.",
  },
  {
    key: "resin-arts-jaipur",
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence:
      "Publishes the WooCommerce Store API; the runner's robots.txt check passed for the site root. A full local run staged 22 products.",
  },
  {
    key: "korepox-arts",
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence:
      "Publishes the WooCommerce Store API (/wp-json/wc/store/v1/products); robots.txt disallows only uploads and add-to-cart URLs. A full local run staged its 9 listed tables.",
  },
  {
    key: "resin-art-store-india",
    platform: "WOOCOMMERCE",
    maxProducts: 500,
    evidence:
      "Publishes the WooCommerce Store API; robots.txt disallows only uploads and admin. A full local run staged 31 products (pooja thalis, trays, candles).",
  },
  {
    key: "radhika-art",
    platform: "JSONLD",
    maxProducts: 500,
    evidence:
      "No catalogue API (the Store API answers 403), but every product page carries schema.org Product JSON-LD and the sitemap lists them; robots.txt disallows only cart and orders. A local run capped at 150 staged 148.",
  },
  {
    key: "dinosaur-designs",
    platform: "SHOPIFY",
    maxProducts: 500,
    evidence:
      "Publishes the Shopify catalogue API (/products.json); robots.txt disallows only cart, checkout and admin. A full local run staged 331 products. A design reference with foreign prices — the review queue decides what belongs.",
  },
];

/** Reference sites with NO automated path — filed as manual research, not crawled. */
export const REFERENCE_MANUAL: readonly ManualEntry[] = [
  {
    key: "resinart-in",
    reason:
      "No catalogue API and no product JSON-LD on the pages the fingerprint read.",
  },
  {
    key: "scarlet-splendour",
    reason:
      "Every page answers a Cloudflare challenge to a server-side fetch; the sitemap lists 438 product URLs none of which can be read without a browser.",
  },
  {
    key: "draga-aurel",
    reason:
      "No catalogue API, no schema.org Product on product pages, no recognised markup shape — 18 sitemap pages yielded nothing.",
  },
  {
    key: "materia-aurea",
    reason:
      "WordPress without the WooCommerce Store API (rest_no_route) and no product JSON-LD — a portfolio site, not a shop.",
  },
  {
    key: "within-design",
    reason:
      "A custom Next.js site with no catalogue API, no product JSON-LD and six product URLs in its sitemap.",
  },
  {
    key: "vedumi",
    reason:
      "A custom React site with no catalogue API, no product JSON-LD and no product URLs in its sitemap.",
  },
  {
    key: "the-art-galaxy",
    reason:
      "No catalogue API, no product JSON-LD, and a sitemap of service pages only.",
  },
];
