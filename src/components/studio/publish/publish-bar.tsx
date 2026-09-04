"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Eye, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  discardSurfaceDraft,
  getPublishReport,
  publishSurface,
} from "@/actions/publish";
import { Button } from "@/components/ui/button";
import type { PublishReport } from "@/lib/publish";

/**
 * The publish bar — what is waiting to go live on this surface, and the two
 * things you can do about it.
 *
 * Sticky at the foot of the editing screens rather than a separate page,
 * because publishing is the last step of editing and a screen you have to
 * navigate to is a screen people forget. It renders nothing when there is
 * nothing staged, so the bar itself is the signal that unpublished work
 * exists.
 *
 * The report is fetched on demand rather than on mount: an effect that fires a
 * server action on every render of every board is both wasteful and exactly
 * the `react-hooks/set-state-in-effect` shape the repo lints against.
 */
export function PublishBar({
  surface,
  /** How many staged changes the server already counted for this surface. */
  pending,
  previewPath,
}: {
  surface: string;
  pending: number;
  previewPath: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<PublishReport | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (pending === 0) return null;

  async function check() {
    setBusy(true);
    const res = await getPublishReport(surface);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    setReport(res.data ?? null);
    return res.data ?? null;
  }

  async function run() {
    const checked = report ?? (await check());
    if (!checked) return;
    if (checked.blocking.length) {
      toast.error("Fix what is listed below before publishing.");
      return;
    }
    setBusy(true);
    const res = await publishSurface(surface);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setReport(null);
    toast.success(
      `${surface} published — ${res.data?.published ?? 0} change${res.data?.published === 1 ? " is" : "s are"} now live.`,
    );
    router.refresh();
  }

  async function discard() {
    setBusy(true);
    const res = await discardSurfaceDraft(surface);
    setBusy(false);
    setConfirmDiscard(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setReport(null);
    toast.success("Unpublished changes thrown away.");
    router.refresh();
  }

  return (
    <div className="sticky bottom-0 z-40 -mx-4 mt-10 border-t border-border bg-bg/95 px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.35)] backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-small text-foreground">
          <span className="font-medium tabular-nums">{pending}</span> change
          {pending === 1 ? "" : "s"} on {surface} are not published yet.
        </p>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href={`/api/draft?redirect=${encodeURIComponent(previewPath)}`}>
              <Eye aria-hidden className="size-4" />
              Preview
            </a>
          </Button>
          {confirmDiscard ? (
            <>
              <span className="text-small text-alert">Throw them away?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={discard}
                disabled={busy}
              >
                Yes, discard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDiscard(false)}
                disabled={busy}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDiscard(true)}
              disabled={busy}
            >
              <Trash2 aria-hidden className="size-4" />
              Discard
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={busy}>
            {busy ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Upload aria-hidden className="size-4" />
            )}
            Publish {surface}
          </Button>
        </div>
      </div>

      {report && (report.blocking.length > 0 || report.warnings.length > 0) && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {report.blocking.map((issue) => (
            <p
              key={`b-${issue.where}-${issue.message}`}
              className="flex items-start gap-2 text-small text-alert"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">{issue.where}</span> —{" "}
                {issue.message}
              </span>
            </p>
          ))}
          {report.warnings.map((issue) => (
            <p
              key={`w-${issue.where}-${issue.message}`}
              className="text-small text-graphite"
            >
              <span className="font-medium">{issue.where}</span> —{" "}
              {issue.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
