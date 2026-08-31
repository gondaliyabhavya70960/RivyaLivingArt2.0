import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import {
  asChartTimezone,
  dayKey,
  startOfToday,
  type ChartTimezone,
} from "@/lib/day-bucket";
import { db } from "@/lib/db";
import {
  ContentStatus,
  InquiryStatus,
  ReviewStatus,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StatCard } from "@/components/studio/dashboard/stat-card";
import {
  ActivityPanel,
  type ActivityEntry,
} from "@/components/studio/dashboard/activity-panel";
import {
  InquiriesChart,
  type InquiriesChartPoint,
} from "@/components/studio/dashboard/inquiries-chart";
import {
  TopProductsCard,
  type TopProductRow,
} from "@/components/studio/dashboard/top-products-card";
import {
  SOURCE_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
} from "@/components/studio/inquiries/labels";

export const metadata: Metadata = { title: "Overview" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const stampFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_DAYS = 30;
/** §12.3's sparklines read the tail of the same daily grid the chart plots. */
const SPARK_DAYS = 14;

/** Bucket raw createdAt rows into a dense per-day series (cheap in JS at this
 *  volume; zero-filled so quiet days still plot). Day boundary = the owner's
 *  SiteSettings.chartTimezone (day-bucket lib). */
function buildDailySeries(
  rows: { createdAt: Date }[],
  start: Date,
  tz: ChartTimezone,
): InquiriesChartPoint[] {
  const counts = new Map<string, number>();
  for (const { createdAt } of rows) {
    const key = dayKey(createdAt, tz);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: CHART_DAYS }, (_, i) => {
    const day = dayKey(new Date(start.getTime() + i * DAY_MS), tz);
    return { day, count: counts.get(day) ?? 0 };
  });
}

/** Delta line: current vs previous window, honest about empty windows. */
function countDelta(
  current: number,
  previous: number,
  windowLabel: string,
): { label: string; tone: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) {
    return { label: `no change vs ${windowLabel}`, tone: "flat" };
  }
  if (previous === 0) {
    return { label: `+${current} vs ${windowLabel}`, tone: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: `level with ${windowLabel}`, tone: "flat" };
  return {
    label: `${pct > 0 ? "+" : ""}${pct}% vs ${windowLabel}`,
    tone: pct > 0 ? "up" : "down",
  };
}

/** The two stages that mean "on the bench right now" (§12.4's live pipeline). */
const ACTIVE_COMMISSION_STAGES = [
  InquiryStatus.CONFIRMED,
  InquiryStatus.IN_PRODUCTION,
];

async function getDashboardData() {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY_MS);
  // "Today" and the chart share the same day grid — the boundary is the
  // owner's chartTimezone setting (UTC default; IST once flipped).
  const tz = asChartTimezone(
    (
      await db.siteSettings.findUnique({
        where: { id: "main" },
        select: { chartTimezone: true },
      })
    )?.chartTimezone,
  );
  const todayStart = startOfToday(tz, now);
  const chartStart = new Date(todayStart.getTime() - (CHART_DAYS - 1) * DAY_MS);

  const [
    counts,
    tierGroups,
    chartRows,
    activeRows,
    approvalRows,
    topProductGroups,
    recentInquiries,
    activityRows,
  ] = await Promise.all([
    db.$transaction([
      db.inquiry.count({ where: { status: InquiryStatus.NEW } }),
      db.inquiry.count({ where: { createdAt: { gte: todayStart } } }),
      db.inquiry.count({ where: { createdAt: { gte: weekAgo } } }),
      // Deltas: the two previous windows the KPI cards compare against.
      db.inquiry.count({
        where: {
          createdAt: {
            gte: new Date(now - 14 * DAY_MS),
            lt: weekAgo,
          },
        },
      }),
      db.inquiry.count({ where: { status: { in: ACTIVE_COMMISSION_STAGES } } }),
      db.inquiry.count(),
      // An inquiry counts as converted once the customer confirmed in WhatsApp
      // (CONFIRMED) or the piece shipped (DELIVERED).
      db.inquiry.count({
        where: {
          status: {
            in: [
              InquiryStatus.CONFIRMED,
              InquiryStatus.IN_PRODUCTION,
              InquiryStatus.DELIVERED,
            ],
          },
        },
      }),
      db.scrapedProduct.count({
        where: { reviewStatus: ReviewStatus.PENDING },
      }),
      db.product.count({ where: { status: ContentStatus.PUBLISHED } }),
      db.product.count({ where: { status: ContentStatus.DRAFT } }),
      // Live-but-unbuyable slice of the catalog.
      db.product.count({
        where: { status: ContentStatus.PUBLISHED, inStock: false },
      }),
      // §12.3 "UPCOMING WORKSHOPS". There is no Workshop model and no
      // scheduled dates anywhere in the schema — the public /workshops page
      // reads products in the `workshops` category. This counts exactly that,
      // and the card says so rather than implying a calendar exists.
      db.product.count({
        where: {
          status: ContentStatus.PUBLISHED,
          category: { slug: "workshops" },
        },
      }),
      db.blogPost.count(),
      db.subscriber.count(),
    ]),
    // Catalog composition by sheet tier (published only) for the tier strip.
    db.product.groupBy({
      by: ["tier"],
      where: { status: ContentStatus.PUBLISHED, tier: { not: null } },
      _count: { _all: true },
    }),
    db.inquiry.findMany({
      where: { createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    // Per-card sparkline series — each one is its own real population, not the
    // same line drawn four times.
    db.inquiry.findMany({
      where: {
        createdAt: { gte: chartStart },
        status: { in: ACTIVE_COMMISSION_STAGES },
      },
      select: { createdAt: true },
    }),
    // ScrapedProduct has no createdAt — `firstSeen` is when the crawler first
    // saw the row, which is the moment it started waiting on a human.
    db.scrapedProduct
      .findMany({
        where: {
          firstSeen: { gte: chartStart },
          reviewStatus: ReviewStatus.PENDING,
        },
        select: { firstSeen: true },
      })
      .then((rows) => rows.map((row) => ({ createdAt: row.firstSeen }))),
    db.inquiry.groupBy({
      by: ["productId"],
      where: { productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 5,
    }),
    db.inquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        customerName: true,
        source: true,
        status: true,
        createdAt: true,
        product: { select: { title: true } },
      },
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        action: true,
        entity: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  // Resolve titles for the top-product rows (depends on the groupBy result,
  // so it can't join the batch above).
  const topIds = topProductGroups
    .map((g) => g.productId)
    .filter((id): id is string => id !== null);
  const titleRows =
    topIds.length === 0
      ? []
      : await db.product.findMany({
          where: { id: { in: topIds } },
          select: { id: true, title: true },
        });
  const titles = new Map(titleRows.map((p) => [p.id, p.title] as const));
  const topProducts: TopProductRow[] = topProductGroups.flatMap((g) => {
    if (g.productId === null) return [];
    const title = titles.get(g.productId);
    // A deleted product's inquiries keep productId via SetNull=null, but a
    // race could still leave a dangling id — drop the row rather than 404.
    return title === undefined
      ? []
      : [{ id: g.productId, title, count: g._count._all }];
  });

  const tail = (rows: { createdAt: Date }[]) =>
    buildDailySeries(rows, chartStart, tz)
      .slice(-SPARK_DAYS)
      .map((point) => point.count);

  const activity: ActivityEntry[] = activityRows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    at: stampFormatter.format(row.createdAt),
    who: row.user?.name ?? "System",
  }));

  return {
    counts,
    tierGroups,
    chartSeries: buildDailySeries(chartRows, chartStart, tz),
    sparks: {
      newInquiries: tail(chartRows),
      activeCommissions: tail(activeRows),
      pendingApprovals: tail(approvalRows),
    },
    topProducts,
    recentInquiries,
    activity,
  };
}

/**
 * Studio Overview — REDESIGN.md §12.3.
 *
 *   Four KPI cards, no excessive graphs:
 *   NEW INQUIRIES · ACTIVE COMMISSIONS · PENDING APPROVALS · UPCOMING WORKSHOPS
 *   Large mono numerals, one hairline sparkline each.
 *
 * Three of the four map cleanly onto existing queries. The fourth does not:
 * there is no Workshop model and no scheduled date anywhere in the schema, so
 * "upcoming workshops" counts the published products in the `workshops`
 * category — exactly what the public /workshops page lists — and the card
 * states that in words instead of implying a calendar. When that count is
 * zero the card renders a real zero with a real reason, never a filler number.
 */
export default async function DashboardPage() {
  const {
    counts: [
      newInquiries,
      inquiriesToday,
      inquiriesThisWeek,
      inquiriesPrevWeek,
      activeCommissions,
      totalInquiries,
      convertedInquiries,
      pendingScraperApprovals,
      publishedProducts,
      draftProducts,
      outOfStockPublished,
      workshopListings,
      blogPosts,
      subscribers,
    ],
    tierGroups,
    chartSeries,
    sparks,
    topProducts,
    recentInquiries,
    activity,
  } = await getDashboardData();

  const num = (n: number) => n.toLocaleString("en-IN");
  const conversionRate =
    totalInquiries === 0
      ? "—"
      : `${Math.round((convertedInquiries / totalInquiries) * 100)}%`;

  const tierCounts = new Map(
    tierGroups.map((g) => [g.tier as number, g._count._all]),
  );
  const TIER_STRIP = [
    { tier: 1, label: "Tier 1 · Owner" },
    { tier: 2, label: "Tier 2 · Resin goods" },
    { tier: 3, label: "Tier 3 · Supplies" },
    { tier: 4, label: "Tier 4 · 3D printing" },
  ];

  const STRIP =
    "flex min-h-11 items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 shadow-e1";
  const STRIP_LINK = `${STRIP} outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-sapphire-ink/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none`;

  return (
    <div>
      <PageHeader
        eyebrow="THE BENCH"
        title="Overview"
        description="What is waiting on you, what is on the bench, and how the catalogue is holding up."
      />

      {/* §12.3 — the four cards, in the spec's order. */}
      <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* One quantity per card: the numeral, the delta and the sparkline all
            describe ARRIVALS over the last seven days, and the note points at
            the sub-count that still needs a first reply. Headlining the
            untouched count instead would leave the delta measuring something
            the numeral does not. */}
        <StatCard
          label="NEW INQUIRIES · 7 DAYS"
          value={num(inquiriesThisWeek)}
          href="/studio/inquiries?status=NEW"
          delta={countDelta(inquiriesThisWeek, inquiriesPrevWeek, "last week")}
          note={
            newInquiries === 0
              ? `${num(inquiriesToday)} today · every inquiry has had a first reply`
              : `${num(inquiriesToday)} today · ${num(newInquiries)} still awaiting a first reply`
          }
          spark={sparks.newInquiries}
        />
        <StatCard
          label="ACTIVE COMMISSIONS"
          value={num(activeCommissions)}
          href="/studio/inquiries?view=board"
          note="Confirmed and in production"
          spark={sparks.activeCommissions}
        />
        <StatCard
          label="PENDING APPROVALS"
          value={num(pendingScraperApprovals)}
          href="/studio/scraper/review"
          note="Scraped rows waiting on a decision"
          spark={sparks.pendingApprovals}
        />
        <StatCard
          label="UPCOMING WORKSHOPS"
          value={num(workshopListings)}
          href="/studio/products?q=workshop"
          note={
            workshopListings === 0
              ? "None published. Workshops are products in the workshops category — there are no scheduled dates in the data."
              : "Published listings. There are no scheduled dates in the data, so this is not a calendar."
          }
        />
      </div>

      {/* Inquiries over time + top products by inquiries. */}
      <div className="mb-10 grid items-start gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="inquiries-chart-heading"
          className="min-w-0 rounded-card border border-border bg-card p-5 shadow-e1 lg:col-span-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              id="inquiries-chart-heading"
              className="font-display text-20 leading-tight text-foreground"
            >
              Inquiries over time
            </h2>
            <p className="u-micro">LAST 30 DAYS</p>
          </div>
          <div className="mt-4">
            <InquiriesChart data={chartSeries} />
          </div>
        </section>
        <TopProductsCard products={topProducts} />
      </div>

      {/* Catalogue composition — one link per sheet tier, published counts,
          plus the live-but-unbuyable out-of-stock slice. Each cell deep-links
          into /studio/products pre-filtered. */}
      <h2 className="u-micro mb-3">CATALOGUE</h2>
      <p className="mb-4 max-w-[68ch] text-small leading-relaxed text-graphite">
        The catalogue is fed by the{" "}
        <Link
          href="/studio/sheet-import"
          className="rounded-input font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          Sheet Import
        </Link>{" "}
        (four tiers, refreshed automatically), plus manual products, Bulk Import
        and the Product Scraper.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {TIER_STRIP.map(({ tier, label }) => (
          <Link
            key={tier}
            href={`/studio/products?tier=${tier}`}
            className={STRIP_LINK}
          >
            <span className="u-micro">{label}</span>
            <span className="u-num text-20 text-foreground">
              {num(tierCounts.get(tier) ?? 0)}
            </span>
          </Link>
        ))}
        <Link href="/studio/products?stock=out" className={STRIP_LINK}>
          <span className="u-micro">Published · out of stock</span>
          <span className="u-num text-20 text-foreground">
            {num(outOfStockPublished)}
          </span>
        </Link>
      </div>

      <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Link href="/studio/products" className={STRIP_LINK}>
          <span className="u-micro">Published products</span>
          <span className="u-num text-20 text-foreground">
            {num(publishedProducts)}
          </span>
        </Link>
        <Link href="/studio/products?status=DRAFT" className={STRIP_LINK}>
          <span className="u-micro">Draft products</span>
          <span className="u-num text-20 text-foreground">
            {num(draftProducts)}
          </span>
        </Link>
        <Link href="/studio/blog" className={STRIP_LINK}>
          <span className="u-micro">Journal posts</span>
          <span className="u-num text-20 text-foreground">
            {num(blogPosts)}
          </span>
        </Link>
        <Link href="/studio/subscribers" className={STRIP_LINK}>
          <span className="u-micro">Subscribers</span>
          <span className="u-num text-20 text-foreground">
            {num(subscribers)}
          </span>
        </Link>
        <div className={STRIP}>
          <span className="u-micro">Inquiry → confirmed</span>
          <span className="u-num text-20 text-foreground">
            {conversionRate}
          </span>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Recent inquiries */}
        <section
          aria-labelledby="recent-inquiries-heading"
          className="min-w-0 rounded-card border border-border bg-card p-5 shadow-e1 lg:col-span-2"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="recent-inquiries-heading"
              className="font-display text-20 leading-tight text-foreground"
            >
              Recent inquiries
            </h2>
            <Link
              href="/studio/inquiries"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-input text-small font-medium text-sapphire-ink underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:underline focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
            >
              All commissions
              <ArrowRight aria-hidden strokeWidth={1.5} className="size-3.5" />
            </Link>
          </div>
          {recentInquiries.length === 0 ? (
            <p className="mt-4 text-small leading-relaxed text-graphite">
              No inquiries yet. Orders placed on the website appear here the
              moment a customer taps Place order.
            </p>
          ) : (
            <div
            tabIndex={0}
            role="region"
            aria-label="Recent inquiries"
            className="mt-4 overflow-x-auto [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
              <table className="w-full text-small">
                <thead>
                  <StudioTableHead>
                    <th className="py-2 pe-4 font-normal">Customer</th>
                    <th className="py-2 pe-4 font-normal">Source</th>
                    <th className="py-2 pe-4 font-normal">Project</th>
                    <th className="py-2 pe-4 font-normal">Status</th>
                    <th className="py-2 font-normal">Received</th>
                  </StudioTableHead>
                </thead>
                <tbody>
                  {recentInquiries.map((inquiry) => (
                    <tr
                      key={inquiry.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 pe-4">
                        <Link
                          href={`/studio/inquiries/${inquiry.id}`}
                          className="rounded-input font-medium text-foreground underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {inquiry.customerName}
                        </Link>
                      </td>
                      <td className="py-3 pe-4">
                        <Badge variant="outline">
                          {SOURCE_LABELS[inquiry.source]}
                        </Badge>
                      </td>
                      <td className="py-3 pe-4 text-graphite">
                        {inquiry.product?.title ?? "—"}
                      </td>
                      <td className="py-3 pe-4">
                        <Badge variant={STATUS_BADGE_VARIANTS[inquiry.status]}>
                          {STATUS_LABELS[inquiry.status]}
                        </Badge>
                      </td>
                      <td className="u-num whitespace-nowrap py-3 text-graphite">
                        {dateFormatter.format(inquiry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* §12.2's optional right-hand panel: activity, then the shortcuts. */}
        <div className="min-w-0 space-y-4">
          <ActivityPanel entries={activity} />

          <section
            aria-labelledby="quick-actions-heading"
            className="rounded-card border border-border bg-card p-5 shadow-e1"
          >
            <h2
              id="quick-actions-heading"
              className="font-display text-20 leading-tight text-foreground"
            >
              Quick actions
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-3"
              >
                <Link href="/studio/products/new">
                  <Plus aria-hidden strokeWidth={1.5} /> Add product
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-3"
              >
                <Link href="/studio/categories">
                  <FolderTree aria-hidden strokeWidth={1.5} /> Manage categories
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-3"
              >
                <Link href="/studio/media">
                  <ImageIcon aria-hidden strokeWidth={1.5} /> Open media library
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-3"
              >
                <Link href="/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden strokeWidth={1.5} /> View site
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
