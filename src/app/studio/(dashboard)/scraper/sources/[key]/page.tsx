import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/studio/page-header";
import {
  SourceDetail,
  type DetailProductRow,
  type JobHistoryRow,
  type SourceInfo,
} from "@/components/studio/scraper/source-detail";
import {
  SourcePolicy,
  type SourcePolicyInfo,
} from "@/components/studio/scraper/source-policy";
import { describeUnauthorizedRun } from "@/lib/scraper/policy";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { matchCategoryId } from "@/lib/scraper/category-map";
import { describePriceMove } from "@/lib/scraper/price-history";
import { deriveHealth } from "@/lib/scraper/health";

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});
const inr = new Intl.NumberFormat("en-IN");

/** Cap on staged rows rendered on the detail page (a working view, not a dump). */
const PRODUCT_CAP = 500;
const JOB_CAP = 50;

/** Deduped lookup so generateMetadata + the page share one query. */
const getSource = cache((key: string) =>
  db.scrapeSource.findUnique({ where: { key } }),
);

const firstString = (value: unknown): string | null =>
  Array.isArray(value)
    ? (value.find((v): v is string => typeof v === "string") ?? null)
    : null;

function priceLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min !== max) {
    return `₹${inr.format(min)} – ₹${inr.format(max)}`;
  }
  return `₹${inr.format((min ?? max) as number)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const source = await getSource(key);
  return { title: source ? `${source.name} · Scraper` : "Source not found" };
}

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const source = await getSource(key);
  if (!source) notFound();

  const [jobs, products, productCount, categories] = await Promise.all([
    db.scrapeJob.findMany({
      where: { sourceKey: key },
      orderBy: { createdAt: "desc" },
      take: JOB_CAP,
    }),
    db.scrapedProduct.findMany({
      where: { sourceKey: key },
      orderBy: { lastSeen: "desc" },
      take: PRODUCT_CAP,
    }),
    db.scrapedProduct.count({ where: { sourceKey: key } }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const lastJob = jobs[0] ?? null;

  const info: SourceInfo = {
    id: source.id,
    key: source.key,
    name: source.name,
    baseUrl: source.baseUrl,
    tier: source.tier,
    vertical: source.vertical,
    country: source.country,
    platform: source.platform,
    supply: source.supply,
    enabled: source.enabled,
    health: deriveHealth(source.enabled, lastJob?.status ?? null, productCount),
    notes: source.notes,
    verifiedAt: source.verifiedAt
      ? dateFormatter.format(source.verifiedAt)
      : null,
    pausedReason: source.pausedReason,
    consecutiveFailures: source.consecutiveFailures,
    policyBlocked: describeUnauthorizedRun(source.name, source),
  };

  // The governance gate's own state, rendered above everything else on the
  // page: whether this source may be collected at all is the question that
  // decides whether the rest of the screen can do anything.
  const policy: SourcePolicyInfo = {
    id: source.id,
    name: source.name,
    collectionMode: source.collectionMode,
    policyReviewStatus: source.policyReviewStatus,
    policyReviewedAt: source.policyReviewedAt
      ? dateFormatter.format(source.policyReviewedAt)
      : null,
    policyReviewedBy: source.policyReviewedBy,
    policyReviewNote: source.policyReviewNote,
  };

  const jobRows: JobHistoryRow[] = jobs.map((job) => ({
    id: job.id,
    status: job.status,
    platform: job.platform,
    cursorPage: job.cursorPage,
    totalScraped: job.totalScraped,
    newCount: job.newCount,
    updatedCount: job.updatedCount,
    error: job.error,
    createdAt: dateTimeFormatter.format(job.createdAt),
    createdAtTs: job.createdAt.getTime(),
    finishedAt: job.finishedAt
      ? dateTimeFormatter.format(job.finishedAt)
      : null,
  }));

  // Latest two price points per staged row — enough to say what moved, in one
  // query for the page rather than one per product.
  const priceRows = await db.priceHistory.findMany({
    where: { scrapedProductId: { in: products.map((p) => p.id) } },
    orderBy: { capturedAt: "desc" },
    select: {
      scrapedProductId: true,
      priceMin: true,
      priceMax: true,
      capturedAt: true,
    },
  });
  const pointsByProduct = new Map<string, typeof priceRows>();
  for (const point of priceRows) {
    if (!point.scrapedProductId) continue;
    const list = pointsByProduct.get(point.scrapedProductId) ?? [];
    if (list.length < 2) list.push(point);
    pointsByProduct.set(point.scrapedProductId, list);
  }

  const productRows: DetailProductRow[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    image: firstString(p.images),
    category: p.category,
    // Auto-map the free-text source category to the nearest catalog category;
    // the operator can override it per-row in the list before importing.
    mappedCategoryId: matchCategoryId(p.category, p.title, categories),
    priceLabel: priceLabel(p.priceMin, p.priceMax),
    priceSort: p.priceMin ?? p.priceMax ?? null,
    priceMove: (() => {
      // [latest, previous] — a series with one point has never moved.
      const points = pointsByProduct.get(p.id) ?? [];
      if (points.length < 2) return null;
      return describePriceMove(points[1], points[0]);
    })(),
    reviewStatus: p.reviewStatus,
    lastSeen: dateTimeFormatter.format(p.lastSeen),
    lastSeenTs: p.lastSeen.getTime(),
  }));

  return (
    <>
      <PageHeader
        title={source.name}
        description="Everything scraped from this source — run history and staged products."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/studio/scraper/sources">
                <ArrowLeft /> All sources
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/studio/scraper/review?source=${source.key}`}>
                Review queue
              </Link>
            </Button>
          </div>
        }
      />
      <SourcePolicy source={policy} />
      <SourceDetail
        source={info}
        jobs={jobRows}
        products={productRows}
        totalProducts={productCount}
        categories={categories}
      />
    </>
  );
}
