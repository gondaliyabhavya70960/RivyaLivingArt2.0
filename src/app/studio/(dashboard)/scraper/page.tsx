import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import {
  AllWebsites,
  type SourceOverviewRow,
} from "@/components/studio/scraper/all-websites";
import {
  JobDashboard,
  type JobRow,
  type TierCounts,
} from "@/components/studio/scraper/job-dashboard";
import {
  ScraperKpis,
  type ScraperKpiData,
} from "@/components/studio/scraper/scraper-kpis";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { deriveHealth } from "@/lib/scraper/health";

export const metadata: Metadata = { title: "Market Intelligence Studio" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Recent-jobs feed depth (paginated 50/page client-side). */
const RECENT_JOBS = 200;

export default async function ScraperPage() {
  const [
    sources,
    jobs,
    tierGroups,
    productCounts,
    liveSheetCounts,
    pendingTotal,
    stagedTotal,
    latestJobs,
  ] = await Promise.all([
    db.scrapeSource.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] }),
    db.scrapeJob.findMany({ orderBy: { createdAt: "desc" }, take: RECENT_JOBS }),
    db.scrapeSource.groupBy({
      by: ["tier"],
      where: { enabled: true, platform: { not: "UNKNOWN" } },
      _count: { _all: true },
    }),
    db.scrapedProduct.groupBy({ by: ["sourceKey"], _count: { _all: true } }),
    // Live catalog fed by the sheet pipeline (audit H6) — the banner below
    // reconciles this center's staging-only counters with reality.
    db.product.groupBy({
      by: ["importSource"],
      where: { importSource: { startsWith: "sheet:" }, status: "PUBLISHED" },
      _count: { _all: true },
    }),
    db.scrapedProduct.count({ where: { reviewStatus: "PENDING" } }),
    db.scrapedProduct.count(),
    db.scrapeJob.findMany({
      distinct: ["sourceKey"],
      orderBy: { createdAt: "desc" },
      select: { sourceKey: true, status: true, createdAt: true, finishedAt: true },
    }),
  ]);

  const productByKey = new Map(
    productCounts.map((g) => [g.sourceKey, g._count._all]),
  );
  const jobByKey = new Map(latestJobs.map((j) => [j.sourceKey, j]));

  // Per-source health drives both the KPI tallies and the all-websites table.
  const overview: SourceOverviewRow[] = [];
  let scraped = 0;
  let failed = 0;
  let notRun = 0;
  let empty = 0;
  let enabled = 0;
  for (const s of sources) {
    if (s.enabled) enabled += 1;
    const lastJob = jobByKey.get(s.key) ?? null;
    const productCount = productByKey.get(s.key) ?? 0;
    const health = deriveHealth(s.enabled, lastJob?.status ?? null, productCount);
    if (health === "OK") scraped += 1;
    else if (health === "FAILED") failed += 1;
    else if (health === "NEVER") notRun += 1;
    else if (health === "EMPTY") empty += 1;
    const lastRunDate = lastJob ? (lastJob.finishedAt ?? lastJob.createdAt) : null;
    overview.push({
      id: s.id,
      key: s.key,
      name: s.name,
      host: s.baseUrl.replace(/^https?:\/\//, ""),
      baseUrl: s.baseUrl,
      platform: s.platform,
      tier: s.tier,
      health,
      productCount,
      lastRunAt: lastRunDate ? dateFormatter.format(lastRunDate) : null,
      lastRunAtTs: lastRunDate ? lastRunDate.getTime() : null,
    });
  }

  const kpis: ScraperKpiData = {
    websites: sources.length,
    enabled,
    scraped,
    failed,
    notRun,
    empty,
    staged: stagedTotal,
    pending: pendingTotal,
  };

  const tierCounts: TierCounts = {
    OWNER: 0,
    RESIN_GOODS: 0,
    SUPPLIES: 0,
    PRINT3D: 0,
  };
  for (const group of tierGroups) {
    tierCounts[group.tier] = group._count._all;
  }

  const jobRows: JobRow[] = jobs.map((job) => ({
    id: job.id,
    sourceName: job.sourceName,
    sourceKey: job.sourceKey,
    platform: job.platform,
    status: job.status,
    cursorPage: job.cursorPage,
    totalScraped: job.totalScraped,
    newCount: job.newCount,
    updatedCount: job.updatedCount,
    error: job.error,
    createdAt: dateFormatter.format(job.createdAt),
    createdAtTs: job.createdAt.getTime(),
    finishedAt: job.finishedAt ? dateFormatter.format(job.finishedAt) : null,
    sheetSynced: job.sheetSynced,
  }));

  return (
    <>
      <PageHeader
        title="Market Intelligence Studio"
        description="Your scraping command center — every website's status at a glance, plus the review queue and registry. Research reference only; imports stay locked behind the needs-rewrite guard until rewritten."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/sources">Source registry</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/mapping">Category mapping</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/review">Review queue</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/quality">Data quality</Link>
            </Button>
          </>
        }
      />
      {liveSheetCounts.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-muted p-4 text-sm text-foreground/80">
          <p>
            The live catalog is fed by the{" "}
            <Link
              href="/studio/sheet-import"
              className="font-medium text-sapphire-ink hover:underline"
            >
              Sheet Import
            </Link>{" "}
            —{" "}
            <span className="font-medium text-foreground">
              {liveSheetCounts
                .reduce((a, g) => a + g._count._all, 0)
                .toLocaleString("en-IN")}{" "}
              published products
            </span>{" "}
            across {liveSheetCounts.length} of the sources below. This center
            stages separate research scrapes; its counters are staging-only and
            do not reflect the live catalog.
          </p>
        </div>
      )}
      <div className="space-y-6">
        <ScraperKpis kpis={kpis} />
        <JobDashboard jobs={jobRows} tierCounts={tierCounts} />
        <AllWebsites sources={overview} />
      </div>
    </>
  );
}
