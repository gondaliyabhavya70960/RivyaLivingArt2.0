/**
 * Source-health model — shared by the sources status table and the per-source
 * detail page. Pure data (no db / server-only), so both server pages and
 * client components import it. A source's health is derived from its latest
 * scrape job plus how many products it has actually staged.
 */
import type { ScrapeJobStatus } from "@/generated/prisma/enums";

export type SourceHealth =
  | "OK" // last run DONE and we have staged products
  | "EMPTY" // last run DONE but zero products came back
  | "FAILED" // last run FAILED
  | "RUNNING" // a run is queued or in progress
  | "NEVER" // never scraped
  | "DISABLED"; // toggled off in the registry

/**
 * Derive health from the enabled flag, the latest job status (null = never
 * run) and the total staged product count for the source.
 */
export function deriveHealth(
  enabled: boolean,
  lastStatus: ScrapeJobStatus | null,
  productCount: number,
): SourceHealth {
  if (!enabled) return "DISABLED";
  if (!lastStatus) return "NEVER";
  if (lastStatus === "QUEUED" || lastStatus === "RUNNING") return "RUNNING";
  if (lastStatus === "FAILED") return "FAILED";
  return productCount > 0 ? "OK" : "EMPTY";
}

export type HealthMeta = {
  label: string;
  /** Badge className (variant="outline" base + tone). */
  className: string;
  /** Status-dot className. */
  dot: string;
  /** Sort/attention rank — lower = more urgent, so "needs attention" first. */
  rank: number;
};

export const HEALTH_META: Record<SourceHealth, HealthMeta> = {
  FAILED: {
    label: "Failed",
    className: "border-destructive/40 text-destructive",
    dot: "bg-destructive",
    rank: 0,
  },
  EMPTY: {
    label: "No products",
    className: "border-warning/40 text-warning",
    dot: "bg-warning",
    rank: 1,
  },
  NEVER: {
    label: "Not run",
    className: "border-foreground/20 text-muted-foreground",
    dot: "bg-muted-foreground/40",
    rank: 2,
  },
  RUNNING: {
    label: "Running",
    className: "border-sapphire/40 text-sapphire",
    dot: "bg-sapphire",
    rank: 3,
  },
  OK: {
    label: "Scraped",
    className: "border-success/40 text-success",
    dot: "bg-success",
    rank: 4,
  },
  DISABLED: {
    label: "Disabled",
    className: "border-foreground/15 text-muted-foreground",
    dot: "bg-muted-foreground/30",
    rank: 5,
  },
};

/** Health buckets the operator most wants to see — "why didn't this scrape?" */
export const NEEDS_ATTENTION: SourceHealth[] = ["FAILED", "EMPTY", "NEVER"];
