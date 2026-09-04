"use client";

import { useMemo, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePages } from "@/actions/pages";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";

export type PageRow = {
  id: string;
  title: string;
  slug: string;
  /** Pre-formatted on the server (en-IN) to keep hydration deterministic. */
  updatedAt: string;
  /** Seeded privacy/terms rows — protected from deletion. */
  legal: boolean;
};

export function PageList({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    pages,
    PAGE_SIZE,
  );
  const rowIds = useMemo(() => pageRows.map((p) => p.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deletePages(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);

    if (!result.ok) {
      // Surfaces the legal-page guard, naming the blocked rows.
      toast.error(result.error);
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    toast.success(`Deleted ${deleted} page${deleted === 1 ? "" : "s"}.`);
    selection.clear();
    router.refresh();
  }

  if (pages.length === 0) {
    return (
      <EmptyState
        title="No pages yet"
        description="The Privacy Policy and Terms pages are seeded on first deploy — if this list is empty, the seed has not run against this database."
      />
    );
  }

  return (
    <>
      <div
            tabIndex={0}
            role="region"
            aria-label="Pages"
            className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
              <th scope="col" className="px-4 py-3 font-medium">
                Title
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Slug
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Updated
              </th>
              <th scope="col" className="w-16 px-4 py-3">
                <span className="sr-only">Edit</span>
              </th>
            </StudioTableHead>
          </thead>
          <tbody>
            {pageRows.map((pageRow) => (
              <StudioRow
                key={pageRow.id}
              >
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selection.selected.has(pageRow.id)}
                    onCheckedChange={() => selection.toggle(pageRow.id)}
                    aria-label={`Select ${pageRow.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/studio/pages/${pageRow.id}`}
                      className="font-medium text-foreground hover:text-sapphire-ink"
                    >
                      {pageRow.title}
                    </Link>
                    {pageRow.legal && <Badge variant="secondary">Legal</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  /{pageRow.slug}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {pageRow.updatedAt}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="link" size="sm" className="px-2">
                    <Link href={`/studio/pages/${pageRow.id}`}>Edit</Link>
                  </Button>
                </td>
              </StudioRow>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="pages"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="page"
        onConfirm={handleDelete}
        busy={deleting}
        extraWarning="The Privacy Policy and Terms & Conditions pages are legal pages the site links to and cannot be deleted."
      />
    </>
  );
}
