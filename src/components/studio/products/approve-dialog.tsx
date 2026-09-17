"use client";

import { BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The batch "I have read this copy". It clears the rewrite guard on every
 * selected product and publishes the ones that can go live — so it says
 * exactly that before the press, because the guard exists to keep another
 * site's words off this one, and a filter-wide approval is the one act that
 * lifts it for hundreds of rows at once.
 */
export function ApproveProductsDialog({
  open,
  onOpenChange,
  count,
  busy = false,
  onConfirm,
  filterWide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  /** True when the selection is "every product matching the filter". */
  filterWide: boolean;
}) {
  const plural = count === 1 ? "product" : "products";
  const shown = count.toLocaleString("en-IN");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck
              className="size-5 text-sapphire-ink"
              strokeWidth={1.5}
              aria-hidden
            />
            Approve {shown} {plural}?
          </DialogTitle>
          <DialogDescription>
            Approve says you have read the copy: it clears the rewrite flag on{" "}
            {count === 1 ? "this product" : "these products"} and publishes
            the ones that can go live. Scraped listings carry another site&apos;s
            words until they are rewritten — approve only what you have read.
            A product without a product tier keeps the approval but stays
            unpublished until a tier is set; archived products stay archived.
            {filterWide
              ? " This applies to every product matching the current filter, across all pages — not just this page."
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onConfirm()}>
            {busy ? "Approving…" : `Approve ${shown} ${plural}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
