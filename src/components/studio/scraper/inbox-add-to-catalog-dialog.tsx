"use client";

/**
 * "Add to catalog" for the review inbox — the page's ticked rows, or every
 * row the filter matches when the owner chose "select all N matching".
 *
 * Nothing new writes here. The dialog first RESOLVES the selection on the
 * server (`resolveInboxSelection`: which rows have a twin that is not yet in
 * the catalogue, the auto-mapped category and the suggested tier for each),
 * shows what that resolution found, and then feeds the existing
 * `addScrapedToCatalog` in batches — the same audited path the source page
 * uses, with the same DRAFT + rewrite-guard result. Every imported row
 * leaves the importable set, so a run that stops halfway (a timeout, a
 * closed laptop) resumes from where it was by pressing the button again.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  addScrapedToCatalog,
  type ImportScrapedReport,
} from "@/actions/scraper-review";
import {
  resolveInboxSelection,
  type InboxSelection,
  type ResolveInboxSelectionInput,
} from "@/actions/scraper-shortlist";
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
import {
  PRODUCT_SIZE_TIERS,
  sizeTierStudioLabel,
  type ProductSizeTier,
} from "@/lib/product-size-tier";
import { chunk, importBatchSize } from "@/lib/scraper/inbox-batch";

type CategoryMode = "auto" | "all";
type TierMode = "suggested" | "none" | ProductSizeTier;

const TIER_MODES: { value: TierMode; label: string }[] = [
  { value: "suggested", label: "Use each product's suggested tier" },
  ...PRODUCT_SIZE_TIERS.map((tier) => ({
    value: tier,
    label: sizeTierStudioLabel(tier),
  })),
  { value: "none", label: "Leave untiered — decide later in Products" },
];

const inr = new Intl.NumberFormat("en-IN");

export function InboxAddToCatalogDialog({
  open,
  onOpenChange,
  filter,
  state,
  ids,
  categories,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: ResolveInboxSelectionInput["filter"];
  state: ResolveInboxSelectionInput["state"];
  /** The page's ticked rows, or null for every row the filter matches. */
  ids: string[] | null;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so keying the body resets every
          field and the resolved selection on each open, without an effect. */}
      <AddToCatalogBody
        key={open ? "open" : "closed"}
        filter={filter}
        state={state}
        ids={ids}
        categories={categories}
        onOpenChange={onOpenChange}
        onDone={onDone}
      />
    </Dialog>
  );
}

function AddToCatalogBody({
  filter,
  state,
  ids,
  categories,
  onOpenChange,
  onDone,
}: {
  filter: ResolveInboxSelectionInput["filter"];
  state: ResolveInboxSelectionInput["state"];
  ids: string[] | null;
  categories: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [selection, setSelection] = useState<InboxSelection | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("auto");
  const [categoryId, setCategoryId] = useState("");
  const [tierMode, setTierMode] = useState<TierMode>("suggested");
  const [mirrorImages, setMirrorImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [errors, setErrors] = useState<ImportScrapedReport["errors"]>([]);
  const [finished, setFinished] = useState(false);

  // Resolve once per open. The state lands in the callback, never in the
  // effect body, and a close mid-flight is ignored rather than applied.
  useEffect(() => {
    let cancelled = false;
    resolveInboxSelection({ filter, state, ids: ids ?? undefined }).then(
      (res) => {
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setResolveError(res.ok ? "Nothing to resolve." : res.error);
          return;
        }
        setSelection(res.data);
      },
    );
    return () => {
      cancelled = true;
    };
    // The body is keyed on `open`, so these props are fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importable = selection?.importable ?? [];
  const unmapped = importable.filter((row) => !row.categoryId).length;
  const willAdd =
    categoryMode === "all"
      ? categoryId
        ? importable.length
        : 0
      : importable.length - (categoryId ? 0 : unmapped);

  async function handleAdd() {
    if (!selection) return;
    if (categoryMode === "all" && !categoryId) {
      toast.error("Pick the category first.");
      return;
    }
    const items = importable.flatMap((row) => {
      const category =
        categoryMode === "all" ? categoryId : (row.categoryId ?? categoryId);
      if (!category) return [];
      const sizeTier =
        tierMode === "suggested"
          ? row.suggestedSizeTier
          : tierMode === "none"
            ? null
            : tierMode;
      return [{ id: row.twinId, categoryId: category, sizeTier }];
    });
    if (items.length === 0) return;

    setBusy(true);
    setErrors([]);
    const totals: ImportScrapedReport = {
      imported: 0,
      updated: 0,
      skipped: 0,
      protected: 0,
      errors: [],
    };
    let done = 0;
    setProgress({ done, total: items.length });
    let stoppedBy: string | null = null;
    for (const batch of chunk(items, importBatchSize(mirrorImages))) {
      const res = await addScrapedToCatalog({ items: batch, mirrorImages });
      if (!res.ok || !res.data) {
        stoppedBy = res.ok ? "The import returned nothing." : res.error;
        break;
      }
      totals.imported += res.data.imported;
      totals.updated += res.data.updated;
      totals.skipped += res.data.skipped;
      totals.protected += res.data.protected;
      totals.errors.push(...res.data.errors);
      done += batch.length;
      setProgress({ done, total: items.length });
    }
    setBusy(false);
    setFinished(true);
    setErrors(totals.errors);

    const parts = [
      `${totals.imported} added as draft${totals.imported === 1 ? "" : "s"}`,
    ];
    if (totals.updated > 0) parts.push(`${totals.updated} updated`);
    if (totals.skipped > 0) parts.push(`${totals.skipped} skipped`);
    // Reported apart from "skipped": leaving the owner's work alone is the
    // feature doing its job, and worth saying out loud.
    if (totals.protected > 0) {
      parts.push(
        `${totals.protected} left as you edited ${totals.protected === 1 ? "it" : "them"}`,
      );
    }
    if (totals.errors.length > 0) parts.push(`${totals.errors.length} failed`);
    const message = `${parts.join(" · ")}.`;

    if (stoppedBy) {
      // Whatever landed before the stop is in the catalogue and out of the
      // importable set; pressing the button again picks up the rest.
      toast.error(
        `Stopped after ${done} of ${items.length}: ${stoppedBy} Press Add again to continue.`,
      );
      onDone();
      return;
    }
    if (totals.errors.length > 0) {
      toast.warning(message);
      onDone();
      return;
    }
    toast.success(message);
    onOpenChange(false);
    onDone();
  }

  const scopeLine = ids
    ? `${ids.length} selected row${ids.length === 1 ? "" : "s"}`
    : `every row the filter matches`;

  return (
    <DialogContent
      className="max-w-md"
      onInteractOutside={(e) => busy && e.preventDefault()}
      onEscapeKeyDown={(e) => busy && e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Add to catalog</DialogTitle>
        <DialogDescription>
          Resolving {scopeLine}. Each product goes in as a DRAFT with the
          rewrite guard set, in its own category, with its suggested tier
          unless you choose otherwise.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {resolveError ? (
          <p className="text-sm text-destructive" role="alert">
            {resolveError}
          </p>
        ) : !selection ? (
          <p className="text-sm text-muted-foreground" role="status">
            Resolving the selection…
          </p>
        ) : (
          <dl
            className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm"
            aria-label="What the selection resolves to"
          >
            <dt className="text-muted-foreground">Can be added</dt>
            <dd className="u-num text-foreground">
              {inr.format(importable.length)}
            </dd>
            {selection.alreadyImported > 0 && (
              <>
                <dt className="text-muted-foreground">Already in the catalogue</dt>
                <dd className="u-num text-foreground">
                  {inr.format(selection.alreadyImported)}
                </dd>
              </>
            )}
            {unmapped > 0 && (
              <>
                <dt className="text-muted-foreground">No matching category</dt>
                <dd className="u-num text-foreground">{inr.format(unmapped)}</dd>
              </>
            )}
            {selection.noTwin > 0 && (
              <>
                <dt className="text-muted-foreground">Nothing staged</dt>
                <dd className="u-num text-foreground">
                  {inr.format(selection.noTwin)}
                </dd>
              </>
            )}
            {selection.capped && (
              <p className="col-span-2 text-xs text-muted-foreground">
                The first {inr.format(selection.ids.length)} of{" "}
                {inr.format(selection.totalMatching)} matching rows were
                resolved. Run this again afterwards for the rest.
              </p>
            )}
          </dl>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="inbox-add-category-mode">Category</Label>
          <Select
            value={categoryMode}
            onValueChange={(value) => setCategoryMode(value as CategoryMode)}
            disabled={busy || finished}
          >
            <SelectTrigger id="inbox-add-category-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                Match each product to the nearest category
              </SelectItem>
              <SelectItem value="all">Put every product in one category</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inbox-add-category">
            {categoryMode === "all"
              ? "The category"
              : unmapped > 0
                ? `Category for the ${inr.format(unmapped)} with no match`
                : "Category for products with no match (none right now)"}
          </Label>
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            disabled={busy || finished}
          >
            <SelectTrigger id="inbox-add-category" className="w-full">
              <SelectValue
                placeholder={
                  categoryMode === "all" ? "Pick a category" : "Skip them"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inbox-add-tier">Product tier</Label>
          <Select
            value={tierMode}
            onValueChange={(value) => setTierMode(value as TierMode)}
            disabled={busy || finished}
          >
            <SelectTrigger id="inbox-add-tier" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="inbox-add-mirror"
            checked={mirrorImages}
            onCheckedChange={(value) => setMirrorImages(value === true)}
            disabled={busy || finished}
            className="mt-0.5"
          />
          <Label htmlFor="inbox-add-mirror" className="font-normal">
            Mirror images to our storage (recommended; slower in large runs)
          </Label>
        </div>

        <div className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Everything imports as DRAFT with the rewrite guard — scraped titles,
          text and photos are competitors&apos; copyrighted reference material.
          Publish stays blocked until each product is rewritten as original
          Rivya Living Art content.
        </div>

        {progress && (
          <div className="space-y-1.5" aria-live="polite">
            <p className="u-num text-sm text-foreground">
              {busy ? "Adding…" : "Done —"} {inr.format(progress.done)} of{" "}
              {inr.format(progress.total)}
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-foreground transition-[inline-size] duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none"
                style={{
                  inlineSize: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-card border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">
              {errors.length} item{errors.length === 1 ? "" : "s"} failed to
              import:
            </p>
            <ul className="space-y-1 text-foreground/80">
              {errors.map((err, i) => (
                <li key={`${err.title}-${i}`}>
                  <span className="font-medium text-foreground">
                    {err.title}
                  </span>
                  : {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={busy}
        >
          {finished ? "Done" : "Cancel"}
        </Button>
        {!finished && (
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={busy || !selection || willAdd === 0}
          >
            {busy
              ? "Adding…"
              : `Add ${inr.format(Math.max(willAdd, 0))} to catalog`}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
