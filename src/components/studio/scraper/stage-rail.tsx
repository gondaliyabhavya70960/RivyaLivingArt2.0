import Link from "next/link";

import { countScrapeStages } from "@/lib/scraper/stages-server";

/**
 * The nine-stage pipeline as one horizontal rail: sources → discovery →
 * scraping → staged → quality → review → approved → imported → confirmed.
 * Server component — one query per stage, run in parallel by
 * `countScrapeStages`. Every cell is a link to the screen that count
 * describes, so the rail doubles as navigation, not just a readout.
 */
export async function ScraperStageRail() {
  const stages = await countScrapeStages();

  return (
    <div
      aria-label="Scraper pipeline stages"
      className="overflow-x-auto rounded-card border border-border bg-card shadow-e1"
    >
      <ol className="flex min-w-max divide-x divide-border">
        {stages.map((stage, i) => (
          <li key={stage.key} className="min-w-[7.5rem] flex-1">
            <Link
              href={stage.href}
              title={stage.description}
              className="flex h-full flex-col gap-1 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              <span className="flex items-center gap-1.5 text-12 font-medium uppercase tracking-wider text-muted-foreground">
                <span aria-hidden className="tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {stage.label}
              </span>
              <span className="font-mono text-xl tabular-nums text-foreground">
                {stage.count.toLocaleString("en-IN")}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
