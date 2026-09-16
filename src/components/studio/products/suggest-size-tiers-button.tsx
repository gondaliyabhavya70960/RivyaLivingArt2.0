"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { suggestSizeTiersForBacklog } from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NAME,
  type ProductSizeTier,
} from "@/lib/product-size-tier";

type Report = {
  scanned: number;
  total: number;
  byTier: Record<ProductSizeTier, number>;
  skipped: { supplies: number; unsure: number };
  samples: Record<ProductSizeTier, string[]>;
};

const formatCount = (n: number) => n.toLocaleString("en-IN");

/**
 * The backlog, filed by rule — docs/plan/07 step 3 for a catalogue too big
 * to tier a row at a time. Two steps, so the person sees the plan before
 * anything is written: the button reads the untiered rows and shows how
 * many would be filed where, with sample titles; **File** writes exactly
 * that. The rule and its reasons live in `src/lib/catalog-size-tier.ts`;
 * the same plan runs on every production deploy for rows the CSV fill
 * creates, and never touches a row a person has edited.
 */
export function SuggestSizeTiersButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  // The trigger is not a DialogTrigger (it runs a Server Action before the
  // dialog can open), so focus return is done by hand — and the trigger is
  // never DISABLED while it waits: a disabled button drops focus to <body>,
  // which is where Radix would otherwise send it back on close.
  const trigger = useRef<HTMLButtonElement>(null);

  async function preview() {
    if (busy) return;
    setBusy(true);
    const result = await suggestSizeTiersForBacklog("preview");
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReport(result.data ?? null);
    setOpen(true);
  }

  async function apply() {
    setBusy(true);
    const result = await suggestSizeTiersForBacklog("apply");
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const filed = result.data?.total ?? 0;
    setOpen(false);
    setReport(null);
    toast.success(
      filed === 0
        ? "Nothing to file — every product with a confident suggestion already has a tier."
        : `Filed ${formatCount(filed)} product${filed === 1 ? "" : "s"} by rule. The "No tier yet" filter shows what is left for a person.`,
    );
    router.refresh();
  }

  const left = report ? report.skipped.supplies + report.skipped.unsure : 0;

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        onClick={() => void preview()}
        aria-busy={busy}
        aria-label="Suggest product tiers for the untiered backlog"
      >
        <Sparkles /> Suggest tiers
      </Button>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Suggest product tiers for the backlog</DialogTitle>
            <DialogDescription>
              {report && report.total > 0
                ? `${formatCount(report.total)} untiered product${report.total === 1 ? " has" : "s have"} a confident suggestion from ${
                    report.total === 1 ? "its" : "their"
                  } category and title. Nothing already tiered, and nothing a person has edited, is touched.`
                : "Nothing to file: every untiered product either is a supply, a workshop or a component, or says too little about its form for a rule to decide."}
            </DialogDescription>
          </DialogHeader>

          {report && report.total > 0 && (
            <dl className="space-y-3 text-sm">
              {PRODUCT_SIZE_TIERS.filter((tier) => report.byTier[tier] > 0).map(
                (tier) => (
                  <div key={tier}>
                    <dt className="font-medium">
                      <span className="font-mono tabular-nums">
                        {formatCount(report.byTier[tier])}
                      </span>{" "}
                      → {SIZE_TIER_NAME[tier]}
                    </dt>
                    <dd className="text-muted-foreground">
                      {report.samples[tier].join(" · ")}
                      {report.byTier[tier] > report.samples[tier].length
                        ? " · …"
                        : ""}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}

          {report && (
            <p className="text-sm text-muted-foreground">
              <span className="font-mono tabular-nums">
                {formatCount(left)}
              </span>{" "}
              stay untiered:{" "}
              <span className="font-mono tabular-nums">
                {formatCount(report.skipped.supplies)}
              </span>{" "}
              supplies, workshops or components (never a piece) and{" "}
              <span className="font-mono tabular-nums">
                {formatCount(report.skipped.unsure)}
              </span>{" "}
              the rule cannot decide — those are yours, through the &ldquo;No
              tier yet&rdquo; filter and <em>Set product tier</em>.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            {report && report.total > 0 && (
              <Button
                type="button"
                onClick={() => void apply()}
                disabled={busy}
              >
                File {formatCount(report.total)} product
                {report.total === 1 ? "" : "s"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
