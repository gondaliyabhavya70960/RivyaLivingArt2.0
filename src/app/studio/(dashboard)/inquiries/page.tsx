import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatInquiryNumber } from "@/lib/whatsapp";
import { InquirySource, InquiryStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/studio/page-header";
import {
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/components/studio/inquiries/labels";
import { staleInquiryWhere } from "@/components/studio/dashboard/action-queue";
import {
  CommissionBoard,
  type CommissionCard,
} from "@/components/studio/inquiries/commission-board";
import { buildBoardWhere } from "@/components/studio/inquiries/board-filter";
import {
  InquiryList,
  type InquiryRow,
} from "@/components/studio/inquiries/inquiry-list";

export const metadata: Metadata = { title: "Commissions" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
});

const isStatus = (value: string | undefined): value is InquiryStatus =>
  Boolean(value && value in InquiryStatus);

const isSource = (value: string | undefined): value is InquirySource =>
  Boolean(value && value in InquirySource);

/** Server-paginated so the inbox stays fast as public traffic grows (ENG-805). */
const PAGE_SIZE = 25;

/**
 * The board renders a capped slice, not the whole pipeline: seven lanes of
 * unbounded cards is a page that gets slower every month. The lane headers
 * carry the TRUE per-status totals from the existing groupBy, and anything
 * past the cap is one click away in the table.
 */
const BOARD_CAP = 140;

/**
 * Commissions — REDESIGN.md §12.4 (board) and §12.5 (table).
 *
 * One route, two views of the same rows, switched by `?view=board`. The table
 * is the default because it is the surface with bulk actions, search and
 * pagination; the board is the one that answers "what is on the bench".
 *
 * Column choice is documented on `CommissionBoard`: the nine stages §12.4
 * lists do not exist in `InquiryStatus`, so the board is built on the seven
 * real active stages and the terminal pair stays off it.
 */
/** One clock read per request, outside the component body (purity lint). */
async function requestClock(): Promise<Date> {
  return new Date();
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    source?: string;
    q?: string;
    page?: string;
    view?: string;
    /** "1" narrows to NEW inquiries whose first reply is already late — the
     *  Overview's action-queue card links here so the list it opens is
     *  exactly the rows that card counted. */
    stale?: string;
    /** Content Lab (batch G): "1" shows only demo fixture inquiries. */
    demo?: string;
  }>;
}) {
  const { status, source, q, page, view, stale, demo } = await searchParams;
  const requestNow = await requestClock();
  const isBoard = view === "board";
  const demoOnly = demo === "1";

  // The (dashboard) layout already DB-validated the principal this request
  // (requireStaffPage). This JWT read only decides whether the bulk Delete
  // button renders — deleteInquiries re-checks ADMIN server-side regardless.
  const session = await auth();
  const canDelete = session?.user?.role === "ADMIN";

  const where: Prisma.InquiryWhereInput = {
    ...(isStatus(status) ? { status } : {}),
    // The Overview's action-queue card counts this exact clause, so the list
    // it opens is the rows it counted. `requestNow` is resolved above, off
    // the render path — a clock read inside a component is a purity error.
    ...(stale === "1" ? staleInquiryWhere(requestNow) : {}),
    ...(isSource(source) ? { source } : {}),
    ...(demoOnly ? { isDemo: true } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
    ...(demo === "1" ? { isDemo: true } : {}),
  };

  // Count first so the requested page can be clamped to the real range — a
  // stale ?page=N after deleting the last page's rows must not strand the
  // operator on an empty page with the Prev/Next controls hidden.
  const total = await db.inquiry.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNum = Math.min(
    Math.max(1, Math.floor(Number(page) || 1)),
    pageCount,
  );

  const [inquiries, grouped, boardRows] = await Promise.all([
    // `select` scoped to the row shape — never hydrate whatsappMessage (@db.Text)
    // or the Json columns for the list (ENG-805).
    isBoard
      ? []
      : db.inquiry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            customerName: true,
            phone: true,
            source: true,
            status: true,
            isDemo: true,
            createdAt: true,
            product: {
              select: {
                title: true,
                // The row's thumbnail (plan §3 S3). The board has carried one
                // since it was built; the table did not, so the same pipeline
                // looked like two different datasets depending on the view.
                images: {
                  orderBy: { order: "asc" },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
          skip: (pageNum - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
    // Stats stay global on purpose — they describe the whole pipeline,
    // not the current filter.
    db.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
    isBoard
      ? db.inquiry.findMany({
          // PR-5: the board honors the table's filters at last — source,
          // search, stale, demo — while lanes stay the seven active statuses
          // (the ?status= tab drives the table only).
          where: buildBoardWhere({
            source: isSource(source) ? source : undefined,
            q,
            stale,
            demoOnly,
            now: requestNow,
          }),
          orderBy: { createdAt: "desc" },
          take: BOARD_CAP,
          select: {
            id: true,
            number: true,
            customerName: true,
            // The card's Reply button builds the customer's own wa.me link.
            phone: true,
            source: true,
            status: true,
            timeline: true,
            createdAt: true,
            isDemo: true,
            product: {
              select: {
                title: true,
                images: {
                  orderBy: { order: "asc" },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        })
      : [],
  ]);

  const countsByStatus = new Map(
    grouped.map((group) => [group.status, group._count._all]),
  );
  const activeTotal = STATUS_ORDER.reduce(
    (sum, s) => sum + (countsByStatus.get(s) ?? 0),
    0,
  );

  const rows: InquiryRow[] = inquiries.map((inquiry) => ({
    id: inquiry.id,
    number: formatInquiryNumber(inquiry.number),
    customerName: inquiry.customerName,
    phone: inquiry.phone,
    thumbnailUrl: inquiry.product?.images[0]?.url ?? null,
    source: inquiry.source,
    productTitle: inquiry.product?.title ?? null,
    status: inquiry.status,
    isDemo: inquiry.isDemo,
    createdAt: dateFormatter.format(inquiry.createdAt),
  }));

  const cards: CommissionCard[] = boardRows.map((inquiry) => ({
    id: inquiry.id,
    number: formatInquiryNumber(inquiry.number),
    customerName: inquiry.customerName,
    phone: inquiry.phone,
    source: inquiry.source,
    projectTitle: inquiry.product?.title ?? null,
    thumbnailUrl: inquiry.product?.images[0]?.url ?? null,
    status: inquiry.status,
    timeline: inquiry.timeline,
    createdAtIso: inquiry.createdAt.toISOString(),
    createdAt: shortDateFormatter.format(inquiry.createdAt),
    isDemo: inquiry.isDemo,
  }));

  const TAB =
    "inline-flex min-h-11 items-center rounded-full px-5 text-small outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";

  // Content Lab (batch G): a "Demo only" toggle that preserves the view but
  // flips `?demo=1`, so it composes with Table and Board alike.
  const demoHref = (() => {
    const params = new URLSearchParams();
    if (isBoard) params.set("view", "board");
    if (!demoOnly) params.set("demo", "1");
    const qs = params.toString();
    return qs ? `/studio/inquiries?${qs}` : "/studio/inquiries";
  })();

  return (
    <div>
      <PageHeader
        eyebrow="THE PIPELINE"
        title="Commissions"
        description="Every WhatsApp order from the public site — from the first message through to delivery."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="View"
              className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
            >
              <Link
                href="/studio/inquiries"
                aria-current={isBoard ? undefined : "page"}
                className={
                  isBoard
                    ? `${TAB} text-graphite hover:text-foreground`
                    : `${TAB} bg-foreground/6 font-medium text-foreground`
                }
              >
                Table
              </Link>
              <Link
                href="/studio/inquiries?view=board"
                aria-current={isBoard ? "page" : undefined}
                className={
                  isBoard
                    ? `${TAB} bg-foreground/6 font-medium text-foreground`
                    : `${TAB} text-graphite hover:text-foreground`
                }
              >
                Board
              </Link>
            </div>
            <Link
              href={demoHref}
              // A navigating filter is a link, so its "on" state is aria-current
              // (aria-pressed belongs to buttons; axe flags it on an anchor).
              aria-current={demoOnly ? "true" : undefined}
              className={
                demoOnly
                  ? `${TAB} rounded-full border border-border bg-foreground/6 font-medium text-foreground`
                  : `${TAB} rounded-full border border-border text-graphite hover:text-foreground`
              }
            >
              Demo only
            </Link>
          </div>
        }
      />

      {/* Pipeline stats — the seven active stages (CLOSED/LOST are terminal). */}
      <ul className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {STATUS_ORDER.map((s) => (
          <li
            key={s}
            className="rounded-card border border-border bg-card px-4 py-3"
          >
            <p className="u-micro">{STATUS_LABELS[s]}</p>
            <p className="u-num mt-1 text-25 leading-none text-foreground">
              {countsByStatus.get(s) ?? 0}
            </p>
          </li>
        ))}
      </ul>

      {isBoard ? (
        <CommissionBoard
          cards={cards}
          counts={countsByStatus}
          shown={cards.length}
          total={activeTotal}
          activeSource={source ?? "ALL"}
          initialQuery={q ?? ""}
        />
      ) : (
        <InquiryList
          inquiries={rows}
          initialQuery={q ?? ""}
          page={pageNum}
          total={total}
          pageSize={PAGE_SIZE}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
