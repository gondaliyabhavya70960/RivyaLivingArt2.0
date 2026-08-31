"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { syncJobToSheet } from "@/actions/scraper-sheets";
import { Button } from "@/components/ui/button";

/**
 * Per-job "Sync to Sheet" action. Always clickable — whether the sync is
 * configured is the server's call; after a "not configured" response the
 * explanation sticks around as a hover title.
 */
export function SheetSyncButton({
  jobId,
  synced,
}: {
  jobId: string;
  synced: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function handleSync() {
    setBusy(true);
    const res = await syncJobToSheet(jobId);
    setBusy(false);
    if (!res.ok) {
      if (res.error.startsWith("Sheet sync not configured")) {
        setHint(res.error);
      }
      toast.error(res.error);
      return;
    }
    setHint(null);
    toast.success(
      `Synced to Sheet — ${res.data?.updated ?? 0} updated, ${res.data?.appended ?? 0} appended.`,
    );
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={busy}
      title={hint ?? undefined}
      aria-label={synced ? "Re-sync job to Google Sheet" : "Sync job to Google Sheet"}
    >
      {busy ? "Syncing…" : synced ? "Synced ✓" : "Sync to Sheet"}
    </Button>
  );
}
