"use client";

import { useCallback, useMemo, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Globe, Layers, Loader2, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createScrapeJob,
  createTierJobs,
  deleteScrapeJobs,
} from "@/actions/scraper-jobs";
import type {
  ScrapeJobStatus,
  ScrapePlatform,
  ScrapeTier,
} from "@/generated/prisma/enums";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { SortHead, useSort } from "@/components/studio/sort-header";
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
import { useSelection } from "@/hooks/use-selection";
import { useScrapeRunner } from "@/hooks/use-scrape-runner";
import { SCRAPE_TIERS, scrapeTierStudioLabel } from "@/lib/scraper/purge";

export type JobRow = {
  id: string;
  sourceName: string;
  /** Source registry key — links the row to the source detail page. */
  sourceKey: string;
  platform: ScrapePlatform;
  status: ScrapeJobStatus;
  cursorPage: number;
  totalScraped: number;
  newCount: number;
  updatedCount: number;
  error: string | null;
  /** Pre-formatted on the server (en-IN); raw ts for sorting. */
  createdAt: string;
  createdAtTs: number;
  finishedAt: string | null;
};

export type TierCounts = Record<ScrapeTier, number>;

/**
 * The source tiers in the owner's order — size tiers first — and their
 * labels, both read from `purge.ts`. The batch buttons used to list only the
 * four retired provenance tiers, so the reference sites filed under the size
 * tiers on 2026-09-15 could not be queued from here at all; then they carried
 * a fourth hand-typed copy of the labels, which is how "Tier 1 — Large" came
 * to mean a supplier list on this screen and a product on the next.
 */
const TIERS = SCRAPE_TIERS.map((value) => ({
  value,
  label: scrapeTierStudioLabel(value),
}));

function hostLabel(input: string): string {
  try {
    const url = new URL(
      /^https?:\/\//i.test(input) ? input : `https://${input}`,
    );
    return url.hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

function StatusBadge({ status }: { status: ScrapeJobStatus }) {
  switch (status) {
    case "QUEUED":
      return <Badge variant="outline">Queued</Badge>;
    case "RUNNING":
      return (
        <Badge>
          <Loader2 className="animate-spin" aria-hidden />
          Running
        </Badge>
      );
    case "DONE":
      return <Badge variant="secondary">Done</Badge>;
    case "FAILED":
      return (
        <Badge
          variant="outline"
          className="border-destructive/40 text-destructive"
        >
          Failed
        </Badge>
      );
  }
}

export function JobDashboard({
  jobs,
  tierCounts,
}: {
  jobs: JobRow[];
  tierCounts: TierCounts;
}) {
  const router = useRouter();

  // ————— Scrape-a-website card —————
  const [url, setUrl] = useState("");
  const [tier, setTier] = useState<ScrapeTier>("RESIN_GOODS");
  const [starting, setStarting] = useState(false);

  // ————— Batch card —————
  const [batchBusy, setBatchBusy] = useState<string | null>(null);
  // A source-tier press fans out across every enabled source in it. That is a
  // legitimate action and a large one, so it is confirmed with the count it
  // will actually queue rather than fired on the click.
  const [pendingBatch, setPendingBatch] = useState<ScrapeTier | "ALL" | null>(
    null,
  );

  // ————— Runner (concurrency 1, shared with every /studio/scraper screen) —————
  // The queue, active job and snapshots live in a module store
  // (use-scrape-runner.ts) mounted once by scraper/layout.tsx, so the loop
  // survives navigating to a source's page and back rather than dying with
  // this component.
  const { activeJobId, queueSize, snapshots, enqueue } = useScrapeRunner();
  /** Labels for jobs created this session, before router.refresh lands. */
  const [names, setNames] = useState<Record<string, string>>({});

  async function handleStart() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Enter a website URL to scrape.");
      return;
    }
    setStarting(true);
    const res = await createScrapeJob({ inputUrl: trimmed, tier });
    setStarting(false);
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "Could not create the scrape job.");
      return;
    }
    const jobId = res.data.jobId;
    if (res.data.alreadyRunning) {
      toast.info("That source was already being scraped — showing that run.");
    }
    setNames((prev) => ({ ...prev, [jobId]: hostLabel(trimmed) }));
    setUrl("");
    router.refresh();
    enqueue([jobId]);
  }

  async function handleBatch(batchTier: ScrapeTier | "ALL") {
    setBatchBusy(batchTier);
    const res = await createTierJobs(batchTier);
    setBatchBusy(null);
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "Could not queue the batch.");
      return;
    }
    const { jobIds, skipped } = res.data;
    if (jobIds.length === 0) {
      toast.info(
        skipped.length > 0
          ? `Already scraping: ${skipped.join(", ")}. Nothing new to queue.`
          : "No enabled, platform-detected sources in this source tier.",
      );
      return;
    }
    toast.success(
      skipped.length > 0
        ? `Queued ${jobIds.length} scrape jobs — skipped ${skipped.length} already running.`
        : `Queued ${jobIds.length} scrape jobs.`,
    );
    router.refresh();
    enqueue(res.data.jobIds);
  }

  // ————— Jobs table selection / sort / delete —————
  // Selection is scoped to the visible page (see the sort/pagination below).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getJobValue = useCallback((row: JobRow, key: string) => {
    switch (key) {
      case "sourceName":
        return row.sourceName.toLowerCase();
      case "platform":
        return row.platform;
      case "status":
        return row.status;
      case "pages":
        return row.cursorPage;
      case "total":
        return row.totalScraped;
      case "created":
        return row.createdAtTs;
      default:
        return null;
    }
  }, []);

  const {
    sorted: sortedJobs,
    sort: jobSort,
    toggle: toggleJob,
  } = useSort(jobs, getJobValue, { key: "created", dir: "desc" });

  const {
    pageRows: jobPage,
    page: jobPageNum,
    setPage: setJobPage,
    pageCount: jobPageCount,
    total: jobTotal,
    pageSize: jobPageSize,
  } = usePagination(sortedJobs, PAGE_SIZE);

  const rowIds = useMemo(() => jobPage.map((j) => j.id), [jobPage]);
  const selection = useSelection(rowIds);

  async function handleDelete() {
    const count = selection.count;
    setDeleting(true);
    const res = await deleteScrapeJobs(selection.ids);
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(`Deleted ${count} ${count === 1 ? "job" : "jobs"}.`);
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const activeSnap = activeJobId ? snapshots[activeJobId] : undefined;
  const activeName = activeJobId
    ? (jobs.find((j) => j.id === activeJobId)?.sourceName ??
      names[activeJobId] ??
      "source")
    : null;
  const totalSources = TIERS.reduce((sum, t) => sum + tierCounts[t.value], 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ————— Scrape a website ————— */}
        <section className="rounded-card border border-border bg-card p-5 shadow-e1">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <Globe className="size-4 text-sapphire-ink" aria-hidden />
            Scrape a website
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste any store URL. The platform is auto-detected and the site is
            saved into the source registry under the chosen source tier.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="scrape-url">Website URL</Label>
              <Input
                id="scrape-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example-resin-store.in"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scrape-tier">Source tier</Label>
                <Select
                  value={tier}
                  onValueChange={(v) => setTier(v as ScrapeTier)}
                >
                  <SelectTrigger id="scrape-tier" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleStart} disabled={starting}>
                {starting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Detecting…
                  </>
                ) : (
                  <>
                    <Play /> Start scrape
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* ————— Batch runs ————— */}
        <section className="rounded-card border border-border bg-card p-5 shadow-e1">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <Layers className="size-4 text-sapphire-ink" aria-hidden />
            Batch runs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Queue every enabled source in a source tier. Jobs run one at a time
            to stay polite to the upstream stores.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <Button
                key={t.value}
                variant="outline"
                size="sm"
                // The label is the full product-tier name ("Tier 1 —
                // Collectible Furniture & Spatial Art"), wider than a phone
                // card; a button's default nowrap made the card overflow the
                // page at 390px. Let it wrap instead.
                className="h-auto min-h-8 max-w-full whitespace-normal text-start"
                disabled={batchBusy !== null || tierCounts[t.value] === 0}
                onClick={() => setPendingBatch(t.value)}
              >
                {batchBusy === t.value && (
                  <Loader2 className="animate-spin" aria-hidden />
                )}
                {t.label} ({tierCounts[t.value]})
              </Button>
            ))}
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              disabled={batchBusy !== null || totalSources === 0}
              onClick={() => setPendingBatch("ALL")}
            >
              {batchBusy === "ALL" && (
                <Loader2 className="animate-spin" aria-hidden />
              )}
              Scrape ALL (source-tier order)
            </Button>
          </div>
        </section>
      </div>

      {/* ————— Live progress strip ————— */}
      {activeJobId && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-card border border-sand bg-sand px-4 py-3 text-sm text-sapphire-ink"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          <span className="font-medium">
            Scraping {activeName} — page {activeSnap?.cursorPage ?? 0},{" "}
            {activeSnap?.totalScraped ?? 0} products…
          </span>
          {queueSize > 0 && (
            <span className="text-graphite">
              {queueSize} more {queueSize === 1 ? "job" : "jobs"} queued
            </span>
          )}
        </div>
      )}

      {/* ————— Recent jobs ————— */}
      <h2 className="font-display text-lg text-foreground">Recent jobs</h2>
      {jobs.length === 0 ? (
        <EmptyState
          title="No scrape jobs yet"
          description="Paste a store URL above or queue a source-tier batch — every run lands its products in the review queue."
        />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Scrape jobs"
          className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <table className="w-full text-sm">
            <thead>
              <StudioTableHead>
                <th scope="col" className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selection.allSelected}
                    onCheckedChange={selection.toggleAll}
                    aria-label="Select all jobs"
                  />
                </th>
                <SortHead
                  label="Source"
                  sortKey="sourceName"
                  sort={jobSort}
                  onSort={toggleJob}
                />
                <SortHead
                  label="Platform"
                  sortKey="platform"
                  sort={jobSort}
                  onSort={toggleJob}
                />
                <SortHead
                  label="Status"
                  sortKey="status"
                  sort={jobSort}
                  onSort={toggleJob}
                />
                <SortHead
                  label="Pages"
                  sortKey="pages"
                  sort={jobSort}
                  onSort={toggleJob}
                  numeric
                />
                <SortHead
                  label="Total / new / upd"
                  sortKey="total"
                  sort={jobSort}
                  onSort={toggleJob}
                  numeric
                />
                <th scope="col" className="px-4 py-3 font-medium">
                  Error
                </th>
                <SortHead
                  label="Created"
                  sortKey="created"
                  sort={jobSort}
                  onSort={toggleJob}
                />
                <th scope="col" className="px-4 py-3 font-medium">
                  Finished
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </StudioTableHead>
            </thead>
            <tbody>
              {jobPage.map((job) => {
                const snap = snapshots[job.id];
                const status = snap?.status ?? job.status;
                const cursorPage = snap?.cursorPage ?? job.cursorPage;
                const totalScraped = snap?.totalScraped ?? job.totalScraped;
                const newCount = snap?.newCount ?? job.newCount;
                const updatedCount = snap?.updatedCount ?? job.updatedCount;
                const error = snap ? snap.error : job.error;
                const resumable = status === "QUEUED" || status === "RUNNING";
                return (
                  <StudioRow key={job.id}>
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selection.selected.has(job.id)}
                        onCheckedChange={() => selection.toggle(job.id)}
                        aria-label={`Select job for ${job.sourceName}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/studio/scraper/sources/${job.sourceKey}`}
                        className="text-foreground hover:text-sapphire-ink hover:underline"
                      >
                        {job.sourceName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{job.platform}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {cursorPage}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totalScraped} / {newCount} / {updatedCount}
                    </td>
                    <td className="px-4 py-3">
                      {error ? (
                        <span
                          className="block max-w-[14rem] truncate text-xs text-destructive"
                          title={error}
                        >
                          {error}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {job.createdAt}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {job.finishedAt ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {resumable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => enqueue([job.id])}
                          >
                            <Play /> Resume
                          </Button>
                        )}
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3"
                        >
                          <a
                            href={`/api/scraper/export?jobId=${job.id}`}
                            aria-label={`Export CSV for ${job.sourceName}`}
                          >
                            <Download /> CSV
                          </a>
                        </Button>
                      </div>
                    </td>
                  </StudioRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={jobPageNum}
        pageCount={jobPageCount}
        total={jobTotal}
        pageSize={jobPageSize}
        onPageChange={setJobPage}
        unit="jobs"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 /> Delete
        </Button>
      </BulkBar>

      {/* Fan-out confirmation. The count is the point: "Scrape ALL" reads as
          one action and is up to `totalSources` crawls of other people's
          websites at once. */}
      <Dialog
        open={pendingBatch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBatch(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Queue{" "}
              {pendingBatch === "ALL"
                ? totalSources
                : pendingBatch
                  ? tierCounts[pendingBatch]
                  : 0}{" "}
              scrape jobs?
            </DialogTitle>
            <DialogDescription>
              {pendingBatch === "ALL"
                ? "Every enabled source in every source tier, in source-tier order."
                : "Every enabled source in this source tier."}{" "}
              They run one at a time to stay polite to the upstream stores, and
              any source already being scraped is skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBatch(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const tier = pendingBatch;
                setPendingBatch(null);
                if (tier) void handleBatch(tier);
              }}
            >
              Queue{" "}
              {pendingBatch === "ALL"
                ? totalSources
                : pendingBatch
                  ? tierCounts[pendingBatch]
                  : 0}{" "}
              jobs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="job"
        onConfirm={handleDelete}
        busy={deleting}
        extraWarning="Their staged products are deleted with them; reviewed imports are not affected."
      />
    </div>
  );
}
