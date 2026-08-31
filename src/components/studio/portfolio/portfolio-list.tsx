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
  /** First gallery image, falling back to the after shot. */
  thumbnailUrl: string | null;
  /** Pre-formatted on the server to keep hydration deterministic. */
  createdAt: string;
};

export function PortfolioList({
  portfolios,
  initialQuery,
}: {
  portfolios: PortfolioRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const statusFilter = searchParams.get("status") ?? "ALL";

  // Paginate the server-filtered rows; snap back to page 1 when the applied
  // status/search filter changes.
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    portfolios,
    PAGE_SIZE,
    `${statusFilter}|${initialQuery}`,
  );

  // Selection stays scoped to the visible page, matching useSelection semantics.
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

  async function handleStatus(status: "DRAFT" | "PUBLISHED") {
    setBusy(true);
    const result = await setPortfoliosStatus(selection.ids, status);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const updated = result.data?.updated ?? 0;
    toast.success(
      status === "PUBLISHED"
        ? `Published ${updated} piece${updated === 1 ? "" : "s"}.`
        : `Moved ${updated} piece${updated === 1 ? "" : "s"} to draft.`,
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
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {portfolios.length === 0 ? (
        <EmptyState
          title="No portfolio pieces found"
          description="Try clearing the filters, or add your first case study to show off finished work."
        />
      ) : (
        <div
            tabIndex={0}
            role="region"
            aria-label="Portfolio pieces"
            className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                <th className="py-3 pr-4 font-medium">Title</th>
                <th className="py-3 pr-4 font-medium">Category</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Created</th>
                <th className="py-3 pr-4 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </StudioTableHead>
            </thead>
            <tbody>
              {pageRows.map((portfolio) => (
                <StudioRow
                  key={portfolio.id}
                >
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
                        unoptimized={!isOptimizableImageSrc(portfolio.thumbnailUrl)}
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
                    <Link
                      href={`/studio/portfolio/${portfolio.id}`}
                      className="font-medium text-foreground hover:text-sapphire-ink"
                    >
                      {portfolio.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {portfolio.categoryName ?? "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge
                      variant={
                        portfolio.status === "PUBLISHED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {portfolio.status === "PUBLISHED" ? "Published" : "Draft"}
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
          Draft
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
