import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import { ShortlistInbox } from "@/components/studio/scraper/shortlist-inbox";
import { Button } from "@/components/ui/button";
import type { ScrapeTier } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { SCRAPE_TIERS } from "@/lib/scraper/purge";
import { ShortlistState } from "@/lib/scraper/shortlist";
import {
  INBOX_SIZE_TIER_FILTERS,
  inboxCounts,
  inboxRows,
  type InboxSizeTierFilter,
} from "@/lib/scraper/shortlist-query";

export const metadata: Metadata = { title: "Scrape review" };

/**
 * The inbox's "Add to catalog" runs `addScrapedToCatalog` in batches from
 * this page, and a mirrored batch fetches up to six images per row before it
 * writes. The default function budget is for a page render, not for that;
 * the cron routes that do the same kind of work declare theirs too.
 */
export const maxDuration = 120;

function parseState(value: string | undefined): ShortlistState | "ALL" {
  if (value === "ALL") return "ALL";
  if (value && value in ShortlistState) return value as ShortlistState;
  return ShortlistState.NEW;
}

function parseSourceTier(value: string | undefined): ScrapeTier | undefined {
  return value && (SCRAPE_TIERS as readonly string[]).includes(value)
    ? (value as ScrapeTier)
    : undefined;
}

function parseSizeTier(
  value: string | undefined,
): InboxSizeTierFilter | undefined {
  return value && (INBOX_SIZE_TIER_FILTERS as readonly string[]).includes(value)
    ? (value as InboxSizeTierFilter)
    : undefined;
}

export default async function ScrapeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    tier?: string;
    size?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const { source, tier, size, status, q } = await searchParams;

  const sourceFilter = source && source !== "ALL" ? source : undefined;
  const sourceTier = parseSourceTier(tier);
  const sizeTier = parseSizeTier(size);
  const stateFilter = parseState(status);
  const filter = {
    sourceKey: sourceFilter,
    sourceTier,
    sizeTier,
    q: q || undefined,
  };

  const [counts, { rows, truncated, totalMatching }, categories, sourceList] =
    await Promise.all([
      inboxCounts(filter),
      inboxRows(filter, stateFilter),
      db.category.findMany({
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      db.scrapeSource.findMany({
        select: { key: true, name: true, tier: true },
        orderBy: { key: "asc" },
      }),
    ]);

  return (
    <>
      <PageHeader
        title="Review inbox"
        description="Every researched product moves through the funnel by hand — New → In review → Shortlisted → Confirmed. Nothing confirms itself, and only Confirmed reaches the export."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper">Back to scraper</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/confirmed">Confirmed products</Link>
            </Button>
          </div>
        }
      />
      <ShortlistInbox
        rows={rows}
        sources={sourceList}
        categories={categories}
        counts={counts}
        activeSource={sourceFilter ?? "ALL"}
        activeSourceTier={sourceTier ?? "ALL"}
        activeSizeTier={sizeTier ?? "ALL"}
        activeState={stateFilter}
        initialQuery={q ?? ""}
        truncated={truncated}
        totalMatching={totalMatching}
      />
    </>
  );
}
