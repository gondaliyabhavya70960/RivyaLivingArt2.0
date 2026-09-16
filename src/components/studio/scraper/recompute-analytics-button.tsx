"use client";

/**
 * The Recompute button for the analytics surface (B8). Explicit by design —
 * no cron recomputes these numbers — so the button reports exactly what the
 * run wrote, and the page's stamps (computedAt · scrapeRunId · versions)
 * change in front of the owner.
 */

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { recomputeScraperAnalytics } from "@/actions/scraper-analytics";
import { Button } from "@/components/ui/button";

export function RecomputeAnalyticsButton() {
  const [pending, startTransition] = useTransition();
  const [lastReport, setLastReport] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      const res = await recomputeScraperAnalytics();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const report = res.data!;
      const summary = `${report.snapshotsWritten} snapshots · ${report.productsScored} products scored (${report.scoreRowsWritten} components)`;
      setLastReport(summary);
      toast.success(`Analytics recomputed — ${summary}.`);
    });

  return (
    <div className="flex items-center gap-3">
      {lastReport && (
        <p className="text-xs text-muted-foreground">{lastReport}</p>
      )}
      <Button onClick={run} disabled={pending} size="sm">
        <RefreshCw className={pending ? "animate-spin" : undefined} />
        {pending ? "Recomputing…" : "Recompute analytics"}
      </Button>
    </div>
  );
}
