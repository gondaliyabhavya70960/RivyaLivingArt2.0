import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import { QualityTriage } from "@/components/studio/scraper/quality-triage";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Data quality" };
export const dynamic = "force-dynamic";

const SAMPLE_TAKE = 8;

/**
 * The validation-failure backlog, grouped by root cause.
 *
 * Grouped by FIELD first, because that is what a backlog of thousands
 * actually is: a handful of causes — one adapter that stopped finding prices,
 * one source that never had descriptions — repeated across every product.
 * Listing them flat would be several thousand rows saying the same thing.
 */
export default async function ScraperQualityPage() {
  const [byField, bySource, openTotal] = await Promise.all([
    db.validationFailure.groupBy({
      by: ["field", "severity"],
      where: { status: "OPEN" },
      _count: { _all: true },
      orderBy: { _count: { field: "desc" } },
    }),
    db.validationFailure.groupBy({
      by: ["sourceKey"],
      where: { status: "OPEN" },
      _count: { _all: true },
      orderBy: { _count: { sourceKey: "desc" } },
      take: 10,
    }),
    db.validationFailure.count({ where: { status: "OPEN" } }),
  ]);

  // A few real examples per field — a count with no example is a number
  // nobody can act on.
  const samples = await Promise.all(
    byField.map(async (group) => {
      const rows = await db.validationFailure.findMany({
        where: { status: "OPEN", field: group.field },
        take: SAMPLE_TAKE,
        orderBy: { createdAt: "desc" },
        select: { id: true, reason: true, sourceKey: true },
      });
      return { field: group.field, rows };
    }),
  );
  const samplesByField = new Map(samples.map((s) => [s.field, s.rows]));

  const groups = byField.map((g) => ({
    field: g.field,
    severity: g.severity,
    count: g._count._all,
    samples: samplesByField.get(g.field) ?? [],
  }));

  return (
    <>
      <PageHeader
        title="Data quality"
        description="Fields a scrape could not extract. These are the same checks that block a product from being confirmed — clearing this backlog is what unblocks the final list."
      />
      <QualityTriage
        groups={groups}
        sources={bySource.map((s) => ({
          sourceKey: s.sourceKey,
          count: s._count._all,
        }))}
        openTotal={openTotal}
      />
    </>
  );
}
