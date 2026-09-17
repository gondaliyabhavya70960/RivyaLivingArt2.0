"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setCatalogFillPolicy } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * The owner's control over the CSV → catalog fill.
 *
 * The fill is not new — it has run on every deploy since it was written. This
 * screen is the first place it can be seen or stopped, so the copy says what
 * each switch actually does to a deploy rather than describing a feature.
 */
export function CatalogFillPolicy({
  enabled,
  onDeploy,
  maxCreates,
}: {
  enabled: boolean;
  onDeploy: boolean;
  maxCreates: number | null;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [deploy, setDeploy] = useState(onDeploy);
  const [cap, setCap] = useState(maxCreates === null ? "" : String(maxCreates));
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = cap.trim();
    const parsedCap = trimmed === "" ? null : Number(trimmed);
    if (parsedCap !== null && (!Number.isInteger(parsedCap) || parsedCap < 0)) {
      toast.error("The limit must be a whole number, or blank for no limit.");
      return;
    }
    setBusy(true);
    const res = await setCatalogFillPolicy({
      enabled: on,
      onDeploy: deploy,
      maxCreates: parsedCap,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved. It takes effect on the next fill.");
    router.refresh();
  }

  return (
    <section className="rounded-card border border-border bg-card p-5 shadow-e1">
      <h2 className="font-medium text-foreground">Automatic fill</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The four import-list CSVs fill the catalogue on every deploy. These
        decide whether it may, and how much it may add at once.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Label
            htmlFor="fill-enabled"
            className="flex-1 flex-col items-start gap-0.5 font-normal"
          >
            Fill the catalogue from the import-list CSVs
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Off stops it everywhere, deploys included.
            </span>
          </Label>
          <Checkbox
            id="fill-enabled"
            checked={on}
            onCheckedChange={(v) => setOn(v === true)}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <Label
            htmlFor="fill-deploy"
            className="flex-1 flex-col items-start gap-0.5 font-normal"
          >
            Fill when the site deploys
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Keep this on so a brand-new environment populates itself from the
              CSVs the first time it starts.
            </span>
          </Label>
          <Checkbox
            id="fill-deploy"
            checked={deploy}
            disabled={!on}
            onCheckedChange={(v) => setDeploy(v === true)}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <Label
            htmlFor="fill-cap"
            className="flex-1 flex-col items-start gap-0.5 font-normal"
          >
            Stop if it would add more than
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Blank means no limit. A re-sorted or re-keyed CSV can otherwise
              add thousands of products in one run; nothing is written when this
              trips.
            </span>
          </Label>
          <Input
            id="fill-cap"
            inputMode="numeric"
            placeholder="no limit"
            className="h-9 w-28 shrink-0"
            value={cap}
            disabled={!on}
            onChange={(e) => setCap(e.target.value)}
          />
        </div>
      </div>

      <Button className="mt-5" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </section>
  );
}
