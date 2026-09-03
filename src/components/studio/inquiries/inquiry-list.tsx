"use client";

import { useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { InquirySource, InquiryStatus } from "@/generated/prisma/enums";
import { deleteInquiries, setInquiriesStatus } from "@/actions/inquiries";
import { useSelection } from "@/hooks/use-selection";
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
import { BulkBar } from "@/components/studio/bulk-bar";
import { ColumnsMenu } from "@/components/studio/columns-menu";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { DemoBadge } from "@/components/studio/demo-badge";
import { EmptyState } from "@/components/studio/page-header";
import { Pagination } from "@/components/studio/pagination";
import { SortHead, useSort } from "@/components/studio/sort-header";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import type { ColumnDef } from "@/lib/column-visibility";
import {
  SELECTABLE_STATUSES,
  SOURCE_BADGE_VARIANTS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
} from "@/components/studio/inquiries/labels";

export type InquiryRow = {
  id: string;
  /** Pre-formatted "#RR-<n>" reference — built on the server like the date. */
  number: string;
  customerName: string;
  phone: string;
  source: InquirySource;
  productTitle: string | null;
  status: InquiryStatus;
  isDemo: boolean;
  /** Pre-formatted on the server to keep hydration deterministic. */
  createdAt: string;
};

const INQUIRY_COLUMNS: ColumnDef[] = [
  { key: "source", label: "Source" },
  { key: "product", label: "Product" },
  { key: "status", label: "Status" },
  { key: "received", label: "Received" },
];

export function InquiryList({
  inquiries,
  initialQuery,
  page,
  total,
  pageSize,
  canDelete,
}: {
  inquiries: InquiryRow[];
  initialQuery: string;
  page: number;
  total: number;
  pageSize: number;
  /** Delete is ADMIN-only server-side — don't show EDITOR a dead button. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const statusFilter = searchParams.get("status") ?? "ALL";
  const sourceFilter = searchParams.get("source") ?? "ALL";
  const demoFilter = searchParams.get("demo") === "1";

  // Rows are the current server page (ENG-805), sorted client-side —
  // SortHead sorts what is on screen, same as products.
  const {
    sorted,
    sort,
    toggle: toggleSort,
  } = useSort<InquiryRow>(
    inquiries,
    (row, key) => {
      switch (key) {
        case "customer":
          return row.customerName;
        case "source":
          return row.source;
        case "product":
          return row.productTitle;
        case "status":
          return row.status;
        case "received":
          return row.createdAt;
        default:
          return null;
      }
    },
    { key: "received", dir: "desc" },
  );
  const pageRows = sorted;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selection = useSelection(pageRows.map((i) => i.id));
  const columns = useColumnVisibility("inquiries", INQUIRY_COLUMNS);

  // Filter/search changes reset to page 1; pagination sets `page` explicitly.
  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    if (!("page" in next)) params.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleStatus(status: InquiryStatus) {
    setBusy(true);
    const result = await setInquiriesStatus(selection.ids, status);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const updated = result.data?.updated ?? 0;
    toast.success(
      `Marked ${updated} ${updated === 1 ? "inquiry" : "inquiries"} as ${STATUS_LABELS[status].toLowerCase()}.`,
    );
    selection.clear();
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteInquiries(selection.ids);
    setBusy(false);
    setDeleteOpen(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    toast.success(
      `Deleted ${deleted} ${deleted === 1 ? "inquiry" : "inquiries"}.`,
    );
    selection.clear();
    router.refresh();
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: search.trim() || undefined });
          }}
        >
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-graphite"
          />
          <Input
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            aria-label="Search inquiries"
            className="w-64 ps-10"
          />
        </form>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            updateParams({ status: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {SELECTABLE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sourceFilter}
          onValueChange={(value) =>
            updateParams({ source: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            {(Object.keys(SOURCE_LABELS) as InquirySource[]).map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABELS[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          aria-pressed={demoFilter}
          onClick={() => updateParams({ demo: demoFilter ? undefined : "1" })}
          className={
            demoFilter
              ? "inline-flex min-h-11 items-center rounded-full border border-sapphire-ink bg-sapphire-ink/10 px-4 text-small font-medium text-sapphire-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              : "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-small text-graphite outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          }
        >
          Demo only
        </button>

        <ColumnsMenu tableKey="inquiries" columns={INQUIRY_COLUMNS} />
      </div>

      {inquiries.length === 0 ? (
        <EmptyState
          title="No inquiries found"
          description="Try clearing the filters — WhatsApp orders sent from the public site will appear here."
        />
      ) : (
        <>
          {/* §12.6 — on a phone the table becomes cards. Both views are rendered
            and one is `display:none` per breakpoint, which also removes it
            from the accessibility tree, so nothing is announced twice. */}
          <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite md:hidden">
            <Checkbox
              aria-label="Select all"
              checked={selection.allSelected}
              onCheckedChange={selection.toggleAll}
            />
            Select all on this page
          </label>
          <ul className="space-y-3 md:hidden">
            {pageRows.map((inquiry) => (
              <li
                key={inquiry.id}
                className="rounded-card border border-border bg-card p-4 shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Select inquiry from ${inquiry.customerName}`}
                    checked={selection.selected.has(inquiry.id)}
                    onCheckedChange={() => selection.toggle(inquiry.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="u-micro">{inquiry.number}</p>
                    <h3 className="mt-0.5 flex flex-wrap items-center gap-2 text-small font-medium text-foreground">
                      <Link
                        href={`/studio/inquiries/${inquiry.id}`}
                        className="rounded-input underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {inquiry.customerName}
                      </Link>
                      {inquiry.isDemo && <DemoBadge />}
                    </h3>
                    <p className="u-num text-12 text-graphite">
                      {inquiry.phone}
                    </p>
                    <p
                      className="mt-2 line-clamp-2 text-small text-graphite"
                      title={inquiry.productTitle ?? undefined}
                    >
                      {inquiry.productTitle ?? "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANTS[inquiry.status]}>
                        {STATUS_LABELS[inquiry.status]}
                      </Badge>
                      <Badge variant={SOURCE_BADGE_VARIANTS[inquiry.source]}>
                        {SOURCE_LABELS[inquiry.source]}
                      </Badge>
                      <span className="u-micro ms-auto">
                        {inquiry.createdAt}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div
            tabIndex={0}
            role="region"
            aria-label="Commissions"
            className="relative hidden overflow-x-auto rounded-card border border-border bg-card shadow-e1 md:block xl:overflow-x-visible [contain:paint] xl:[contain:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <table className="w-full min-w-[52rem] text-small xl:min-w-0">
              <thead className="xl:sticky xl:top-16 xl:z-20 xl:bg-card">
                <StudioTableHead>
                  <th className="w-10 py-3 pe-2 ps-4 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-0">
                    <Checkbox
                      aria-label="Select all"
                      checked={selection.allSelected}
                      onCheckedChange={selection.toggleAll}
                    />
                  </th>
                  {/* Fixed width so the pinned Customer column's offset stays
                    arithmetic: a content-sized reference column would shift it
                    the moment the numbers gain a digit. */}
                  <th className="w-20 py-3 pe-4 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-10">
                    <span aria-hidden>#</span>
                    <span className="sr-only">Reference</span>
                  </th>
                  <SortHead
                    label="Customer"
                    sortKey="customer"
                    sort={sort}
                    onSort={toggleSort}
                    className="max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-30"
                  />
                  {columns.isVisible("source") && (
                    <SortHead
                      label="Source"
                      sortKey="source"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  )}
                  {columns.isVisible("product") && (
                    <SortHead
                      label="Product"
                      sortKey="product"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  )}
                  {columns.isVisible("status") && (
                    <SortHead
                      label="Status"
                      sortKey="status"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  )}
                  {columns.isVisible("received") && (
                    <SortHead
                      label="Received"
                      sortKey="received"
                      sort={sort}
                      onSort={toggleSort}
                      numeric
                    />
                  )}
                  <th className="py-3 pe-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {pageRows.map((inquiry) => (
                  <StudioRow
                    key={inquiry.id}
                    selected={selection.selected.has(inquiry.id)}
                  >
                    <td className="py-3 pe-2 ps-4 align-middle max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-0">
                      <Checkbox
                        aria-label={`Select inquiry from ${inquiry.customerName}`}
                        checked={selection.selected.has(inquiry.id)}
                        onCheckedChange={() => selection.toggle(inquiry.id)}
                      />
                    </td>
                    <td className="w-20 py-3 pe-4 whitespace-nowrap max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-10">
                      <span className="u-num text-12 text-graphite">
                        {inquiry.number}
                      </span>
                    </td>
                    <td className="py-3 pe-4 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-30">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/studio/inquiries/${inquiry.id}`}
                          className="whitespace-nowrap rounded-input font-medium text-foreground underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {inquiry.customerName}
                        </Link>
                        {inquiry.isDemo && <DemoBadge />}
                      </span>
                      <p className="u-num text-12 text-graphite">
                        {inquiry.phone}
                      </p>
                    </td>
                    {columns.isVisible("source") && (
                      <td className="py-3 pe-4">
                        <Badge variant={SOURCE_BADGE_VARIANTS[inquiry.source]}>
                          {SOURCE_LABELS[inquiry.source]}
                        </Badge>
                      </td>
                    )}
                    {/* The catalogue's titles run long (SEO-fed). One clamped
                      line keeps the row scannable; the full title stays in the
                      tooltip and on the detail page. */}
                    {columns.isVisible("product") && (
                      <td className="max-w-[34ch] py-3 pe-4">
                        <span
                          className="block truncate text-graphite"
                          title={inquiry.productTitle ?? undefined}
                        >
                          {inquiry.productTitle ?? "—"}
                        </span>
                      </td>
                    )}
                    {columns.isVisible("status") && (
                      <td className="py-3 pe-4">
                        <Badge variant={STATUS_BADGE_VARIANTS[inquiry.status]}>
                          {STATUS_LABELS[inquiry.status]}
                        </Badge>
                      </td>
                    )}
                    {columns.isVisible("received") && (
                      <td className="u-num py-3 pe-4 whitespace-nowrap text-graphite">
                        {inquiry.createdAt}
                      </td>
                    )}
                    <td className="py-3 pe-4 text-end">
                      <Link
                        href={`/studio/inquiries/${inquiry.id}`}
                        className="inline-flex min-h-11 items-center rounded-input px-2 text-small font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        View
                        <span className="sr-only"> {inquiry.customerName}</span>
                      </Link>
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
        onPageChange={(p) => updateParams({ page: String(p) })}
        unit="orders"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="secondary"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleStatus("CONTACTED")}
        >
          Mark contacted
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleStatus("QUOTED")}
        >
          Mark quoted
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleStatus("CONFIRMED")}
        >
          Mark confirmed
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleStatus("DELIVERED")}
        >
          Mark delivered
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleStatus("CLOSED")}
        >
          Mark closed
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="destructive"
            className="min-h-11"
            disabled={busy}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> Delete
          </Button>
        )}
      </BulkBar>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={selection.count}
        noun="inquiry"
        busy={busy}
        onConfirm={handleDelete}
        extraWarning="The customer's message and selections are lost for good."
      />
    </div>
  );
}
