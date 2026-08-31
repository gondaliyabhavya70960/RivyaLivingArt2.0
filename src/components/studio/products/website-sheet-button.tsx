"use client";

import { useState } from "react";
import { Loader2, Sheet } from "lucide-react";
import { toast } from "sonner";

import { syncWebsiteProductsToSheet } from "@/actions/scraper-sheets";
import { Button } from "@/components/ui/button";
import { WEBSITE_SHEET_TAB } from "@/lib/scraper/website-sheet";

/**
 * Push the catalog into the sheet's "Added product in website" tab.
 *
 * Always clickable: whether sync is configured is the server's call, and its
 * explanation is worth more than a button that is mysteriously disabled.
 */
export function WebsiteSheetButton() {
  const [busy, setBusy] = useState(false);

  async function handleSync() {
    setBusy(true);
    const res = await syncWebsiteProductsToSheet();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { updated = 0, appended = 0, total = 0 } = res.data ?? {};
    toast.success(
      `“${WEBSITE_SHEET_TAB}” updated — ${total} product${total === 1 ? "" : "s"} (${appended} added, ${updated} refreshed).`,
    );
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={busy}>
      {busy ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : (
        <Sheet aria-hidden />
      )}
      Sync to sheet
    </Button>
  );
}
