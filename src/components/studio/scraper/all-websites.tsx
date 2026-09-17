"use client";

import { useCallback, useMemo, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { EmptyState } from "@/components/studio/page-header";
import { SortHead, useSort } from "@/components/studio/sort-header";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ScrapePlatform, ScrapeTier } from "@/generated/prisma/enums";
import {
  HEALTH_META,
  NEEDS_ATTENTION,
  type SourceHealth,
} from "@/lib/scraper/health";
import { SCRAPE_TIER_SHORT } from "@/lib/scraper/purge";
import { cn } from "@/lib/utils";

export type SourceOverviewRow = {
  id: string;
  key: string;
  name: string;
  host: string;
  baseUrl: string;
  platform: ScrapePlatform;
  tier: ScrapeTier;
  health: SourceHealth;
  productCount: number;
  lastRunAt: string | null;
  lastRunAtTs: number | null;
};

const PLATFORM_BADGE: Record<
  ScrapePlatform,
  "default" | "secondary" | "outline"
> = {
  SHOPIFY: "default",
  WOOCOMMERCE: "secondary",
  JSONLD: "secondary",
  UNKNOWN: "outline",
};

type StatusFilter = "ALL" | "ATTENTION" | SourceHealth;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ATTENTION", label: "Needs attention" },
  { value: "OK", label: "Scraped" },
  { value: "EMPTY", label: "No products" },
  { value: "FAILED", label: "Failed" },
  { value: "NEVER", label: "Not run" },
  { value: "RUNNING", label: "Running" },
  { value: "DISABLED", label: "Disabled" },
];

/**
 * Every website in one page (the Product Scraper command center's exception to
 * 50-per-page pagination). Read-only status overview — filter by health, search
 * by name/URL, sort any column; click through to the source detail page.
 */
export function AllWebsites({ sources }: { sources: SourceOverviewRow[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => {
      if (statusFilter === "ATTENTION" && !NEEDS_ATTENTION.includes(s.health))
        return false;
      if (
        statusFilter !== "ALL" &&
        statusFilter !== "ATTENTION" &&
        s.health !== statusFilter
      )
        return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.baseUrl.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [sources, statusFilter, query]);

  const getValue = useCallback((row: SourceOverviewRow, key: string) => {
    switch (key) {
      case "name":
        return row.name.toLowerCase();
      case "status":
        return HEALTH_META[row.health].rank;
      case "products":
        return row.productCount;
      case "platform":
        return row.platform;
      case "lastRun":
        return row.lastRunAtTs;
      default:
        return null;
    }
  }, []);

  const { sorted, sort, toggle } = useSort(filtered, getValue, {
    key: "status",
    dir: "asc",
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-foreground">
          All websites{" "}
          <span className="text-sm text-muted-foreground">
            ({sources.length})
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Filter by scrape status"
              className="w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or URL…"
            aria-label="Search websites"
            className="h-9 w-52"
          />
          <span className="text-xs text-muted-foreground">
            {sorted.length} of {sources.length}
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No websites match"
          description="No sources match this status and search — clear the filters to see the rest."
        />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="All websites"
          className="max-h-[32rem] overflow-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <StudioTableHead>
                <SortHead
                  label="Source"
                  sortKey="name"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Products"
                  sortKey="products"
                  sort={sort}
                  onSort={toggle}
                  numeric
                />
                <SortHead
                  label="Platform"
                  sortKey="platform"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Last run"
                  sortKey="lastRun"
                  sort={sort}
                  onSort={toggle}
                />
              </StudioTableHead>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const meta = HEALTH_META[s.health];
                return (
                  <StudioRow key={s.id}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/studio/scraper/sources/${s.key}`}
                        className="font-medium text-foreground hover:text-sapphire-ink hover:underline"
                      >
                        {s.name}
                      </Link>
                      <a
                        href={s.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground hover:text-sapphire-ink"
                      >
                        {s.host}
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {SCRAPE_TIER_SHORT[s.tier]}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn("gap-1.5", meta.className)}
                      >
                        <span
                          aria-hidden
                          className={cn("size-1.5 rounded-full", meta.dot)}
                        />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {s.productCount > 0 ? (
                        <span className="text-foreground">
                          {s.productCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={PLATFORM_BADGE[s.platform]}>
                        {s.platform}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {s.lastRunAt ?? "—"}
                    </td>
                  </StudioRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
