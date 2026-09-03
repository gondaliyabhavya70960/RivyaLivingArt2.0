"use client";

import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

import {
  setScrapedReviewStatus,
  updateStagedProduct,
} from "@/actions/scraper-review";
import { ApproveImportDialog } from "@/components/studio/scraper/approve-import-dialog";
import { BulkBar } from "@/components/studio/bulk-bar";
import { EmptyState } from "@/components/studio/page-header";
import { Pagination, PAGE_SIZE, usePagination } from "@/components/studio/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { useSelection } from "@/hooks/use-selection";

export type ScrapedRow = {
  id: string;
  title: string;
  slug: string;
  url: string;
  sourceKey: string;
  /** Human website name for the source (e.g. "sumaiyaresin.art"). */
  sourceName: string;
  vertical: string;
  category: string | null;
  shortTagline: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  timeline: string | null;
  materials: string | null;
  dimensions: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  images: string[];
  imageAlts: string[];
  reviewStatus: ReviewStatus;
  /** Precomputed on the server: lastSeen > firstSeen. */
  updated: boolean;
  /** Pre-formatted on the server (en-IN). */
  firstSeen: string;
  lastSeen: string;
};

export type ReviewCounts = Record<ReviewStatus, number>;

const REVIEW_STATUS_ORDER: ReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "IMPORTED",
];

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  IMPORTED: "Imported",
};

const STATUS_BADGE: Record<
  ReviewStatus,
  { variant: "default" | "secondary" | "outline" | "success"; className?: string }
> = {
  PENDING: { variant: "outline" },
  APPROVED: { variant: "success" },
  REJECTED: { variant: "secondary", className: "text-muted-foreground" },
  IMPORTED: { variant: "default" },
};

const inr = new Intl.NumberFormat("en-IN");

function formatPriceRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min !== max) {
    return `₹${inr.format(min)} – ₹${inr.format(max)}`;
  }
  return `₹${inr.format((min ?? max) as number)}`;
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const config = STATUS_BADGE[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {status.toLowerCase()}
    </Badge>
  );
}

// ————————————————————— Card —————————————————————

function ReviewCard({
  row,
  checked,
  onToggle,
  onOpen,
}: {
  row: ScrapedRow;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="relative">
      {/* Selection overlay — a sibling of the card button, never nested. */}
      <div className="absolute start-2 top-2 z-10 rounded-input bg-card p-1 shadow-e1">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Select ${row.title}`}
        />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col overflow-hidden rounded-card border border-border bg-card text-left transition-shadow hover:shadow-e1 motion-reduce:transition-none"
      >
        {row.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- scraped images live on arbitrary hosts; never next/image
          <img
            src={row.images[0]}
            alt={row.imageAlts[0] ?? row.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-40 w-full rounded-t-2xl bg-muted object-cover"
          />
        ) : (
          <div aria-hidden className="h-40 w-full rounded-t-2xl bg-muted" />
        )}
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <p className="line-clamp-2 text-sm font-medium text-foreground">
            {row.title}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatPriceRange(row.priceMin, row.priceMax)}
          </p>
          {row.shortTagline && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {row.shortTagline}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
            <Badge variant="secondary" title="Source website">
              {row.sourceName}
            </Badge>
            {row.category && <Badge variant="secondary">{row.category}</Badge>}
            <Badge variant="outline">{row.vertical}</Badge>
            <Badge variant={row.updated ? "outline" : "secondary"}>
              {row.updated ? "updated" : "new"}
            </Badge>
            <StatusBadge status={row.reviewStatus} />
          </div>
        </div>
      </button>
    </div>
  );
}

// ————————————————————— Detail sheet —————————————————————

function DetailSheetBody({
  row,
  busy,
  onReview,
  onSave,
}: {
  row: ScrapedRow;
  busy: boolean;
  onReview: (status: "APPROVED" | "REJECTED") => void;
  onSave: (patch: {
    id: string;
    title: string;
    shortTagline: string | null;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [tagline, setTagline] = useState(row.shortTagline ?? "");
  const [category, setCategory] = useState(row.category ?? "");
  const [priceMin, setPriceMin] = useState(
    row.priceMin != null ? String(row.priceMin) : "",
  );
  const [priceMax, setPriceMax] = useState(
    row.priceMax != null ? String(row.priceMax) : "",
  );
  const [saving, setSaving] = useState(false);
  const locked = row.reviewStatus === "IMPORTED";

  async function handleSave() {
    const min = priceMin.trim() === "" ? null : Math.round(Number(priceMin));
    const max = priceMax.trim() === "" ? null : Math.round(Number(priceMax));
    if (
      (min != null && !Number.isFinite(min)) ||
      (max != null && !Number.isFinite(max))
    ) {
      toast.error("Prices must be numbers.");
      return;
    }
    setSaving(true);
    await onSave({
      id: row.id,
      title: title.trim(),
      shortTagline: tagline.trim() || null,
      category: category.trim() || null,
      priceMin: min,
      priceMax: max,
    });
    setSaving(false);
  }

  return (
    <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
      <SheetHeader className="pr-10">
        <SheetTitle className="text-lg leading-snug">{row.title}</SheetTitle>
        <SheetDescription>
          {row.sourceName} · {formatPriceRange(row.priceMin, row.priceMax)} ·
          last seen {row.lastSeen}
        </SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="secondary" title="Source website">
            {row.sourceName}
          </Badge>
          {row.category && <Badge variant="secondary">{row.category}</Badge>}
          <Badge variant="outline">{row.vertical}</Badge>
          <Badge variant={row.updated ? "outline" : "secondary"}>
            {row.updated ? "updated" : "new"}
          </Badge>
          <StatusBadge status={row.reviewStatus} />
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {/* Inline edit — curate the staged data before it imports as a draft. */}
        <div className="space-y-3 rounded-card border border-border p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
              Edit before import
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={locked || saving || busy || !title.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-title-${row.id}`} className="text-xs">
              Title
            </Label>
            <Input
              id={`edit-title-${row.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-tagline-${row.id}`} className="text-xs">
              Tagline
            </Label>
            <Input
              id={`edit-tagline-${row.id}`}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-category-${row.id}`} className="text-xs">
              Category (source label)
            </Label>
            <Input
              id={`edit-category-${row.id}`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={locked}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-min-${row.id}`} className="text-xs">
                Price min (₹)
              </Label>
              <Input
                id={`edit-min-${row.id}`}
                type="number"
                inputMode="numeric"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-max-${row.id}`} className="text-xs">
                Price max (₹)
              </Label>
              <Input
                id={`edit-max-${row.id}`}
                type="number"
                inputMode="numeric"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>
        </div>

        {row.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {row.images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- scraped images live on arbitrary hosts; never next/image
              <img
                key={`${url}-${i}`}
                src={url}
                alt={row.imageAlts[i] ?? row.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="size-20 shrink-0 rounded-lg bg-muted object-cover"
              />
            ))}
          </div>
        )}

        {row.shortTagline && (
          <p className="text-sm font-medium text-foreground">{row.shortTagline}</p>
        )}

        {row.description && (
          <div>
            <h3 className="mb-1 text-12 font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </h3>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {row.description}
            </p>
          </div>
        )}

        {(row.materials || row.dimensions || row.timeline) && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            {row.materials && (
              <>
                <dt className="text-muted-foreground">Materials</dt>
                <dd className="text-foreground">{row.materials}</dd>
              </>
            )}
            {row.dimensions && (
              <>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd className="text-foreground">{row.dimensions}</dd>
              </>
            )}
            {row.timeline && (
              <>
                <dt className="text-muted-foreground">Timeline</dt>
                <dd className="text-foreground">{row.timeline}</dd>
              </>
            )}
          </dl>
        )}

        {(row.seoTitle || row.seoDescription) && (
          <div className="space-y-1 rounded-card bg-muted/60 p-3 text-sm">
            <h3 className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
              SEO
            </h3>
            {row.seoTitle && (
              <p className="font-medium text-foreground">{row.seoTitle}</p>
            )}
            {row.seoDescription && (
              <p className="text-muted-foreground">{row.seoDescription}</p>
            )}
          </div>
        )}

        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-sapphire-ink hover:underline"
        >
          View on {row.sourceName}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || row.reviewStatus === "IMPORTED"}
          onClick={() => onReview("REJECTED")}
        >
          <X /> Reject
        </Button>
        <Button
          size="sm"
          disabled={busy || row.reviewStatus === "IMPORTED"}
          onClick={() => onReview("APPROVED")}
        >
          <Check /> Approve
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}

// ————————————————————— Grid —————————————————————

export function ReviewGrid({
  rows,
  sources,
  categories,
  counts,
  activeSource,
  activeStatus,
  initialQuery,
  truncated,
}: {
  rows: ScrapedRow[];
  /** Distinct sources present in staging — key + human website name. */
  sources: { key: string; name: string }[];
  categories: { id: string; name: string }[];
  counts: ReviewCounts;
  /** "ALL" or a sourceKey. */
  activeSource: string;
  /** "ALL" or a ReviewStatus. */
  activeStatus: string;
  initialQuery: string;
  truncated: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    rows,
    PAGE_SIZE,
    `${activeSource}|${activeStatus}|${initialQuery}`,
  );

  // Selection is scoped to the visible page.
  const rowIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);
  const selection = useSelection(rowIds);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

  const [detail, setDetail] = useState<ScrapedRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const approvedSelected = selection.ids.filter(
    (id) => rowById.get(id)?.reviewStatus === "APPROVED",
  ).length;

  function setParam(key: "source" | "status" | "q", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const isDefault =
      key === "status"
        ? value === "PENDING"
        : key === "source"
          ? value === "ALL"
          : value === "";
    if (isDefault) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setParam("q", String(data.get("q") ?? "").trim());
  }

  async function handleReview(ids: string[], status: "APPROVED" | "REJECTED") {
    setBusy(true);
    const res = await setScrapedReviewStatus(ids, status);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const updated = res.data?.updated ?? 0;
    toast.success(
      `${updated} item${updated === 1 ? "" : "s"} ${
        status === "APPROVED" ? "approved" : "rejected"
      }.`,
    );
    router.refresh();
  }

  async function handleDetailReview(status: "APPROVED" | "REJECTED") {
    if (!detail) return;
    await handleReview([detail.id], status);
    setDetail(null);
  }

  async function handleSaveEdit(patch: {
    id: string;
    title: string;
    shortTagline: string | null;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
  }) {
    const res = await updateStagedProduct(patch);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved.");
    // Reflect the edit in the open sheet immediately; server data refreshes too.
    setDetail((d) =>
      d && d.id === patch.id
        ? {
            ...d,
            title: patch.title,
            shortTagline: patch.shortTagline,
            category: patch.category,
            priceMin: patch.priceMin,
            priceMax: patch.priceMax,
          }
        : d,
    );
    router.refresh();
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={activeSource}
          onValueChange={(value) => setParam("source", value)}
        >
          <SelectTrigger size="sm" aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.key} value={source.key}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeStatus}
          onValueChange={(value) => setParam("status", value)}
        >
          <SelectTrigger size="sm" aria-label="Filter by review status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_STATUS_ORDER.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
            <SelectItem value="ALL">All statuses</SelectItem>
          </SelectContent>
        </Select>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            key={initialQuery}
            name="q"
            defaultValue={initialQuery}
            placeholder="Search title or slug…"
            aria-label="Search staged products"
            className="h-9 w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Count summary chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {REVIEW_STATUS_ORDER.map((status) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {STATUS_LABELS[status]}
            <span className="tabular-nums text-foreground">{counts[status]}</span>
          </span>
        ))}
      </div>

      {truncated && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing the 200 most recently seen items — narrow the filters to see
          the rest.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to review here"
          description="Run a scrape job or loosen the filters — freshly scraped products land in this queue as pending."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {pageRows.map((row) => (
            <ReviewCard
              key={row.id}
              row={row}
              checked={selection.selected.has(row.id)}
              onToggle={() => selection.toggle(row.id)}
              onOpen={() => setDetail(row)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="products"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => handleReview(selection.ids, "APPROVED")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleReview(selection.ids, "REJECTED")}
        >
          Reject
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setImportOpen(true)}>
          Import approved…
        </Button>
      </BulkBar>

      <ApproveImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        ids={selection.ids}
        approvedCount={approvedSelected}
        categories={categories}
        onDone={() => {
          selection.clear();
          router.refresh();
        }}
      />

      <Sheet
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        {detail && (
          <DetailSheetBody
            key={detail.id}
            row={detail}
            busy={busy}
            onReview={handleDetailReview}
            onSave={handleSaveEdit}
          />
        )}
      </Sheet>
    </>
  );
}
