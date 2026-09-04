"use client";

import { useCallback, useMemo, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteResearchRecords,
  setResearchStatus,
  type ResearchStatus,
} from "@/actions/research";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import {
  NewResearchButton,
  ResearchFormDialog,
  type ResearchRow,
} from "@/components/studio/research/research-form";
import { SortHead, useSort } from "@/components/studio/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSelection } from "@/hooks/use-selection";

const STATUS_LABELS: Record<ResearchStatus, string> = {
  RESEARCH: "Research",
  SHORTLISTED: "Shortlisted",
  DISCARDED: "Discarded",
};

const STATUS_BADGE: Record<
  ResearchStatus,
  "outline" | "secondary" | "success"
> = {
  RESEARCH: "outline",
  SHORTLISTED: "success",
  DISCARDED: "secondary",
};

export function ResearchList({ records }: { records: ResearchRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | "ALL">(
    "ALL",
  );
  const [editing, setEditing] = useState<ResearchRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !r.source.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, query, statusFilter]);

  const getValue = useCallback((row: ResearchRow, key: string) => {
    switch (key) {
      case "title":
        return row.title.toLowerCase();
      case "source":
        return row.source.toLowerCase();
      case "category":
        return row.category?.toLowerCase() ?? null;
      case "status":
        return row.status;
      case "extractedAt":
        return row.extractedAtInput;
      default:
        return null;
    }
  }, []);

  const { sorted, sort, toggle } = useSort(filtered, getValue, {
    key: "extractedAt",
    dir: "desc",
  });

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    sorted,
    PAGE_SIZE,
    `${query}|${statusFilter}`,
  );

  const rowIds = useMemo(() => pageRows.map((r) => r.id), [pageRows]);
  const selection = useSelection(rowIds);

  async function handleStatus(status: ResearchStatus) {
    setBusy(true);
    const res = await setResearchStatus(selection.ids, status);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const updated = res.data?.updated ?? 0;
    toast.success(
      `Marked ${updated} ${updated === 1 ? "record" : "records"} ${STATUS_LABELS[status].toLowerCase()}.`,
    );
    selection.clear();
    router.refresh();
  }

  async function handleDelete() {
    const count = selection.count;
    setBusy(true);
    const res = await deleteResearchRecords(selection.ids);
    setBusy(false);
    setConfirmOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Deleted ${count} ${count === 1 ? "record" : "records"}.`);
    selection.clear();
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-graphite"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or source…"
            aria-label="Search research records"
            className="w-64 ps-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ResearchStatus | "ALL")}
        >
          <SelectTrigger
            aria-label="Filter by status"
            size="sm"
            className="w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as ResearchStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No research yet"
          description="Keep a note on a piece worth adapting — a maker's photo, a competitor's listing, an idea from a market stall. Nothing here ever becomes a product on its own."
          action={<NewResearchButton />}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No records match"
          description="Clear the search or the status filter to see the rest."
        />
      ) : (
        <>
          <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite md:hidden">
            <Checkbox
              aria-label="Select all"
              checked={selection.allSelected}
              onCheckedChange={selection.toggleAll}
            />
            Select all on this page
          </label>
          <ul className="space-y-3 md:hidden">
            {pageRows.map((row) => (
              <li
                key={row.id}
                className="rounded-card border border-border bg-card p-4 shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Select ${row.title}`}
                    checked={selection.selected.has(row.id)}
                    onCheckedChange={() => selection.toggle(row.id)}
                    className="mt-1"
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="min-w-0 flex-1 text-start"
                  >
                    <p className="text-small font-medium text-foreground">
                      {row.title}
                    </p>
                    <p className="u-micro mt-0.5">{row.source}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE[row.status]}>
                        {STATUS_LABELS[row.status]}
                      </Badge>
                      {row.category && (
                        <Badge variant="secondary">{row.category}</Badge>
                      )}
                      {row.isDemo && <Badge variant="outline">Demo</Badge>}
                    </div>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div
            tabIndex={0}
            role="region"
            aria-label="Research records"
            className="hidden overflow-x-auto rounded-card border border-border bg-card shadow-e1 md:block [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                  <SortHead
                    label="Title"
                    sortKey="title"
                    sort={sort}
                    onSort={toggle}
                  />
                  <SortHead
                    label="Source"
                    sortKey="source"
                    sort={sort}
                    onSort={toggle}
                  />
                  <SortHead
                    label="Category"
                    sortKey="category"
                    sort={sort}
                    onSort={toggle}
                  />
                  <SortHead
                    label="Status"
                    sortKey="status"
                    sort={sort}
                    onSort={toggle}
                  />
                  <SortHead
                    label="Found on"
                    sortKey="extractedAt"
                    sort={sort}
                    onSort={toggle}
                  />
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <StudioRow
                    key={row.id}
                    selected={selection.selected.has(row.id)}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        aria-label={`Select ${row.title}`}
                        checked={selection.selected.has(row.id)}
                        onCheckedChange={() => selection.toggle(row.id)}
                      />
                    </td>
                    <td className="max-w-[28ch] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="block truncate text-start font-medium text-foreground underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                        title={row.title}
                      >
                        {row.title}
                      </button>
                      {row.isDemo && (
                        <Badge variant="outline" className="mt-1">
                          Demo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-graphite">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-sapphire-ink hover:underline"
                        >
                          {row.source}
                          <ExternalLink aria-hidden className="size-3" />
                        </a>
                      ) : (
                        row.source
                      )}
                    </td>
                    <td className="px-4 py-3 text-graphite">
                      {row.category ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[row.status]}>
                        {STATUS_LABELS[row.status]}
                      </Badge>
                    </td>
                    <td className="u-num px-4 py-3 whitespace-nowrap text-graphite">
                      {row.extractedAtInput || "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setEditing(row)}
                      >
                        Edit
                        <span className="sr-only"> {row.title}</span>
                      </Button>
                    </td>
                  </StudioRow>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="records"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => handleStatus("SHORTLISTED")}
        >
          Shortlist
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("DISCARDED")}
        >
          Discard
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      <ResearchFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        record={editing}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="record"
        busy={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
