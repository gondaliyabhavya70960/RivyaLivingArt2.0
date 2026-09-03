"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setSheetIds } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TABS: { key: string; label: string }[] = [
  { key: "Tier1_Owner", label: "Tier 1 — Owner" },
  { key: "Tier2_ResinGoods", label: "Tier 2 — Resin goods" },
  { key: "Tier3_Supplies", label: "Tier 3 — Supplies" },
  { key: "Tier4_3DPrint", label: "Tier 4 — 3D print" },
  { key: "Sheet1", label: "Sheet1 (bulk-upload tab)" },
];

/**
 * The owner's own spreadsheet — where every scraper push and sheet-fill
 * read talks to. A standalone section, own save button, own Server Action:
 * deliberately NOT part of the big Settings form above, the same reason
 * "Automatic fill" (`/studio/sheet-import`) is its own component — a save
 * here should never risk a typo in the brand name, and vice versa.
 *
 * Blank clears an override and falls back to SCRAPE_SHEET_ID/SHEET_ID (the
 * sheet id) or the API's own metadata lookup (a tab's numeric id) —
 * `src/lib/scraper/sheets.ts`'s `readSheetId`.
 */
export function SheetIdsSection({
  sheetId,
  sheetTabIds,
}: {
  sheetId: string | null;
  /** Json map, tab name → numeric id — whatever shape was last saved. */
  sheetTabIds: unknown;
}) {
  const router = useRouter();
  const [id, setId] = useState(sheetId ?? "");
  const initialTabIds = (
    sheetTabIds && typeof sheetTabIds === "object" ? sheetTabIds : {}
  ) as Record<string, unknown>;
  const [tabIds, setTabIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      TABS.map((t) => [
        t.key,
        typeof initialTabIds[t.key] === "number"
          ? String(initialTabIds[t.key])
          : "",
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await setSheetIds({ sheetId: id, sheetTabIds: tabIds });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved.");
    router.refresh();
  }

  return (
    <section className="rounded-card border border-border bg-card p-5 shadow-e1">
      <h2 className="font-medium text-foreground">Sheets</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The spreadsheet the scraper, the sheet fill and every &ldquo;sync to
        sheet&rdquo; action read and write. Blank falls back to the deploy
        environment&rsquo;s SCRAPE_SHEET_ID/SHEET_ID.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sheet-id">Spreadsheet id or URL</Label>
          <Input
            id="sheet-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Tab ids{" "}
            <span className="font-normal text-muted-foreground">
              (optional — skips a metadata lookup on delete)
            </span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TABS.map((tab) => (
              <div key={tab.key} className="space-y-1.5">
                <Label htmlFor={`sheet-tab-${tab.key}`} className="text-xs">
                  {tab.label}
                </Label>
                <Input
                  id={`sheet-tab-${tab.key}`}
                  inputMode="numeric"
                  value={tabIds[tab.key] ?? ""}
                  onChange={(e) =>
                    setTabIds((prev) => ({
                      ...prev,
                      [tab.key]: e.target.value,
                    }))
                  }
                  placeholder="numeric gid"
                  className="h-9"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Button className="mt-5" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </section>
  );
}
