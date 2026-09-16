import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import { ShortlistInbox } from "@/components/studio/scraper/shortlist-inbox";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { ShortlistState } from "@/lib/scraper/shortlist";
import { inboxCounts, inboxRows } from "@/lib/scraper/shortlist-query";

export const metadata: Metadata = { title: "Scrape review" };

function parseState(value: string | undefined): ShortlistState | "ALL" {
  if (value === "ALL") return "ALL";
  if (value && value in ShortlistState) return value as ShortlistState;
  return ShortlistState.NEW;
}

export default async function ScrapeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; status?: string; q?: string }>;
}) {
  const { source, status, q } = await searchParams;

  const sourceFilter = source && source !== "ALL" ? source : undefined;
  const stateFilter = parseState(status);
  const filter = { sourceKey: sourceFilter, q: q || undefined };

  const [counts, { rows, truncated, totalMatching }, categories, sourceList] =
    await Promise.all([
      inboxCounts(filter),
      inboxRows(filter, stateFilter),
      db.category.findMany({
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      db.scrapeSource.findMany({
        select: { key: true, name: true },
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
        activeState={stateFilter}
        initialQuery={q ?? ""}
        truncated={truncated}
        totalMatching={totalMatching}
      />
    </>
  );
}
