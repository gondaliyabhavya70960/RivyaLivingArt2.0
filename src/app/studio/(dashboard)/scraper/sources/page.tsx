import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import { PurgeTierButton } from "@/components/studio/scraper/purge-tier";
import {
  SourceList,
  SourceRegistryActions,
  type SourceRow,
  type TierCounts,
} from "@/components/studio/scraper/source-list";
import { ScrapeTier } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { deriveHealth } from "@/lib/scraper/health";
import { applySeedSources } from "@/lib/scraper/seed-sources";

export const metadata: Metadata = { title: "Scrape sources" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ScrapeSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;

  // First visit bootstraps the registry from the curated seed list —
  // seed logic runs directly here, not through the server action.
  if ((await db.scrapeSource.count()) === 0) {
    await applySeedSources();
  }

  const tierFilter =
    tier && tier in ScrapeTier ? (tier as ScrapeTier) : undefined;

  const [sources, grouped, productCounts, pendingCounts, latestJobs] =
    await Promise.all([
      db.scrapeSource.findMany({
        where: tierFilter ? { tier: tierFilter } : undefined,
        orderBy: [{ tier: "asc" }, { name: "asc" }],
      }),
      db.scrapeSource.groupBy({ by: ["tier"], _count: { _all: true } }),
      db.scrapedProduct.groupBy({ by: ["sourceKey"], _count: { _all: true } }),
      db.scrapedProduct.groupBy({
        by: ["sourceKey"],
        where: { reviewStatus: "PENDING" },
        _count: { _all: true },
      }),
      // Latest job per source keyed by the stable sourceKey (NOT the sourceId
      // relation, which is SetNull-nullable). `distinct` + desc order yields
      // the most recent job row per source.
      db.scrapeJob.findMany({
        distinct: ["sourceKey"],
        orderBy: { createdAt: "desc" },
        select: {
          sourceKey: true,
          status: true,
          error: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
    ]);

  const productByKey = new Map(
    productCounts.map((g) => [g.sourceKey, g._count._all]),
  );
  const pendingByKey = new Map(
    pendingCounts.map((g) => [g.sourceKey, g._count._all]),
  );
  const jobByKey = new Map(latestJobs.map((j) => [j.sourceKey, j]));

  const counts: TierCounts = {
    all: 0,
    OWNER: 0,
    RESIN_GOODS: 0,
    SUPPLIES: 0,
    PRINT3D: 0,
  };
  for (const group of grouped) {
    counts[group.tier] = group._count._all;
    counts.all += group._count._all;
  }

  const rows: SourceRow[] = sources.map((source) => {
    const lastJob = jobByKey.get(source.key) ?? null;
    const productCount = productByKey.get(source.key) ?? 0;
    const lastRunDate = lastJob
      ? (lastJob.finishedAt ?? lastJob.createdAt)
      : null;
    return {
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
      verifiedAt: source.verifiedAt
        ? dateFormatter.format(source.verifiedAt)
        : null,
      notes: source.notes,
      health: deriveHealth(
        source.enabled,
        lastJob?.status ?? null,
        productCount,
      ),
      productCount,
      pendingCount: pendingByKey.get(source.key) ?? 0,
      lastStatus: lastJob?.status ?? null,
      lastError: lastJob?.error ?? null,
      lastRunAt: lastRunDate ? dateTimeFormatter.format(lastRunDate) : null,
      lastRunAtTs: lastRunDate ? lastRunDate.getTime() : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Scrape sources"
        description="The research registry — every site the scraper may visit, with its latest scrape status. Click a source to see everything scraped from it."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk removal by tier — sources, their staged products, their
                jobs, their rows in the sheet and, unless the dialog's opt-in
                is unticked, the live catalog products of that tier.

                All three are supplier research, not the shop: tier 2 is other
                artists' resin goods, tier 3 is resin supplies, and tier 4 is
                3D-printing hardware — filament, hot ends, printer parts and
                tweezers, from jollifrogs/west3d/atomic-filament. None of it is
                art. Tier 1 has no button: it is the owner's own catalogue,
                and emptying that is not a bulk action. */}
            <PurgeTierButton tier="RESIN_GOODS" />
            <PurgeTierButton tier="SUPPLIES" />
            <PurgeTierButton tier="PRINT3D" />
            <SourceRegistryActions />
          </div>
        }
      />
      <SourceList sources={rows} counts={counts} />
    </>
  );
}
