"use client";

import { useMemo, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import type { ContentStatus } from "@/generated/prisma/enums";
import { deleteBlogPosts, setBlogPostsStatus } from "@/actions/blog";
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

export type BlogPostRow = {
  id: string;
  title: string;
  status: ContentStatus;
  categoryName: string | null;
  tagNames: string[];
  authorName: string;
  /** Pre-formatted on the server (en-IN) to keep hydration deterministic. */
  publishedAt: string | null;
};

const VISIBLE_TAGS = 3;

export function BlogPostList({
  posts,
  initialQuery,
}: {
  posts: BlogPostRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { pageRows, page, setPage, pageCount, total, pageSize } =
    usePagination(posts, PAGE_SIZE);
  const rowIds = useMemo(() => pageRows.map((p) => p.id), [pageRows]);
  const selection = useSelection(rowIds);

  const statusFilter = searchParams.get("status") ?? "ALL";

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
    const result = await setBlogPostsStatus(selection.ids, status);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const updated = result.data?.updated ?? 0;
    toast.success(
      status === "PUBLISHED"
        ? `Published ${updated} post${updated === 1 ? "" : "s"}.`
        : `Moved ${updated} post${updated === 1 ? "" : "s"} to draft.`,
    );
    selection.clear();
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteBlogPosts(selection.ids);
    setBusy(false);
    setDeleteOpen(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    toast.success(`Deleted ${deleted} post${deleted === 1 ? "" : "s"}.`);
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
            placeholder="Search posts…"
            aria-label="Search posts"
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

      {posts.length === 0 ? (
        <EmptyState
          title="No posts found"
          description="Try clearing the filters, or write your first post to start the blog."
        />
      ) : (
        <div
            tabIndex={0}
            role="region"
            aria-label="Journal posts"
            className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                <th className="py-3 pr-4 font-medium">Title</th>
                <th className="py-3 pr-4 font-medium">Category</th>
                <th className="py-3 pr-4 font-medium">Tags</th>
                <th className="py-3 pr-4 font-medium">Author</th>
                <th className="py-3 pr-4 font-medium">Published</th>
                <th className="py-3 pr-4 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </StudioTableHead>
            </thead>
            <tbody>
              {pageRows.map((post) => (
                <StudioRow
                  key={post.id}
                >
                  <td className="py-3 pl-4 pr-2 align-middle">
                    <Checkbox
                      aria-label={`Select ${post.title}`}
                      checked={selection.selected.has(post.id)}
                      onCheckedChange={() => selection.toggle(post.id)}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/studio/blog/${post.id}`}
                        className="font-medium text-foreground hover:text-sapphire-ink"
                      >
                        {post.title}
                      </Link>
                      <Badge
                        variant={
                          post.status === "PUBLISHED" ? "default" : "secondary"
                        }
                      >
                        {post.status === "PUBLISHED" ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {post.categoryName ?? "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {post.tagNames.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {post.tagNames.slice(0, VISIBLE_TAGS).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        {post.tagNames.length > VISIBLE_TAGS && (
                          <span className="text-xs text-muted-foreground">
                            +{post.tagNames.length - VISIBLE_TAGS}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {post.authorName}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                    {post.publishedAt ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Button asChild variant="link" size="sm" className="px-2">
                      <Link href={`/studio/blog/${post.id}`}>Edit</Link>
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
        unit="posts"
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
        noun="post"
        busy={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
