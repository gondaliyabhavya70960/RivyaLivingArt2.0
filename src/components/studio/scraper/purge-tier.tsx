"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  previewSourcePurge,
  purgeScrapeSources,
} from "@/actions/scraper-sources";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ScrapeTier } from "@/generated/prisma/enums";
import { describePurgePlan, TIER_LABEL } from "@/lib/scraper/purge";

type Preview = {
  sources: number;
  stagedProducts: number;
  jobs: number;
  catalogProducts: number;
};

/**
 * Remove every website in a tier, and everything that came from it.
 *
 * The counts are fetched BEFORE the dialog opens and every one of them is
 * named. "This will remove 38 sources" hides that it also takes twelve
 * thousand staged products with it, and the second number is the one worth
 * pausing over.
 *
 * Live catalog products are kept unless explicitly ticked. "Stop scraping this
 * supplier" and "take these products off my website" are different requests,
 * and only one of them is what pressing this button usually means.
 */
export function PurgeTierButton({ tier }: { tier: ScrapeTier }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Defaults ON: the owner asked for these products gone from the live
  // catalog too, not just from the scraper and the sheet. It stays a visible,
  // untickable-able box showing the exact count, because the confirmation is
  // what makes a destructive default safe.
  const [alsoCatalog, setAlsoCatalog] = useState(true);
  const [busy, setBusy] = useState(false);

  const label = TIER_LABEL[tier];

  async function openDialog() {
    setBusy(true);
    const res = await previewSourcePurge({ tier });
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "Could not read that tier.");
      return;
    }
    if (res.data.sources === 0) {
      toast.info(`No ${label.toLowerCase()} sources to remove.`);
      return;
    }
    setPreview(res.data);
    // Re-armed on every open so a previous untick does not silently carry
    // into the next purge. The owner asked for these products gone from the
    // live catalog too, so ON is the default the dialog opens with — the
    // confirmation, and the exact count in the label, are what make it safe.
    setAlsoCatalog(true);
    setOpen(true);
  }

  async function confirm() {
    setBusy(true);
    const res = await purgeScrapeSources({
      tier,
      deleteCatalogProducts: alsoCatalog,
    });
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    toast.success(
      `Removed ${d?.sources ?? 0} ${label.toLowerCase()} source(s), ${(d?.stagedProducts ?? 0).toLocaleString("en-IN")} staged products` +
        (d?.catalogProducts ? `, ${d.catalogProducts.toLocaleString("en-IN")} catalog products` : "") +
        `, and ${(d?.sheetRows ?? 0).toLocaleString("en-IN")} sheet rows.`,
    );
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void openDialog()}
      >
        {busy && !open ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <Trash2 aria-hidden />
        )}
        Remove all {label.toLowerCase()}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remove every {label.toLowerCase()} source?</DialogTitle>
            <DialogDescription>
              {preview
                ? describePurgePlan(label.toLowerCase(), preview, {
                    deleteCatalogProducts: alsoCatalog,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          {preview && preview.catalogProducts > 0 && (
            <label className="flex items-start gap-3 rounded-lg border border-alert/40 bg-alert/5 p-3 text-sm">
              <Checkbox
                checked={alsoCatalog}
                onCheckedChange={(v) => setAlsoCatalog(v === true)}
              />
              <span>
                Also delete the{" "}
                <span className="tabular-nums font-medium">
                  {preview.catalogProducts.toLocaleString("en-IN")}
                </span>{" "}
                live catalog product
                {preview.catalogProducts === 1 ? "" : "s"} in this tier.
                <span className="mt-1 block text-muted-foreground">
                  They are on the storefront now — including any whose source
                  row was already removed. Untick to remove the suppliers
                  without touching what you already sell.
                </span>
              </span>
            </label>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Remove {preview?.sources ?? 0} source
              {preview?.sources === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
