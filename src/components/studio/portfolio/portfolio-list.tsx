"use client";

import { useState } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { ContentStatus } from "@/generated/prisma/enums";
import { deletePortfolios, setPortfoliosStatus } from "@/actions/portfolio";
import { DemoBadge } from "@/components/studio/demo-badge";
import { SortHead, useSort } from "@/components/studio/sort-header";
import { useSelection } from "@/hooks/use-selection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";

export type PortfolioRow = {
  id: string;
  title: string;
  categoryName: string | null;
  status: ContentStatus;
  isDemo: boolean;
  /** First gallery image, falling back to the after shot. */
  thumbnailUrl: string | null;
  /** Pre-formatted on the server to keep hydration deterministic. */
  createdAt: string;
};

const STATUS_TABS: { value: ContentStatus | "ALL"; label: string }[] = [
  { value: "PUBLISHED", label: "Published" },
  { value: "REVIEW", label: "Review" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL", label: "All" },
];

const STATUS_BADGE_VARIANT: Record<
  ContentStatus,
  "success" | "warning" | "secondary" | "outline"
> = {
  PUBLISHED: "success",
  REVIEW: "warning",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};
const STATUS_BADGE_LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Published",
  REVIEW: "Review",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

export function PortfolioList({
  portfolios,
  initialQuery,
  statusCounts,
}: {
  portfolios: PortfolioRow[];
  initialQuery: string;
  statusCounts: Record<ContentStatus, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const statusFilter = searchParams.get("status") ?? "PUBLISHED";
  const demoFilter = searchParams.get("demo") === "1";
  const allCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const {
    sorted,
    sort,
    toggle: toggleSort,
  } = useSort<PortfolioRow>(
    portfolios,
    (row, key) => {
      switch (key) {
        case "title":
          return row.title;
        case "category":
          return row.categoryName;
        case "created":
          return row.createdAt;
        default:
          return null;
      }
    },
    { key: "created", dir: "desc" },
  );

  // Paginate the server-filtered rows; snap back to page 1 when the applied
  // status/search/sort key changes.
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    sorted,
    PAGE_SIZE,
    `${statusFilter}|${initialQuery}|${sort.key}|${sort.dir}`,
  );

  const selection = useSelection(pageRows.map((p) => p.id));

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleStatus(status: ContentStatus) {
    setBusy(true);
    const result = await setPortfoliosStatus(selection.ids, status);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const updated = result.data?.updated ?? 0;
    toast.success(
      `Moved ${updated} piece${updated === 1 ? "" : "s"} to ${STATUS_BADGE_LABEL[status].toLowerCase()}.`,
    );
    selection.clear();
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deletePortfolios(selection.ids);
    setBusy(false);
    setDeleteOpen(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    toast.success(`Deleted ${deleted} piece${deleted === 1 ? "" : "s"}.`);
    selection.clear();
    router.refresh();
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Filter by status"
        className="mb-4 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none]"
      >
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          const count =
            tab.value === "ALL" ? allCount : statusCounts[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() =>
                updateParams({
                  status: tab.value === "PUBLISHED" ? undefined : tab.value,
                })
              }
              className={
                active
                  ? "inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground/6 px-5 text-small font-medium text-foreground"
                  : "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              }
            >
              {tab.label}
              <span
                className={
                  active
                    ? "u-num text-12 text-sapphire-ink"
                    : "u-num text-12 text-graphite"
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

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
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search portfolio…"
            aria-label="Search portfolio"
            className="h-10 w-64 pl-10"
          />
        </form>

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
      </div>

      {portfolios.length === 0 ? (
        <EmptyState
          title="No portfolio pieces found"
          description="Try clearing the filters, or add your first case study to show off finished work."
        />
      ) : (
        <>
          {/* §12.6 — on a phone the table becomes cards. */}
          <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite md:hidden">
            <Checkbox
              aria-label="Select all"
              checked={selection.allSelected}
              onCheckedChange={selection.toggleAll}
            />
            Select all on this page
          </label>
          <ul className="space-y-3 md:hidden">
            {pageRows.map((portfolio) => (
              <li
                key={portfolio.id}
                className="rounded-card border border-border bg-card p-4 shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Select ${portfolio.title}`}
                    checked={selection.selected.has(portfolio.id)}
                    onCheckedChange={() => selection.toggle(portfolio.id)}
                    className="mt-1"
                  />
                  {portfolio.thumbnailUrl ? (
                    <Image
                      src={portfolio.thumbnailUrl}
                      unoptimized={
                        !isOptimizableImageSrc(portfolio.thumbnailUrl)
                      }
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="size-12 shrink-0 rounded-lg border border-border bg-muted"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/studio/portfolio/${portfolio.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:text-sapphire-ink hover:underline"
                      >
                        {portfolio.title}
                      </Link>
                      {portfolio.isDemo && <DemoBadge />}
                    </div>
                    <p className="mt-0.5 text-small text-graphite">
                      {portfolio.categoryName ?? "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[portfolio.status]}>
                        {STATUS_BADGE_LABEL[portfolio.status]}
                      </Badge>
                      <span className="u-micro ms-auto">
                        {portfolio.createdAt}
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
            aria-label="Portfolio pieces"
            className="hidden overflow-x-auto rounded-card border border-border bg-card shadow-e1 md:block [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <table className="w-full text-sm">
              <thead>
                <StudioTableHead>
                  <th className="w-10 py-3 pl-4 pr-2">
                    <Checkbox
                      aria-label="Select all"
                      checked={selection.allSelected}
                      onCheckedChange={selection.toggleAll}
                    />
                  </th>
                  <th className="w-14 py-3 pr-3 font-medium" />
                  <SortHead
                    label="Title"
                    sortKey="title"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortHead
                    label="Category"
                    sortKey="category"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <SortHead
                    label="Created"
                    sortKey="created"
                    sort={sort}
                    onSort={toggleSort}
                    numeric
                  />
                  <th className="py-3 pr-4 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {pageRows.map((portfolio) => (
                  <StudioRow key={portfolio.id}>
                    <td className="py-3 pl-4 pr-2 align-middle">
                      <Checkbox
                        aria-label={`Select ${portfolio.title}`}
                        checked={selection.selected.has(portfolio.id)}
                        onCheckedChange={() => selection.toggle(portfolio.id)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      {portfolio.thumbnailUrl ? (
                        <Image
                          src={portfolio.thumbnailUrl}
                          unoptimized={
                            !isOptimizableImageSrc(portfolio.thumbnailUrl)
                          }
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="size-12 rounded-lg border border-border bg-muted"
                        />
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/studio/portfolio/${portfolio.id}`}
                          className="font-medium text-foreground hover:text-sapphire-ink"
                        >
                          {portfolio.title}
                        </Link>
                        {portfolio.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {portfolio.categoryName ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={STATUS_BADGE_VARIANT[portfolio.status]}>
                        {STATUS_BADGE_LABEL[portfolio.status]}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                      {portfolio.createdAt}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button asChild variant="link" size="sm" className="px-2">
                        <Link href={`/studio/portfolio/${portfolio.id}`}>
                          Edit
                        </Link>
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
        unit="pieces"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => handleStatus("PUBLISHED")}
        >
          Publish
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("DRAFT")}
        >
          {statusFilter === "ARCHIVED" ? "Restore to draft" : "Draft"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("REVIEW")}
        >
          Send to review
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("ARCHIVED")}
        >
          Archive
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={selection.count}
        noun="portfolio piece"
        busy={busy}
        onConfirm={handleDelete}
        extraWarning="Their gallery and before/after images are removed from storage too."
      />
    </div>
  );
}
