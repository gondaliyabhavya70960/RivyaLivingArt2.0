import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRICE_BASIS_LABELS } from "@/lib/scraper/price-basis";
import { ANALYTICS_LEAGUE_LABELS } from "@/lib/scraper/leagues";
import {
  explorerPageData,
  type ExplorerFilters,
} from "@/lib/scraper/explorer-query";
import { SHORTLIST_STATE_LABELS } from "@/lib/scraper/shortlist";
import type { AnalyticsLeague } from "@/generated/prisma/enums";
import type { ShortlistState } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Product explorer" };

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function explorerHref(filters: ExplorerFilters, over: Partial<ExplorerFilters>): string {
  const merged = { ...filters, ...over };
  const params = new URLSearchParams();
  if (merged.league !== "ALL") params.set("league", merged.league);
  if (merged.source !== "ALL") params.set("source", merged.source);
  if (merged.state !== "ALL") params.set("state", merged.state);
  if (merged.basis !== "ALL") params.set("basis", merged.basis);
  if (merged.q) params.set("q", merged.q);
  const qs = params.toString();
  return qs ? `/studio/scraper/explorer?${qs}` : "/studio/scraper/explorer";
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant={active ? "default" : "outline"} size="sm">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

const BASES = ["PER_PIECE", "PER_AREA", "STARTING_FROM", "QUOTE_ONLY", "NONE"] as const;

/**
 * The product explorer (A9, plan §6): the researched corpus as one filterable
 * table with raw and normalized values SIDE BY SIDE — what the source said
 * next to what we call it after B6's reference pick and B4's owner aliases.
 * A mapping fix relabels the normalized column without a re-scrape; the raw
 * column never moves.
 */
export default async function ProductExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{
    league?: string;
    source?: string;
    state?: string;
    basis?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const filters: ExplorerFilters = {
    league: params.league ?? "ALL",
    source: params.source ?? "ALL",
    state: params.state ?? "ALL",
    basis: (params.basis ?? "ALL") as ExplorerFilters["basis"],
    q: params.q ?? "",
  };
  const data = await explorerPageData(filters);

  return (
    <>
      <PageHeader
        title="Product explorer"
        description="The researched corpus as one table — what the source said next to what we call it. League, source and state filter in the query; price basis and text filter over the normalized read."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/scraper">Scraper hub</Link>
          </Button>
        }
      />

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            League
          </span>
          <FilterChip
            href={explorerHref(filters, { league: "ALL" })}
            active={filters.league === "ALL"}
          >
            All
          </FilterChip>
          {data.leagues.map((league) => (
            <FilterChip
              key={league}
              href={explorerHref(filters, { league })}
              active={filters.league === league}
            >
              {ANALYTICS_LEAGUE_LABELS[league as AnalyticsLeague]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            State
          </span>
          <FilterChip
            href={explorerHref(filters, { state: "ALL" })}
            active={filters.state === "ALL"}
          >
            All
          </FilterChip>
          {data.states.map((state) => (
            <FilterChip
              key={state}
              href={explorerHref(filters, { state })}
              active={filters.state === state}
            >
              {SHORTLIST_STATE_LABELS[state as ShortlistState]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Price
          </span>
          <FilterChip
            href={explorerHref(filters, { basis: "ALL" })}
            active={filters.basis === "ALL"}
          >
            Any basis
          </FilterChip>
          {BASES.map((basis) => (
            <FilterChip
              key={basis}
              href={explorerHref(filters, { basis })}
              active={filters.basis === basis}
            >
              {basis === "NONE" ? "no price" : PRICE_BASIS_LABELS[basis]}
            </FilterChip>
          ))}
        </div>
        <form
          method="get"
          action="/studio/scraper/explorer"
          className="flex flex-wrap items-center gap-2"
        >
          {filters.league !== "ALL" && (
            <input type="hidden" name="league" value={filters.league} />
          )}
          {filters.state !== "ALL" && (
            <input type="hidden" name="state" value={filters.state} />
          )}
          {filters.basis !== "ALL" && (
            <input type="hidden" name="basis" value={filters.basis} />
          )}
          <select
            name="source"
            defaultValue={filters.source}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            aria-label="Filter by source"
          >
            <option value="ALL">All sources</option>
            {data.sources.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Title contains…"
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
            aria-label="Filter by title text"
          />
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
        </form>
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="Loosen the filters — the corpus itself is staged from the scraper, and every researched product appears here once it exists."
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              showing {data.shown} of {data.considered}
            </span>{" "}
            researched products
            {data.truncated && (
              <> — corpus read capped at the newest {data.considered}</>
            )}
          </p>
          <div className="overflow-x-auto rounded-card border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">League</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="px-3 py-2.5 font-medium">
                    Price — raw → normalized
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    Materials — raw → canonical
                  </th>
                  <th className="px-3 py-2.5 font-medium">Variants</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.researchProductId}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="max-w-56 px-3 py-3">
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
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary">
                        {ANALYTICS_LEAGUE_LABELS[row.league as AnalyticsLeague]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">
                        {SHORTLIST_STATE_LABELS[row.state as ShortlistState]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {row.rawPriceMin === null
                          ? "—"
                          : `₹${inr.format(row.rawPriceMin)}`}
                        {row.rawPriceMax !== null &&
                          row.rawPriceMax !== row.rawPriceMin &&
                          `–₹${inr.format(row.rawPriceMax)}`}
                      </span>
                      <span aria-hidden className="mx-1.5 text-border">→</span>
                      {row.referencePriceMinor === null ? (
                        <span className="text-muted-foreground">
                          {row.priceBasis === "QUOTE_ONLY"
                            ? "quote only"
                            : "—"}
                        </span>
                      ) : (
                        <span
                          className="tabular-nums font-medium text-foreground"
                          title={row.referenceRationale ?? undefined}
                        >
                          ₹{inr.format(row.referencePriceMinor / 100)}
                          {row.priceBasis && (
                            <span className="ml-1 text-muted-foreground">
                              {PRICE_BASIS_LABELS[row.priceBasis]}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="max-w-64 px-3 py-3 text-xs">
                      <span className="text-muted-foreground">
                        {row.rawMaterials ?? "—"}
                      </span>
                      <span aria-hidden className="mx-1.5 text-border">→</span>
                      {row.canonicalMaterials.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-foreground">
                          {row.canonicalMaterials.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-xs">
                      {row.variantCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
