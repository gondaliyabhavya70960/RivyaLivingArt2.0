"use client";

import { useMemo, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  bulkResolveImportConflicts,
  resolveImportConflict,
} from "@/actions/sheet-fill";
import { BulkBar } from "@/components/studio/bulk-bar";
import { EmptyState } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";

export type ConflictRow = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  field: string;
  importedValue: string | null;
  dbValue: string | null;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  priceMin: "Price (min)",
  priceMax: "Price (max)",
  materials: "Materials",
  dimensions: "Dimensions",
  description: "Description",
  inStock: "In stock",
};

function displayValue(value: string | null): string {
  if (value === null) return "—";
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

export function ConflictList({ conflicts }: { conflicts: ConflictRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const rowIds = useMemo(() => conflicts.map((c) => c.id), [conflicts]);
  const selection = useSelection(rowIds);

  async function handleResolve(
    id: string,
    choice: "keep-mine" | "take-sheet" | "skip",
  ) {
    setBusyId(id);
    const res = await resolveImportConflict(id, choice);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      choice === "take-sheet"
        ? "Took the sheet's value."
        : choice === "keep-mine"
          ? "Kept the studio's value."
          : "Skipped.",
    );
    router.refresh();
  }

  async function handleBulk(choice: "keep-mine" | "skip") {
    setBulkBusy(true);
    const res = await bulkResolveImportConflicts(selection.ids, choice);
    setBulkBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const resolved = res.data?.resolved ?? 0;
    toast.success(
      `Resolved ${resolved} ${resolved === 1 ? "conflict" : "conflicts"}.`,
    );
    selection.clear();
    router.refresh();
  }

  if (conflicts.length === 0) {
    return (
      <EmptyState
        title="No open conflicts"
        description="A conflict appears when the sheet and a studio edit change the same field of the same product after the last fill. Nothing needs a decision right now."
      />
    );
  }

  return (
    <div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Sheet conflicts"
        className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <table className="w-full text-sm">
          <thead>
            <StudioTableHead>
              <th scope="col" className="w-10 px-4 py-3">
                <Checkbox
                  aria-label="Select all"
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleAll}
                />
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Product
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Field
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Sheet says
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Studio has
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Found
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </StudioTableHead>
          </thead>
          <tbody>
            {conflicts.map((row) => (
              <StudioRow key={row.id} selected={selection.selected.has(row.id)}>
                <td className="px-4 py-3">
                  <Checkbox
                    aria-label={`Select ${row.productTitle} — ${row.field}`}
                    checked={selection.selected.has(row.id)}
                    onCheckedChange={() => selection.toggle(row.id)}
                  />
                </td>
                <td className="max-w-[24ch] px-4 py-3">
                  <Link
                    href={`/studio/products/${row.productId}`}
                    className="block truncate font-medium text-foreground hover:text-sapphire-ink hover:underline"
                    title={row.productTitle}
                  >
                    {row.productTitle}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">
                    {FIELD_LABELS[row.field] ?? row.field}
                  </Badge>
                </td>
                <td
                  className="max-w-[20ch] px-4 py-3 text-graphite"
                  title={row.importedValue ?? undefined}
                >
                  {displayValue(row.importedValue)}
                </td>
                <td
                  className="max-w-[20ch] px-4 py-3 text-graphite"
                  title={row.dbValue ?? undefined}
                >
                  {displayValue(row.dbValue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {row.createdAt}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={busyId === row.id}
                      onClick={() => handleResolve(row.id, "keep-mine")}
                    >
                      Keep mine
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2"
                      disabled={busyId === row.id}
                      onClick={() => handleResolve(row.id, "take-sheet")}
                    >
                      Take sheet
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground"
                      disabled={busyId === row.id}
                      onClick={() => handleResolve(row.id, "skip")}
                    >
                      Skip
                    </Button>
                  </div>
                </td>
              </StudioRow>
            ))}
          </tbody>
        </table>
      </div>

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="secondary"
          disabled={bulkBusy}
          onClick={() => handleBulk("keep-mine")}
        >
          Keep mine
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={bulkBusy}
          onClick={() => handleBulk("skip")}
        >
          Skip
        </Button>
      </BulkBar>
    </div>
  );
}
