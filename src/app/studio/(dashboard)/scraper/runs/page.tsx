import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { RunActions } from "@/components/studio/scraper/run-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  runsPageData,
  RUN_STATUSES,
  type RunStatusFilter,
} from "@/lib/scraper/runs-query";

export const metadata: Metadata = { title: "Workflow runs" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "alert"
> = {
  QUEUED: "outline",
  RUNNING: "default",
  DONE: "secondary",
  FAILED: "alert",
};

function runsHref(status: RunStatusFilter, source: string, page = 1): string {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (source !== "ALL") params.set("source", source);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/studio/scraper/runs?${qs}` : "/studio/scraper/runs";
}

/**
 * The workflow-runs feed (A9, plan §6): every scrape job, filterable by
 * status and source, with retry and cancel on the rows they honestly apply
 * to. Retry queues a fresh run — the failed row stays as the record; cancel
 * terminal-writes with the operator's name, never posing as a source fault.
 */
export default async function ScraperRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; page?: string }>;
}) {
  const { status, source, page } = await searchParams;
  const data = await runsPageData({
    status,
    source,
    page: page ? Number.parseInt(page, 10) : undefined,
  });

  return (
    <>
      <PageHeader
        title="Workflow runs"
        description="Every scrape run, filterable by status and source. Retry queues a fresh run for a failed target — history is never rewritten; cancel records who stopped it."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/scraper">Scraper hub</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["ALL", ...RUN_STATUSES] as const).map((s) => (
          <Button
            key={s}
            asChild
            variant={data.activeStatus === s ? "default" : "outline"}
            size="sm"
          >
            <Link href={runsHref(s, data.activeSource)}>
              {s === "ALL" ? "All" : s.toLowerCase()}
              <span className="ml-1.5 tabular-nums text-xs opacity-80">
                {data.statusCounts[s]}
              </span>
            </Link>
          </Button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <Button
          asChild
          variant={data.activeSource === "ALL" ? "default" : "outline"}
          size="sm"
        >
          <Link href={runsHref(data.activeStatus, "ALL")}>all sources</Link>
        </Button>
        {data.sources.map((s) => (
          <Button
            key={s.key}
            asChild
            variant={data.activeSource === s.key ? "default" : "outline"}
            size="sm"
          >
            <Link href={runsHref(data.activeStatus, s.key)}>{s.name}</Link>
          </Button>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          title="No runs match"
          description="Loosen the filters, or queue a run from the scraper hub — every run lands here, including the ones that fail."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Scope</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Progress</th>
                  <th className="px-3 py-2.5 font-medium">Started</th>
                  <th className="px-3 py-2.5 font-medium">Finished</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">
                        {run.sourceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.sourceKey}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs">{run.scope}</td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_VARIANT[run.status] ?? "outline"}>
                        {run.status}
                      </Badge>
                      {run.error && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {run.error}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-xs">
                      {run.totalScraped} scraped · {run.newCount} new ·{" "}
                      {run.updatedCount} updated
                      {run.status === "RUNNING" && (
                        <span className="block text-muted-foreground">
                          page {run.cursorPage} · heartbeat{" "}
                          {dateFormatter.format(run.updatedAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {dateFormatter.format(run.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {run.finishedAt
                        ? dateFormatter.format(run.finishedAt)
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <RunActions
                        jobId={run.id}
                        retryable={run.retryable}
                        cancellable={run.cancellable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <p>
              page {data.page} of {data.pageCount} ·{" "}
              <span className="tabular-nums">{data.totalMatching}</span>{" "}
              run(s) match
            </p>
            <div className="flex gap-2">
              {data.page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={runsHref(
                      data.activeStatus,
                      data.activeSource,
                      data.page - 1,
                    )}
                  >
                    Newer
                  </Link>
                </Button>
              )}
              {data.page < data.pageCount && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={runsHref(
                      data.activeStatus,
                      data.activeSource,
                      data.page + 1,
                    )}
                  >
                    Older
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
