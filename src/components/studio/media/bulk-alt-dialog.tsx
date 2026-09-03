"use client";

import { useState } from "react";
import { toast } from "sonner";

import { bulkUpdateAlt } from "@/actions/media";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * The BulkBar's "Description" action (batch D · media system) — the SAME
 * alt text on every selected picture. That is only ever right for a genuine
 * set (several angle shots of one commission, say); the dialog says so
 * plainly rather than letting it read as a shortcut for per-picture alt
 * text, which it is not.
 */
export function BulkAltDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onDone: () => void;
}) {
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const result = await bulkUpdateAlt(ids, alt);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const updated = result.data?.updated ?? 0;
    toast.success(
      `Set the same description on ${updated} ${updated === 1 ? "picture" : "pictures"}.`,
    );
    setAlt("");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Describe {ids.length} {ids.length === 1 ? "picture" : "pictures"}
          </DialogTitle>
          <DialogDescription>
            Every selected picture gets this exact description — only right for
            a genuine set, several shots of the one thing. Non-image files in
            the selection (video, 3D, documents) are skipped; alt text is a
            property of a picture.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="What the pictures show"
          aria-label="Description for every selected picture"
          rows={3}
          maxLength={300}
          autoFocus
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!alt.trim() || busy}
          >
            {busy ? "Saving…" : "Set description"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
