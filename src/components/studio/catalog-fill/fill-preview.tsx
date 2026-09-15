"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Search } from "lucide-react";
import { toast } from "sonner";

import { previewCatalogFill, runCatalogFillNow } from "@/actions/catalog-fill";
import { DroppedRows } from "@/components/studio/catalog-fill/dropped-rows";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TierFillResult } from "@/lib/import/tier-fill";

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <span className="tabular-nums text-foreground">
        {value.toLocaleString("en-IN")}
      </span>
    </span>
  );
}

function ResultSummary({ result }: { result: TierFillResult }) {
  if (result.aborted) {
    return (
      <div className="rounded-card border border-alert/40 bg-alert/5 p-4 text-sm">
        <p className="font-medium text-foreground">Refused — nothing written</p>
        <p className="mt-1 text-muted-foreground">{result.aborted.reason}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatChip label="created" value={result.totals.created} />
        <StatChip label="updated" value={result.totals.updated} />
        <StatChip label="unchanged" value={result.totals.unchanged} />
        <StatChip label="failed" value={result.totals.failed} />
        {result.conflictsDetected > 0 && (
          <StatChip
            label="conflicts flagged"
            value={result.conflictsDetected}
          />
        )}
      </div>
      <DroppedRows dropped={result.dropped} />
    </div>
  );
}

/**
 * Preview / Run now — the studio's own trigger for the four-tier fill,
 * beside the deploy-time one. Preview always runs (dryRun, nothing written,
 * allowed even with the master switch off); Run now honours it and the
 * blast-radius cap exactly as a deploy would.
 */
export function FillPreview() {
  const router = useRouter();
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<TierFillResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<TierFillResult | null>(null);

  async function handlePreview() {
    setPreviewing(true);
    setRunResult(null);
    const res = await previewCatalogFill();
    setPreviewing(false);
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "Could not preview the fill.");
      return;
    }
    setPreview(res.data);
    if (res.data.aborted) {
      toast.warning(res.data.aborted.reason);
    }
  }

  async function handleRun() {
    setRunning(true);
    const res = await runCatalogFillNow();
    setRunning(false);
    setConfirmOpen(false);
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "The fill could not run.");
      return;
    }
    setRunResult(res.data);
    setPreview(null);
    const { created, updated } = res.data.totals;
    toast.success(
      `Fill finished — ${created} created, ${updated} updated.` +
        (res.data.conflictsWritten > 0
          ? ` ${res.data.conflictsWritten} conflict(s) recorded for review.`
          : ""),
    );
    router.refresh();
  }

  const plannedCreates =
    preview && !preview.aborted ? preview.totals.created : 0;

  return (
    <section className="rounded-card border border-border bg-card p-5 shadow-e1">
      <h2 className="font-medium text-foreground">Run the fill now</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Same pipeline the next deploy will run — preview it first, or run it
        immediately without waiting for a deploy.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={previewing}
        >
          {previewing ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Previewing…
            </>
          ) : (
            <>
              <Search /> Preview
            </>
          )}
        </Button>
        <Button
          size="sm"
          disabled={running}
          onClick={() => setConfirmOpen(true)}
        >
          <Play /> Run now
        </Button>
      </div>

      {preview && (
        <div className="mt-5">
          <ResultSummary result={preview} />
        </div>
      )}
      {runResult && (
        <div className="mt-5">
          <ResultSummary result={runResult} />
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Run the fill now?</DialogTitle>
            <DialogDescription>
              This writes to the catalog immediately — the same import the next
              deploy would run, just not waiting for it.
              {preview && !preview.aborted && plannedCreates > 0
                ? ` The last preview showed ${plannedCreates} new product${plannedCreates === 1 ? "" : "s"}.`
                : " Preview first if you want to see what it would do."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={running}
            >
              Cancel
            </Button>
            <Button onClick={handleRun} disabled={running}>
              {running ? "Running…" : "Run now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
