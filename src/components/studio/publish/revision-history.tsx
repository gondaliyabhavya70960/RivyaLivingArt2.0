"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  listSurfaceRevisions,
  restoreRevision,
  type SurfaceRevision,
} from "@/actions/publish";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A surface's publish history, and the way back to any of it.
 *
 * `restoreRevision` shipped with publishing and was **unreachable**: every
 * publish wrote a `ContentRevision`, and nothing anywhere listed them, so no
 * owner could ever hold a revision id. The undo existed and could only be
 * reached with a database client. This is the half that was missing.
 *
 * **Deliberately not inside `PublishBar`.** That bar renders nothing when
 * there is nothing staged — which is exactly the moment you need history: you
 * published something wrong, so there is no draft, and the bar is gone. It
 * would have hidden the feature behind the one state where it is useless.
 *
 * Restoring stages into the DRAFT, never straight to live (the action's own
 * rule). The wording says so, because "Restore" that published immediately
 * would be a second mistake on top of the one being undone.
 *
 * Fetched when the dialog opens — an event, not an effect — matching the
 * publish bar's own reasoning about not firing server actions on mount.
 */
export function RevisionHistory({ surface }: { surface: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SurfaceRevision[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    const res = await listSurfaceRevisions(surface);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows(res.data ?? []);
  }

  async function restore(id: string) {
    setRestoringId(id);
    const res = await restoreRevision(id);
    setRestoringId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    toast.success(
      `Staged ${res.data?.staged ?? 0} change${res.data?.staged === 1 ? "" : "s"} as a draft — review, then publish.`,
    );
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11">
          <History aria-hidden className="size-4" /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish history — {surface}</DialogTitle>
          <DialogDescription>
            Every publish on this surface, newest first. Restoring puts a
            version back as an unpublished draft, so nothing reaches the site
            until you publish it again.
          </DialogDescription>
        </DialogHeader>

        {busy && rows === null ? (
          <p className="flex items-center gap-2 py-8 text-small text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading history…
          </p>
        ) : rows && rows.length === 0 ? (
          <p className="py-8 text-small leading-relaxed text-muted-foreground">
            Nothing published on {surface} yet. Once you publish, each release
            is recorded here and can be put back.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(rows ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-small text-foreground">
                    {row.summary ?? "Published changes"}
                  </p>
                  <p className="u-micro mt-1 text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {row.author ? ` · ${row.author}` : ""}
                    {` · ${row.copyCount} copy · ${row.imageCount} image${row.imageCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={restoringId !== null}
                  onClick={() => restore(row.id)}
                >
                  {restoringId === row.id ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw aria-hidden className="size-4" />
                  )}
                  Restore as draft
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
