"use client";

/**
 * Per-row actions on the workflow-runs feed (A9): Retry queues a FRESH run
 * for a failed job's exact target (the failed row stays as the record of
 * what happened); Cancel terminal-writes an in-flight job with the honest
 * reason. Both report the server's answer verbatim — a refused retry says
 * why instead of silently doing nothing.
 */

import { useTransition } from "react";
import { RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cancelScrapeJob, retryScrapeJob } from "@/actions/scraper-runs";
import { Button } from "@/components/ui/button";

export function RunActions({
  jobId,
  retryable,
  cancellable,
}: {
  jobId: string;
  retryable: boolean;
  cancellable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!retryable && !cancellable) return null;

  const retry = () =>
    startTransition(async () => {
      const res = await retryScrapeJob(jobId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data!.userError) {
        toast.error(res.data!.userError);
        return;
      }
      toast.success("Retry queued as a new run.");
      router.refresh();
    });

  const cancel = () =>
    startTransition(async () => {
      const res = await cancelScrapeJob(jobId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data!.cancelled) toast.success("Run cancelled.");
      else toast.info("Run was already finished.");
      router.refresh();
    });

  return (
    <div className="flex items-center justify-end gap-1.5">
      {retryable && (
        <Button
          onClick={retry}
          disabled={pending}
          size="sm"
          variant="outline"
          title="Queue a fresh run for the same target — this row stays as the record of the failure"
        >
          <RotateCcw className={pending ? "animate-spin" : undefined} />
          Retry
        </Button>
      )}
      {cancellable && (
        <Button
          onClick={cancel}
          disabled={pending}
          size="sm"
          variant="ghost"
          title="Stop this run — recorded as cancelled by you, not as a source failure"
        >
          <XCircle />
          Cancel
        </Button>
      )}
    </div>
  );
}
