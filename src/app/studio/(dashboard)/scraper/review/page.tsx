import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import {
  ReviewGrid,
  type ReviewCounts,
  type ScrapedRow,
} from "@/components/studio/scraper/review-grid";
import { Button } from "@/components/ui/button";
import type { Prisma } from "@/generated/prisma/client";
import { ReviewStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Scrape review" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Hard cap per view — the truncation note points at the filters. */
const PAGE_SIZE = 200;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export default async function ScrapeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; status?: string; q?: string }>;
}) {
  const { source, status, q } = await searchParams;

  const sourceFilter = source && source !== "ALL" ? source : undefined;
  const statusFilter: ReviewStatus | "ALL" =
    status === "ALL"
      ? "ALL"
      : status && status in ReviewStatus
        ? (status as ReviewStatus)
        : "PENDING";

  // Everything except the status filter — the per-status chip counts
  // describe the current source/search slice.
  const baseWhere: Prisma.ScrapedProductWhereInput = {
    ...(sourceFilter ? { sourceKey: sourceFilter } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [sourceGroups, statusGroups, staged, categories, sourceList] =
    await Promise.all([
      db.scrapedProduct.groupBy({
        by: ["sourceKey"],
        orderBy: { sourceKey: "asc" },
      }),
      db.scrapedProduct.groupBy({
        by: ["reviewStatus"],
        where: baseWhere,
        _count: { _all: true },
      }),
      db.scrapedProduct.findMany({
        where: {
          ...baseWhere,
          ...(statusFilter === "ALL" ? {} : { reviewStatus: statusFilter }),
        },
        orderBy: { lastSeen: "desc" },
        take: PAGE_SIZE,
      }),
      db.category.findMany({
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      db.scrapeSource.findMany({ select: { key: true, name: true } }),
    ]);

  // Map each source key → its human website name (e.g. "sumaiyaresin.art").
  const sourceNameByKey = new Map(sourceList.map((s) => [s.key, s.name]));
  const sourceName = (key: string) => sourceNameByKey.get(key) ?? key;

  const counts: ReviewCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    IMPORTED: 0,
  };
  for (const group of statusGroups) {
    counts[group.reviewStatus] = group._count._all;
  }
  const totalMatching =
    statusFilter === "ALL"
      ? counts.PENDING + counts.APPROVED + counts.REJECTED + counts.IMPORTED
      : counts[statusFilter];

  const rows: ScrapedRow[] = staged.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    url: row.url,
    sourceKey: row.sourceKey,
    sourceName: sourceName(row.sourceKey),
    vertical: row.vertical,
    category: row.category,
    shortTagline: row.shortTagline,
    description: row.description,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    timeline: row.timeline,
    materials: row.materials,
    dimensions: row.dimensions,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    images: toStringArray(row.images),
    imageAlts: toStringArray(row.imageAlts),
    reviewStatus: row.reviewStatus,
    updated: row.lastSeen.getTime() > row.firstSeen.getTime(),
    firstSeen: dateFormatter.format(row.firstSeen),
    lastSeen: dateFormatter.format(row.lastSeen),
  }));

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Approve scraped reference products, then import them as locked drafts — nothing publishes until it is rewritten as original ResinRiva content."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/scraper">Back to scraper</Link>
          </Button>
        }
      />
      <ReviewGrid
        rows={rows}
        sources={sourceGroups.map((group) => ({
          key: group.sourceKey,
          name: sourceName(group.sourceKey),
        }))}
        categories={categories}
        counts={counts}
        activeSource={sourceFilter ?? "ALL"}
        activeStatus={statusFilter}
        initialQuery={q ?? ""}
        truncated={totalMatching > rows.length}
      />
    </>
  );
}
