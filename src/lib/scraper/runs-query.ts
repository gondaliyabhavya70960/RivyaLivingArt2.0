/**
 * Workflow-runs feed (A9, plan §6) — server-only read assembly. Every scrape
 * job is a run; this is the filterable feed over them with per-status counts
 * for the filter chips, so the owner can answer "what ran, what failed, what
 * is stuck" without the hub's all-sources view.
 *
 * Demo jobs are excluded BY CLAUSE (`isDemo: false`), as every staff read
 * does: the Content Lab's synthetic rows never pose as real runs.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { ScrapeJobStatus, ScrapeScope } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const RUNS_PAGE_SIZE = 25;

export const RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "DONE",
  "FAILED",
] as const satisfies readonly ScrapeJobStatus[];

export type RunStatusFilter = (typeof RUN_STATUSES)[number] | "ALL";

export type RunRow = {
  id: string;
  sourceKey: string;
  sourceName: string;
  scope: ScrapeScope;
  status: ScrapeJobStatus;
  cursorPage: number;
  totalScraped: number;
  newCount: number;
  updatedCount: number;
  error: string | null;
  createdAt: Date;
  /** Heartbeat — the last page advance while RUNNING. */
  updatedAt: Date;
  finishedAt: Date | null;
  /** Retry only makes sense on a failed run; cancel only on an in-flight
   *  one. Computed here so the row's buttons are never optimistic. */
  retryable: boolean;
  cancellable: boolean;
};

export type RunsPageData = {
  rows: RunRow[];
  /** Per-status counts over the WHOLE feed (unfiltered except demo), so the
   *  chips always show the true split. */
  statusCounts: Record<RunStatusFilter, number>;
  totalMatching: number;
  page: number;
  pageCount: number;
  activeStatus: RunStatusFilter;
  activeSource: string;
  sources: { key: string; name: string }[];
};

export async function runsPageData(args: {
  status?: string;
  source?: string;
  page?: number;
}): Promise<RunsPageData> {
  const activeStatus: RunStatusFilter =
    args.status && (RUN_STATUSES as readonly string[]).includes(args.status)
      ? (args.status as RunStatusFilter)
      : args.status === "ALL"
        ? "ALL"
        : "ALL";
  const activeSource = args.source && args.source !== "ALL" ? args.source : "";

  const where: Prisma.ScrapeJobWhereInput = {
    isDemo: false,
    ...(activeStatus !== "ALL" ? { status: activeStatus } : {}),
    ...(activeSource ? { sourceKey: activeSource } : {}),
  };

  const [statusGroups, totalMatching, sources] = await Promise.all([
    db.scrapeJob.groupBy({
      by: ["status"],
      where: { isDemo: false },
      _count: { _all: true },
    }),
    db.scrapeJob.count({ where }),
    db.scrapeSource.findMany({
      select: { key: true, name: true },
      orderBy: { key: "asc" },
    }),
  ]);

  const statusCounts: Record<RunStatusFilter, number> = {
    ALL: 0,
    QUEUED: 0,
    RUNNING: 0,
    DONE: 0,
    FAILED: 0,
  };
  for (const group of statusGroups) {
    statusCounts[group.status] = group._count._all;
    statusCounts.ALL += group._count._all;
  }

  // count → clamp → skip/take: a stale ?page=9 after a filter narrowed the
  // feed lands on the last real page, not an empty one.
  const pageCount = Math.max(1, Math.ceil(totalMatching / RUNS_PAGE_SIZE));
  const page = Math.min(Math.max(1, args.page ?? 1), pageCount);

  const jobs = await db.scrapeJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * RUNS_PAGE_SIZE,
    take: RUNS_PAGE_SIZE,
  });

  return {
    rows: jobs.map((job) => ({
      id: job.id,
      sourceKey: job.sourceKey,
      sourceName: job.sourceName,
      scope: job.scope,
      status: job.status,
      cursorPage: job.cursorPage,
      totalScraped: job.totalScraped,
      newCount: job.newCount,
      updatedCount: job.updatedCount,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      finishedAt: job.finishedAt,
      retryable: job.status === "FAILED",
      cancellable: job.status === "QUEUED" || job.status === "RUNNING",
    })),
    statusCounts,
    totalMatching,
    page,
    pageCount,
    activeStatus,
    activeSource: activeSource || "ALL",
    sources,
  };
}
