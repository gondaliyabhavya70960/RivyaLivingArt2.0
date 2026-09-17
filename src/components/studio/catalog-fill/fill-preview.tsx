"use client";

import { Fragment, useState } from "react";
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
import { importListLabel, importListOf } from "@/lib/import-list";
import type {
  TierFillResult,
  TierFillSizeTierTally,
} from "@/lib/import/tier-fill";
import { PRODUCT_SIZE_TIERS, SIZE_TIER_SHORT } from "@/lib/product-size-tier";

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <span className="font-mono tabular-nums text-foreground">
        {value.toLocaleString("en-IN")}
      </span>
    </span>
  );
}

/**
 * "12 Collectible · 40 Memory · 3 Personal · 118 none" — how one list's rows
 * would file into the three PRODUCT tiers, every number mono. The words are
 * `SIZE_TIER_SHORT`, never typed here; "none" is the rows the rule declines
 * (supplies, and rows whose words say nothing about form). The catalog-fill
 * page's table renders this same component for the last recorded run, so
 * the preview and the record read identically.
 */
export function SizeTierSplit({ tally }: { tally: TierFillSizeTierTally }) {
  // Each "N Tier" pair is unbreakable and the line wraps only at the
  // separators: the whole line is ~320px at text-xs, wider than the preview
  // card's inner width on a 390px phone.
  return (
    <span>
      {PRODUCT_SIZE_TIERS.map((tier) => (
        <Fragment key={tier}>
          <span className="whitespace-nowrap">
            <span className="font-mono tabular-nums text-foreground">
              {tally[tier].toLocaleString("en-IN")}
            </span>{" "}
            {SIZE_TIER_SHORT[tier]}
          </span>
          {" · "}
        </Fragment>
      ))}
      <span className="whitespace-nowrap">
        <span className="font-mono tabular-nums text-foreground">
          {tally.NONE.toLocaleString("en-IN")}
        </span>{" "}
        none
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
  // One line per import list the run read, in the fill's own order. The key
  // is the frozen file stem; the label is the list's name.
  const lists = Object.entries(result.runSummary);
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
      {lists.length > 0 && (
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Would file as</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The product tier each list&rsquo;s rows would take, by the rule the
            deploy-time pass and Suggest tiers use — the category first, then
            the row&rsquo;s own words. Supplies stay untiered. The fill itself
            sets no tier.
          </p>
          <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {lists.map(([tab, summary]) => {
              const list = importListOf(summary.tier);
              return (
                <div
                  key={tab}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                >
                  <dt className="text-foreground">
                    {list ? importListLabel(list) : tab}
                  </dt>
                  <dd>
                    <SizeTierSplit tally={summary.sizeTiers} />
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
      <DroppedRows
        dropped={result.dropped}
        byReason={result.droppedByReason}
        total={result.droppedTotal}
      />
    </div>
  );
}

/**
 * Preview / Run now — the studio's own trigger for the four-list fill,
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
