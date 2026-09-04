"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTestimonials,
  reorderTestimonial,
  setTestimonialStatus,
} from "@/actions/testimonials";
import { BulkBar } from "@/components/studio/bulk-bar";
import { DemoBadge } from "@/components/studio/demo-badge";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import {
  SortHead,
  useSort,
  type SortState,
} from "@/components/studio/sort-header";
import { StudioRow } from "@/components/studio/studio-row";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import {
  PERMISSION_BADGE_VARIANTS,
  PERMISSION_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/components/studio/testimonials/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSelection } from "@/hooks/use-selection";
import type {
  PermissionStatus,
  TestimonialStatus,
} from "@/generated/prisma/enums";

export type TestimonialRow = {
  id: string;
  name: string;
  /** Not rendered as a column — searched against, alongside name and
   *  `linkedLabel`. */
  quote: string;
  status: TestimonialStatus;
  featured: boolean;
  rating: number;
  order: number;
  permissionStatus: PermissionStatus;
  /** The linked product or case study title, or the free-text
   *  `productTitle`, in that priority — whatever a reader would recognise
   *  the row by. Null when nothing was ever recorded. */
  linkedLabel: string | null;
  isDemo: boolean;
  /** Pre-formatted on the server to keep hydration deterministic. */
  updatedAt: string;
  /** Raw timestamp for the "Updated" sort column. */
  updatedAtSort: number;
};

const STATUS_TABS: { value: TestimonialStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  ...STATUS_ORDER.map((value) => ({ value, label: STATUS_LABELS[value] })),
];

function getSortValue(row: TestimonialRow, key: string) {
  switch (key) {
    case "name":
      return row.name;
    case "status":
      return STATUS_ORDER.indexOf(row.status);
    case "rating":
      return row.rating;
    case "updated":
      return row.updatedAtSort;
    case "order":
    default:
      return row.order;
  }
}

export function TestimonialList({
  testimonials,
}: {
  testimonials: TestimonialRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);

  const statusFilter =
    (searchParams.get("status") as TestimonialStatus | null) ?? "ALL";
  // `?demo=1` narrows to Content Lab fixtures, the same switch every other
  // studio list carries.
  const demoOnly = searchParams.get("demo") === "1";

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? testimonials
        : testimonials.filter((t) => t.status === statusFilter);
    const byDemo = demoOnly ? byStatus.filter((t) => t.isDemo) : byStatus;
    const q = search.trim().toLowerCase();
    if (!q) return byDemo;
    return byDemo.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.quote.toLowerCase().includes(q) ||
        (t.linkedLabel ?? "").toLowerCase().includes(q),
    );
  }, [testimonials, statusFilter, demoOnly, search]);

  const { sorted, sort, toggle } = useSort<TestimonialRow>(
    filtered,
    getSortValue,
    { key: "order", dir: "asc" } satisfies SortState,
  );

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    sorted,
    PAGE_SIZE,
    `${statusFilter}:${demoOnly}:${search}:${sort.key}:${sort.dir}`,
  );

  const rowIds = useMemo(() => pageRows.map((t) => t.id), [pageRows]);
  const selection = useSelection(rowIds);

  // Reorder only makes sense against the natural (unsorted) order — moving a
  // row "up" while the table reads by rating or name would move it somewhere
  // the visible order does not show.
  const naturalOrder = sort.key === "order" && sort.dir === "asc";

  function updateStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete("status");
    else params.set("status", value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleDemoOnly() {
    const params = new URLSearchParams(searchParams.toString());
    if (demoOnly) params.delete("demo");
    else params.set("demo", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleDelete() {
    const count = selection.count;
    setBusy(true);
    const res = await deleteTestimonials(selection.ids);
    setBusy(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(
        `Deleted ${count} ${count === 1 ? "testimonial" : "testimonials"}.`,
      );
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleBulkStatus(status: TestimonialStatus) {
    setBusy(true);
    const res = await setTestimonialStatus(selection.ids, status);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { updated, refused } = res.data ?? { updated: 0, refused: [] };
    if (updated > 0) {
      toast.success(
        `Marked ${updated} ${updated === 1 ? "testimonial" : "testimonials"} as ${STATUS_LABELS[status].toLowerCase()}.`,
      );
    }
    if (refused.length > 0) {
      toast.error(
        `${refused.length} skipped: ${refused[0]?.reason ?? "not eligible"}${refused.length > 1 ? ` (and ${refused.length - 1} more)` : ""}`,
      );
    }
    selection.clear();
    router.refresh();
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    setReordering(true);
    const res = await reorderTestimonial(id, direction);
    setReordering(false);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  if (testimonials.length === 0) {
    return (
      <EmptyState
        title="No testimonials yet"
        description="Add your first customer quote to build trust on the storefront."
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-graphite"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, quote or linked piece…"
            aria-label="Search testimonials"
            className="w-72 ps-10"
          />
        </div>
        <button
          type="button"
          aria-pressed={demoOnly}
          onClick={toggleDemoOnly}
          className={
            demoOnly
              ? "inline-flex min-h-11 items-center rounded-full border border-sapphire-ink bg-sapphire-ink/10 px-4 text-small font-medium text-sapphire-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              : "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-small text-graphite outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          }
        >
          Demo only
        </button>
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="mb-4 flex w-fit flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={statusFilter === tab.value}
            onClick={() => updateStatusFilter(tab.value)}
            className={
              statusFilter === tab.value
                ? "inline-flex min-h-9 items-center rounded-full bg-foreground/6 px-4 text-sm font-medium text-foreground"
                : "inline-flex min-h-9 items-center rounded-full px-4 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No testimonials match"
          description="Try a different search or clear the status filter."
        />
      ) : (
        <>
          {/* Phone cards below md — same pattern as the commission board. */}
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
                    aria-label={`Select ${row.name}`}
                    checked={selection.selected.has(row.id)}
                    onCheckedChange={() => selection.toggle(row.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-small font-medium text-foreground">
                      <Link
                        href={`/studio/testimonials/${row.id}`}
                        className="rounded-input underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {row.name}
                      </Link>
                      {row.isDemo && (
                        <span className="ms-2">
                          <DemoBadge />
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-small text-graphite">
                      {row.quote}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANTS[row.status]}>
                        {STATUS_LABELS[row.status]}
                      </Badge>
                      <Badge
                        variant={
                          PERMISSION_BADGE_VARIANTS[row.permissionStatus]
                        }
                      >
                        {PERMISSION_LABELS[row.permissionStatus]}
                      </Badge>
                      <span className="u-num ms-auto text-graphite">
                        {row.rating}★
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
            aria-label="Testimonials"
            className="hidden overflow-x-auto rounded-card border border-border bg-card shadow-e1 md:block [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <table className="w-full text-sm">
              <thead>
                <StudioTableHead>
                  <th scope="col" className="w-12 px-4 py-3">
                    <Checkbox
                      checked={selection.allSelected}
                      onCheckedChange={selection.toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <SortHead
                    label="Name"
                    sortKey="name"
                    sort={sort}
                    onSort={toggle}
                  />
                  <SortHead
                    label="Status"
                    sortKey="status"
                    sort={sort}
                    onSort={toggle}
                  />
                  <th scope="col" className="px-4 py-3 font-medium">
                    Featured
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Linked piece
                  </th>
                  <SortHead
                    label="Rating"
                    sortKey="rating"
                    sort={sort}
                    onSort={toggle}
                    numeric
                  />
                  <th scope="col" className="px-4 py-3 font-medium">
                    Permission
                  </th>
                  <SortHead
                    label="Updated"
                    sortKey="updated"
                    sort={sort}
                    onSort={toggle}
                    numeric
                  />
                  <th scope="col" className="w-24 px-4 py-3">
                    <span className="sr-only">Order</span>
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {pageRows.map((row, index) => {
                  const globalIndex = (page - 1) * pageSize + index;
                  return (
                    <StudioRow
                      key={row.id}
                      selected={selection.selected.has(row.id)}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selection.selected.has(row.id)}
                          onCheckedChange={() => selection.toggle(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <Link
                          href={`/studio/testimonials/${row.id}`}
                          className="rounded-input underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {row.name}
                        </Link>
                        {row.isDemo && (
                          <span className="ms-2">
                            <DemoBadge />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_VARIANTS[row.status]}>
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-graphite">
                        {row.featured ? "Yes" : "—"}
                      </td>
                      <td className="max-w-[24ch] px-4 py-3">
                        <span
                          className="block truncate text-graphite"
                          title={row.linkedLabel ?? undefined}
                        >
                          {row.linkedLabel ?? "—"}
                        </span>
                      </td>
                      <td className="u-num px-4 py-3 whitespace-nowrap text-graphite">
                        {row.rating}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            PERMISSION_BADGE_VARIANTS[row.permissionStatus]
                          }
                        >
                          {PERMISSION_LABELS[row.permissionStatus]}
                        </Badge>
                      </td>
                      <td className="u-num px-4 py-3 whitespace-nowrap text-graphite">
                        {row.updatedAt}
                      </td>
                      <td className="px-4 py-3">
                        {naturalOrder ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={globalIndex === 0 || reordering}
                              onClick={() => handleReorder(row.id, "up")}
                              aria-label={`Move ${row.name} up`}
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={globalIndex === total - 1 || reordering}
                              onClick={() => handleReorder(row.id, "down")}
                              aria-label={`Move ${row.name} down`}
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="sr-only">
                            Sort by Order to reorder rows
                          </span>
                        )}
                      </td>
                    </StudioRow>
                  );
                })}
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
        unit="testimonials"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleBulkStatus("PUBLISHED")}
        >
          Publish
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleBulkStatus("VERIFIED")}
        >
          Mark verified
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={() => handleBulkStatus("ARCHIVED")}
        >
          Archive
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="min-h-11"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="testimonial"
        onConfirm={handleDelete}
        busy={busy}
      />
    </>
  );
}
