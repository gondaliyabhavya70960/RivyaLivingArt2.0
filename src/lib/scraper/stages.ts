/**
 * The scraper pipeline's nine stages, sources through confirmed. This is the
 * map an operator holds in their head anyway — a website enters the registry,
 * gets fingerprinted, gets scraped, lands products in staging, clears (or
 * doesn't) the quality screen, gets reviewed, gets approved, gets imported as
 * a draft product, and finally gets confirmed for the sheet. The stage rail
 * makes that map visible instead of requiring five different screens to be
 * remembered in order.
 *
 * Pure module — no database — so `shapeStageCounts` is unit-tested here.
 * The query side (`countScrapeStages`) lives in `stages-server.ts`, the
 * repo's usual split for a registry that a server component then counts
 * against a live database (`site-images.ts` / `site-images-server.ts`,
 * `page-sections.ts` / `page-sections-server.ts`).
 */

export type ScrapeStageKey =
  | "sources"
  | "discovery"
  | "scraping"
  | "staged"
  | "quality"
  | "review"
  | "approved"
  | "imported"
  | "confirmed";

export type ScrapeStageDef = {
  key: ScrapeStageKey;
  label: string;
  /** What the count means, for a title/tooltip. */
  description: string;
  /** Where "see these" leads. */
  href: string;
};

export const SCRAPE_STAGES: readonly ScrapeStageDef[] = [
  {
    key: "sources",
    label: "Sources",
    description: "Websites in the registry.",
    href: "/studio/scraper/sources",
  },
  {
    key: "discovery",
    label: "Discovery",
    description: "Registered but not yet fingerprinted to a platform.",
    href: "/studio/scraper/sources",
  },
  {
    key: "scraping",
    label: "Scraping",
    description: "Jobs queued or running right now.",
    href: "/studio/scraper/runs",
  },
  {
    key: "staged",
    label: "Staged",
    description: "Products landed in the staging table.",
    href: "/studio/scraper/review?status=ALL",
  },
  {
    key: "quality",
    label: "Quality",
    description: "Open or in-review extraction failures.",
    href: "/studio/scraper/quality",
  },
  {
    key: "review",
    label: "Review",
    description: "Staged products awaiting a decision.",
    href: "/studio/scraper/review",
  },
  {
    key: "approved",
    label: "Approved",
    description: "Cleared for import, not yet imported.",
    href: "/studio/scraper/review?status=APPROVED",
  },
  {
    key: "imported",
    label: "Imported",
    description: "Promoted into a draft catalog product.",
    href: "/studio/scraper/review?status=IMPORTED",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    description: "Blessed for the final list.",
    href: "/studio/products",
  },
] as const;

export type ScrapeStageCounts = Record<ScrapeStageKey, number>;

export type ScrapeStage = ScrapeStageDef & { count: number };

/**
 * Pure: pair each stage definition with its count. Missing keys read as
 * zero rather than throwing — a caller mid-refactor of the counts object
 * should see a rail with a zero, not a crashed page.
 */
export function shapeStageCounts(
  raw: Partial<ScrapeStageCounts>,
): ScrapeStage[] {
  return SCRAPE_STAGES.map((stage) => ({
    ...stage,
    count: raw[stage.key] ?? 0,
  }));
}
