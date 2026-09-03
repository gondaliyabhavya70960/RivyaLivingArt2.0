"use client";

import { useState } from "react";
import { toast } from "sonner";

import { moveMedia } from "@/actions/media";
import {
  MEDIA_FOLDERS,
  type MediaFolder,
} from "@/components/studio/media/folders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FOLDER_LABELS: Record<MediaFolder, string> = {
  products: "Products",
  blog: "Journal",
  portfolio: "Portfolio",
  site: "Studio",
  refs: "References",
  other: "Other",
};

/**
 * Bulk re-file dialog — the BulkBar's Move action (batch D · media system).
 * A radio group rather than the shared `Select`: six fixed folders is few
 * enough to show at once, and a click commits the choice with no extra step.
 */
export function MoveToFolderDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  /** Called after a successful move so the caller can clear selection and
   *  refresh the list. */
  onDone: () => void;
}) {
  const [folder, setFolder] = useState<MediaFolder | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleMove() {
    if (!folder) return;
    setBusy(true);
    const result = await moveMedia(ids, folder);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const moved = result.data?.moved ?? 0;
    toast.success(
      `Moved ${moved} ${moved === 1 ? "file" : "files"} to ${FOLDER_LABELS[folder]}.`,
    );
    setFolder(null);
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Move {ids.length} {ids.length === 1 ? "file" : "files"}
          </DialogTitle>
          <DialogDescription>
            Choose the folder to file them under.
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Destination folder"
          className="grid gap-2"
        >
          {MEDIA_FOLDERS.map((value) => {
            const active = folder === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFolder(value)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-input border px-4 text-small outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
                  active
                    ? "border-sapphire-ink bg-sapphire-ink/10 font-medium text-sapphire-ink"
                    : "border-border text-foreground hover:border-sapphire-ink/40",
                )}
              >
                {FOLDER_LABELS[value]}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleMove} disabled={!folder || busy}>
            {busy ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
