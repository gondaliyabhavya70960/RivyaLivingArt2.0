"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Spec-mandated bulk-delete warning. States the exact count and type;
 * for more than 10 items the user must type DELETE to arm the button.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  count,
  noun,
  onConfirm,
  busy = false,
  extraWarning,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** Singular entity name, e.g. "Product" — pluralized automatically. */
  noun: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  extraWarning?: string;
}) {
  const [typed, setTyped] = useState("");
  const needsTyping = count > 10;
  const armed = !needsTyping || typed.trim().toUpperCase() === "DELETE";
  const plural =
    count === 1
      ? noun
      : noun.endsWith("y")
        ? `${noun.slice(0, -1)}ies`
        : `${noun}s`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-alert" strokeWidth={1.5} aria-hidden />
            Permanently delete {count} {plural}?
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete {count} {plural}. This cannot
            be undone.
            {extraWarning ? ` ${extraWarning}` : ""}
          </DialogDescription>
        </DialogHeader>

        {needsTyping && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete-input" className="text-foreground">
              Type <span className="font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-delete-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!armed || busy}
            onClick={() => onConfirm()}
          >
            {busy ? "Deleting…" : `Delete ${count} ${plural}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
