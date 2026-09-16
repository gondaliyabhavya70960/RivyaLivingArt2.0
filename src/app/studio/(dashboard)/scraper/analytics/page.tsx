import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { RecomputeAnalyticsButton } from "@/components/studio/scraper/recompute-analytics-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_VERSION,
  EXCLUSION_LABELS,
  type ComputedFrom,
  type PriceStats,
} from "@/lib/scraper/analytics";
import {
  analyticsPageData,
  type BenchmarkView,
} from "@/lib/scraper/analytics-query";
import {
  COMPARISON_SCOPE_LABELS,
  type ComparisonScope,
} from "@/lib/scraper/comparison-scopes";
import {
  ANALYTICS_LEAGUE_DESCRIPTIONS,
  ANALYTICS_LEAGUE_LABELS,
} from "@/lib/scraper/leagues";
import type { AnalyticsLeague } from "@/generated/prisma/enums";
import { SCRAPER_NORMALIZER_VERSION } from "@/lib/scraper/normalize";
import {
  OPPORTUNITY_COMPONENT_DESCRIPTIONS,
  OPPORTUNITY_COMPONENT_LABELS,
} from "@/lib/scraper/opportunity";
import {
  SHORTLIST_STATE_LABELS,
  SHORTLIST_STATE_ORDER,
  ShortlistState,
} from "@/lib/scraper/shortlist";

export const metadata: Metadata = { title: "Scraper analytics" };

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMinor(minor: number | null): string {
  return minor === null ? "—" : `₹${inr.format(minor / 100)}`;
}

/** The B8 proof, rendered as one honest sentence per benchmark. */
function ComputedFromLine({ computedFrom }: { computedFrom: ComputedFrom }) {
  const exclusions = (
    Object.entries(computedFrom.exclusions) as [
      keyof ComputedFrom["exclusions"],
      number,
    ][]
  ).filter(([, n]) => n > 0);
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        computed from {computedFrom.included} of {computedFrom.considered}
      </span>{" "}
      rows
      {exclusions.length > 0 && (
        <>
          {" — excluded: "}
          {exclusions.map(([reason, n]) => `${n} ${EXCLUSION_LABELS[reason]}`).join("; ")}
        </>
      )}
    </p>
  );
}

function StatsCells({ stats }: { stats: PriceStats }) {
  return (
    <>
      <td className="px-3 py-3 tabular-nums">{formatMinor(stats.minMinor)}</td>
      <td className="px-3 py-3 tabular-nums">{formatMinor(stats.p25Minor)}</td>
      <td className="px-3 py-3 tabular-nums font-medium text-foreground">
        {formatMinor(stats.medianMinor)}
      </td>
      <td className="px-3 py-3 tabular-nums">{formatMinor(stats.p75Minor)}</td>
      <td className="px-3 py-3 tabular-nums">{formatMinor(stats.maxMinor)}</td>
    </>
  );
}

function BenchmarkTable({
  title,
  description,
  rows,
  showSource,
}: {
  title: string;
  description: string;
  rows: BenchmarkView[];
  showSource: boolean;
}) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) =>
    `${a.key.league} ${a.key.scope} ${a.key.sourceKey}`.localeCompare(
      `${b.key.league} ${b.key.scope} ${b.key.sourceKey}`,
    ),
  );
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">League</th>
              {showSource && <th className="px-3 py-2.5 font-medium">Source</th>}
              <th className="px-3 py-2.5 font-medium">Scope</th>
              <th className="px-3 py-2.5 font-medium">Min</th>
              <th className="px-3 py-2.5 font-medium">P25</th>
              <th className="px-3 py-2.5 font-medium">Median</th>
              <th className="px-3 py-2.5 font-medium">P75</th>
              <th className="px-3 py-2.5 font-medium">Max</th>
              <th className="px-3 py-2.5 font-medium">Computed from</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={`${row.key.view}|${row.key.league}|${row.key.scope}|${row.key.sourceKey}`}
                className="border-b border-border/60 align-top last:border-0"
              >
                <td className="px-3 py-3">
                  <Badge variant="secondary">
                    {ANALYTICS_LEAGUE_LABELS[row.key.league as AnalyticsLeague]}
                  </Badge>
                </td>
                {showSource && (
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.key.sourceKey}
                  </td>
                )}
                <td className="px-3 py-3 text-xs">
                  {COMPARISON_SCOPE_LABELS[row.key.scope as ComparisonScope]}
                </td>
                <StatsCells stats={row.payload.stats} />
                <td className="max-w-md px-3 py-3">
                  <ComputedFromLine computedFrom={row.payload.computedFrom} />
                  {row.payload.picksTruncated && (
                    <p className="text-xs text-muted-foreground/80">
                      stored working capped; counts are over the full set
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FunnelSection({
  states,
  computedFrom,
}: {
  states: Record<ShortlistState, number>;
  computedFrom: ComputedFrom;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Funnel overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Where the researched corpus stands — a count per state, nothing
          averaged.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SHORTLIST_STATE_ORDER.map((state) => (
          <Badge key={state} variant="outline" className="gap-1.5">
            {SHORTLIST_STATE_LABELS[state]}
            <span className="tabular-nums font-semibold">{states[state]}</span>
          </Badge>
        ))}
      </div>
      <ComputedFromLine computedFrom={computedFrom} />
    </section>
  );
}

/**
 * The B8 surface: every benchmark shows its working (`computed from X of N`
 * with named exclusions), and every opportunity is its four components —
 * never a lone score. Numbers are precomputed snapshots, refreshed only by
 * the explicit Recompute action; the stamps say exactly what was read.
 */
export default async function ScraperAnalyticsPage() {
  const data = await analyticsPageData();

  return (
    <>
      <PageHeader
        title="Scraper analytics"
        description="League benchmarks and opportunity components over the researched corpus. Every number carries its computed-from-X-of-N accounting; every score is its components."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper">Scraper hub</Link>
            </Button>
            <RecomputeAnalyticsButton />
          </div>
        }
      />

      {!data.computedAt ? (
        <EmptyState
          title="Nothing computed yet"
          description="Run Recompute analytics to build the league benchmarks and opportunity components from the current corpus. Nothing recomputes on its own — the numbers change when you ask them to."
        />
      ) : (
        <div className="space-y-8">
          <p className="text-xs text-muted-foreground">
            Computed {dateFormatter.format(data.computedAt)}
            {data.scrapeRunId ? ` · against scrape run ${data.scrapeRunId}` : ""}
            {` · normalizer ${data.normalizerVersion ?? SCRAPER_NORMALIZER_VERSION} · analytics v${data.analyticsVersion ?? ANALYTICS_VERSION}`}
          </p>

          {data.funnel && (
            <FunnelSection
              states={data.funnel.states}
              computedFrom={data.funnel.computedFrom}
            />
          )}

          <BenchmarkTable
            title="League price benchmarks"
            description={ANALYTICS_LEAGUE_DESCRIPTIONS.FINISHED_ART}
            rows={data.leagueBenchmarks}
            showSource={false}
          />

          <BenchmarkTable
            title="Per-source benchmarks"
            description="One supplier's arena at a time — the same scopes, narrowed to a single source, never across leagues."
            rows={data.sourceBenchmarks}
            showSource
          />

          <section className="space-y-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Opportunity components
              </h2>
              <p className="text-sm text-muted-foreground">
                Shortlisted and confirmed products, ranked by Σ contribution —
                the score is its four components, each with its working.
              </p>
            </div>
            {data.staleScoresPrunedOnNextRun > 0 && (
              <p className="text-xs text-muted-foreground">
                {data.staleScoresPrunedOnNextRun} scored product(s) have left
                the funnel since the last recompute; their rows are pruned on
                the next run.
              </p>
            )}
            {data.opportunities.length === 0 ? (
              <EmptyState
                title="Nothing scored"
                description="Only shortlisted and confirmed products are scored — shortlist products in the review inbox, then recompute."
              />
            ) : (
              <div className="space-y-4">
                {data.opportunities.map((row) => (
                  <div
                    key={row.researchProductId}
                    className="rounded-card border border-border bg-card p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:underline"
                        >
                          {row.title}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {row.sourceName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {SHORTLIST_STATE_LABELS[row.state]}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          Σ {row.total.toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {row.components.map((c) => (
                        <div
                          key={c.component}
                          className="rounded-lg bg-muted/50 p-3"
                          title={OPPORTUNITY_COMPONENT_DESCRIPTIONS[c.component]}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-xs font-medium text-foreground">
                              {OPPORTUNITY_COMPONENT_LABELS[c.component]}
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {c.value === null ? "n/a" : c.value.toFixed(2)}
                              {` × ${c.weight}`}
                            </p>
                          </div>
                          <div
                            aria-hidden
                            className="my-2 h-1.5 overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className="h-full rounded-full bg-sapphire-ink"
                              style={{
                                width: `${Math.round((c.value ?? 0) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {c.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
