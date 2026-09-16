"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { addScrapedToCatalog } from "@/actions/scraper-review";
import type { ProductSizeTier } from "@/lib/product-size-tier";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AddToCatalogItem = {
  id: string;
  title: string;
  /** Auto-mapped or operator-picked catalog category; null when unresolved. */
  categoryId: string | null;
  /** Suggested or operator-picked product tier; null leaves the draft
   *  untiered (the publish guard will ask for one later). */
  sizeTier: ProductSizeTier | null;
};

/**
 * Confirm dialog for the source-detail "Add to catalog" flow. Each selected
 * product already carries its own (auto-mapped or operator-edited) category, so
 * this only needs the mirror-images choice, a fallback for anything unmapped,
 * and the copyright guard. Import routes every product to its own category.
 */
export function AddToCatalogDialog({
  open,
  onOpenChange,
  items,
  categories,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AddToCatalogItem[];
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so keying the body resets field
          state on every open without any effect. */}
      <AddToCatalogBody
        key={open ? "open" : "closed"}
        items={items}
        categories={categories}
        onOpenChange={onOpenChange}
        onDone={onDone}
      />
    </Dialog>
  );
}

function AddToCatalogBody({
  items,
  categories,
  onOpenChange,
  onDone,
}: {
  items: AddToCatalogItem[];
  categories: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [mirrorImages, setMirrorImages] = useState(true);
  const [fallbackId, setFallbackId] = useState("");
  const [busy, setBusy] = useState(false);

  const unmatched = useMemo(
    () => items.filter((it) => !it.categoryId),
    [items],
  );
  // Every item resolves once a fallback covers the unmatched ones.
  const ready = unmatched.length === 0 || Boolean(fallbackId);
  const eligible = fallbackId ? items.length : items.length - unmatched.length;

  async function handleAdd() {
    const resolved = items
      .map((it) => ({
        id: it.id,
        categoryId: it.categoryId ?? fallbackId,
        sizeTier: it.sizeTier,
      }))
      .filter((it) => it.categoryId);
    if (resolved.length === 0) {
      toast.error("Pick a category for the unmatched products first.");
      return;
    }
    setBusy(true);
    const res = await addScrapedToCatalog({ items: resolved, mirrorImages });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const report = res.data;
    if (report) {
      for (const err of report.errors) {
        console.warn(
          `Add-to-catalog failed for "${err.title}": ${err.message}`,
        );
      }
      const parts = [
        `${report.imported} added as draft${report.imported === 1 ? "" : "s"}`,
      ];
      if (report.updated > 0) parts.push(`${report.updated} updated`);
      if (report.skipped > 0) parts.push(`${report.skipped} skipped`);
      // Reported separately from "skipped": leaving the owner's work alone is
      // the feature doing its job, and worth saying out loud.
      if (report.protected > 0) {
        parts.push(
          `${report.protected} left as you edited ${report.protected === 1 ? "it" : "them"}`,
        );
      }
      if (report.errors.length > 0)
        parts.push(`${report.errors.length} failed`);
      const message = `${parts.join(" · ")}.`;
      if (report.errors.length > 0) toast.warning(message);
      else toast.success(message);
    }
    onOpenChange(false);
    onDone();
  }

  return (
    <DialogContent
      className="max-w-md"
      onInteractOutside={(e) => busy && e.preventDefault()}
      onEscapeKeyDown={(e) => busy && e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Add to catalog</DialogTitle>
        <DialogDescription>
          {items.length} selected product{items.length === 1 ? "" : "s"} will be
          added as draft{items.length === 1 ? "" : "s"}, each routed to its own
          catalog category and filed under the product tier shown in the list.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {unmatched.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="fallback-category">
              Category for {unmatched.length} unmatched product
              {unmatched.length === 1 ? "" : "s"}
            </Label>
            <Select value={fallbackId} onValueChange={setFallbackId}>
              <SelectTrigger id="fallback-category" className="w-full">
                <SelectValue placeholder="Pick a fallback category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              These didn&apos;t auto-map to a category. Set one here, or change
              each row&apos;s category in the list.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="add-mirror"
            checked={mirrorImages}
            onCheckedChange={(value) => setMirrorImages(value === true)}
            className="mt-0.5"
          />
          <Label htmlFor="add-mirror" className="font-normal">
            Mirror images to our storage (recommended)
          </Label>
        </div>

        <div className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Everything imports as DRAFT with the rewrite guard — scraped titles,
          text and photos are competitors&apos; copyrighted reference material.
          Publish stays blocked until each product is rewritten as original
          Rivya Living Art content.
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={busy || !ready || eligible === 0}
        >
          {busy ? "Adding…" : `Add ${eligible} to catalog`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
