import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

import { db } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Subscribers" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

/** Matches the activity log, so the two audit-style tables page alike. */
const PAGE_SIZE = 50;

function pageHref(page: number): string {
  return page > 1 ? `/studio/subscribers?page=${page}` : "/studio/subscribers";
}

/**
 * Owned email list captured by the newsletter / launching-soon forms (MKT-208).
 * Previously write-only — this makes it viewable + exportable so the promised
 * "first access" emails can actually be sent.
 *
 * It used to `take: 500` and say nothing about it. The CSV export has always
 * been uncapped, so past subscriber 500 the screen and the file disagreed with
 * no sign on the screen that they did — the failure mode of a silent cap is
 * that it looks exactly like a complete list.
 */
export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  // Next resolves a repeated query key to an array.
  const rawPage = Array.isArray(page) ? page[0] : page;
  const requestedPage = Math.max(
    1,
    Number.parseInt(rawPage ?? "1", 10) || 1,
  );

  const total = await db.subscriber.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamped, not just floored. The empty-state gate below asks `total`, not the
  // page slice, so an unclamped page past the end rendered the whole bordered
  // table with an empty body under a count line contradicting itself.
  const pageNum = Math.min(requestedPage, totalPages);

  const subscribers = await db.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    skip: (pageNum - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, email: true, source: true, createdAt: true },
  });

  return (
    <div>
      <PageHeader
        title="Subscribers"
        description="Emails captured from the newsletter and launching-soon forms."
        actions={
          total > 0 ? (
            <Button asChild variant="outline" size="sm">
              {/* Plain <a>: this points at an API route handler that streams a
                  CSV download, not a page — next/link would hijack it with a
                  client navigation. (Rule now fires post-i18n-restructure.) */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/subscribers/export">
                <Download /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />

      {total === 0 ? (
        <EmptyState
          title="No subscribers yet"
          description="When visitors sign up via the newsletter or launching-soon block, their emails appear here."
        />
      ) : (
        <div
            tabIndex={0}
            role="region"
            aria-label="Subscribers"
            className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
          <table className="w-full text-sm">
            <thead>
              <StudioTableHead>
                <th className="py-3 pl-4 pr-4 font-medium">Email</th>
                <th className="py-3 pr-4 font-medium">Source</th>
                <th className="py-3 pr-4 font-medium">Subscribed</th>
              </StudioTableHead>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <StudioRow
                  key={s.id}
                >
                  <td className="py-3 pl-4 pr-4 font-medium text-foreground">
                    {s.email}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {s.source ?? "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                    {dateFormatter.format(s.createdAt)}
                  </td>
                </StudioRow>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("en-IN")}{" "}
            {total === 1 ? "subscriber" : "subscribers"} · page{" "}
            {pageNum.toLocaleString("en-IN")} of{" "}
            {totalPages.toLocaleString("en-IN")}
          </p>
          <div className="flex items-center gap-2">
            {pageNum > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(pageNum - 1)} rel="prev">
                  <ChevronLeft /> Prev
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft /> Prev
              </Button>
            )}
            {pageNum < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(pageNum + 1)} rel="next">
                  Next <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next <ChevronRight />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
