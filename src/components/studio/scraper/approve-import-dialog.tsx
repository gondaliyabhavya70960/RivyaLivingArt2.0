"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  importApprovedScraped,
  setScrapedReviewStatus,
} from "@/actions/scraper-review";
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

export function ApproveImportDialog({
  open,
  onOpenChange,
  ids,
  categories,
  onDone,
  approveFirst = false,
  approvedCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  categories: { id: string; name: string }[];
  onDone: () => void;
  /**
   * When true (source detail "Add to catalog"), the selected rows are set
   * APPROVED before importing so ANY selected product goes into the catalog.
   * When false (review queue), only the already-APPROVED subset imports.
   */
  approveFirst?: boolean;
  /** Review queue only: how many of `ids` are already APPROVED. */
  approvedCount?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so keying the body resets field
          state on every open without any effect. */}
      <ApproveImportBody
        key={open ? "open" : "closed"}
        ids={ids}
        categories={categories}
        onOpenChange={onOpenChange}
        onDone={onDone}
        approveFirst={approveFirst}
        approvedCount={approvedCount}
      />
    </Dialog>
  );
}

function ApproveImportBody({
  ids,
  categories,
  onOpenChange,
  onDone,
  approveFirst,
  approvedCount,
}: {
  ids: string[];
  categories: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  approveFirst: boolean;
  approvedCount?: number;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [mirrorImages, setMirrorImages] = useState(true);
  const [busy, setBusy] = useState(false);
  // Per-row failures surfaced in the dialog instead of only the console (UIUX-612).
  const [errors, setErrors] = useState<{ title: string; message: string }[]>([]);

  // How many rows will actually import: everything selected when approveFirst,
  // otherwise just the already-approved subset.
  const eligible = approveFirst ? ids.length : (approvedCount ?? 0);

  async function handleImport() {
    if (!categoryId) {
      toast.error("Pick a category first.");
      return;
    }
    setBusy(true);
    setErrors([]);
    // Add-to-catalog: approve the whole selection first so it all imports.
    if (approveFirst) {
      const approved = await setScrapedReviewStatus(ids, "APPROVED");
      if (!approved.ok) {
        setBusy(false);
        toast.error(approved.error);
        return;
      }
    }
    const res = await importApprovedScraped({ ids, categoryId, mirrorImages });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const report = res.data;
    if (report) {
      const parts = [
        `${report.imported} imported as draft${report.imported === 1 ? "" : "s"}`,
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
      if (report.errors.length > 0) parts.push(`${report.errors.length} failed`);
      const message = `${parts.join(" · ")}.`;

      if (report.errors.length > 0) {
        // Keep the dialog open and show which rows failed and why, instead of
        // hiding the reasons in the devtools console (UIUX-612). Refresh the
        // underlying review list so the imported rows update behind it.
        setErrors(report.errors);
        toast.warning(message);
        onDone();
        return;
      }
      toast.success(message);
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
        <DialogTitle>
          {approveFirst ? "Add to catalog" : "Import approved products"}
        </DialogTitle>
        <DialogDescription>
          {approveFirst
            ? `${ids.length} selected product${ids.length === 1 ? "" : "s"} will be added to your catalog as draft${ids.length === 1 ? "" : "s"} in the chosen category.`
            : `${approvedCount ?? 0} of ${ids.length} selected item${ids.length === 1 ? " is" : "s are"} approved — only those will import into the chosen category.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="import-category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="import-category" className="w-full">
              <SelectValue placeholder="Pick a category" />
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

        <div className="flex items-start gap-2">
          <Checkbox
            id="import-mirror"
            checked={mirrorImages}
            onCheckedChange={(value) => setMirrorImages(value === true)}
            className="mt-0.5"
          />
          <Label htmlFor="import-mirror" className="font-normal">
            Mirror images to our storage (recommended)
          </Label>
        </div>

        <div className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Everything imports as DRAFT with the rewrite guard — scraped titles,
          text and photos are competitors&apos; copyrighted reference material.
          Publish stays blocked until each product is rewritten as original
          Rivya Living Art content.
        </div>

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
          {errors.length > 0 ? "Done" : "Cancel"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleImport}
          disabled={busy || eligible === 0 || !categoryId}
        >
          {busy
            ? approveFirst
              ? "Adding…"
              : "Importing…"
            : approveFirst
              ? `Add ${eligible} to catalog`
              : `Import ${eligible} product${eligible === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
