"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { unsavedChanges } from "@/lib/unsaved-changes-signal";

/**
 * The question the unsaved-changes guard asks. Mounted once in the dashboard
 * layout, because it has to outlive the form it is asking about — the whole
 * point is that the form is being navigated away from.
 *
 * `window.confirm` would have been fewer lines and is what this pattern
 * usually reaches for. It is refused here for the same reason the roadmap
 * retires `window.prompt`: it renders in the browser's chrome rather than the
 * Studio's, cannot say WHICH screen is holding edits, and is suppressible —
 * a browser that has decided this tab shows too many dialogs simply discards
 * the call, and the guard would then fail silently in exactly the situation
 * it exists for.
 *
 * The wording avoids "OK/Cancel", which in a leave-confirmation is famously
 * ambiguous about which one keeps your work. Both buttons name their outcome.
 */
export function UnsavedChangesDialog() {
  const router = useRouter();
  const { pending } = useSyncExternalStore(
    unsavedChanges.subscribe,
    unsavedChanges.getSnapshot,
    unsavedChanges.getServerSnapshot,
  );

  const leave = () => {
    const href = unsavedChanges.confirm();
    if (!href) return;
    if (href === "__back__") {
      // The popstate handler pushed the entry back to hold position; going
      // back twice lands where the visitor was actually headed.
      history.go(-2);
      return;
    }
    router.push(href);
  };

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next) unsavedChanges.cancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            This screen has changes that have not been saved. Leaving now
            discards them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => unsavedChanges.cancel()}>
            Stay and keep editing
          </Button>
          <Button variant="destructive" onClick={leave}>
            Discard and leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
