import type { Metadata } from "next";

import {
  asChartTimezone,
  bucketNote,
  dayKey,
  startOfToday,
  type ChartTimezone,
} from "@/lib/day-bucket";
import { db } from "@/lib/db";
import { InquiryStatus } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/studio/page-header";
import { StatCard } from "@/components/studio/dashboard/stat-card";
import {
  InquiriesChart,
  type InquiriesChartPoint,
} from "@/components/studio/dashboard/inquiries-chart";

export const metadata: Metadata = { title: "Analytics · Studio" };
export const dynamic = "force-dynamic";

/**
 * /studio/analytics — the C1 "Analytics (inquiries by period/category/
 * product)" spec (DESIGN.md:124), built on the funnel data the site already
 * captures: every Inquiry row (source, status, product, first-touch
 * attribution) plus Subscriber counts. Server-aggregated; the only client
 * code is the shared InquiriesChart. Day buckets are UTC, matching the
 * dashboard chart's documented grid (the UTC-vs-IST presentation call
 * remains the tracked owner decision — both surfaces will flip together).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 90;

/** Pipeline order for the funnel (UIUX-610). */
const FUNNEL: { status: InquiryStatus; label: string }[] = [
  { status: InquiryStatus.NEW, label: "New" },
  { status: InquiryStatus.CONTACTED, label: "Contacted" },
  { status: InquiryStatus.DISCUSSION, label: "In discussion" },
  { status: InquiryStatus.QUOTED, label: "Quoted" },
  { status: InquiryStatus.CONFIRMED, label: "Confirmed" },
  { status: InquiryStatus.IN_PRODUCTION, label: "In production" },
  { status: InquiryStatus.DELIVERED, label: "Delivered" },
  { status: InquiryStatus.CLOSED, label: "Closed" },
];

const SOURCE_LABELS: Record<string, string> = {
  PRODUCT: "Product orders",
  CUSTOM_ORDER: "Custom commissions",
  CONTACT: "Contact page",
};



function buildDailySeries(
  rows: { createdAt: Date }[],
  start: Date,
  days: number,
  tz: ChartTimezone,
): InquiriesChartPoint[] {
  const counts = new Map<string, number>();
  for (const { createdAt } of rows) {
    const key = dayKey(createdAt, tz);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(start.getTime() + i * DAY_MS), tz);
    return { day, count: counts.get(day) ?? 0 };
  });
}

/** "+12%" / "−8%" / "—" period-over-period delta, pre-formatted for StatCard. */
function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "new" : "—";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** One server-rendered proportion row (funnel/source/category/attribution). */
function BarRow({
  label,
  count,
  max,
  meta,
}: {
  label: string;
  count: number;
  max: number;
  meta?: string;
}) {
  const width = max > 0 ? Math.max((count / max) * 100, count > 0 ? 3 : 0) : 0;
  return (
    <li className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 py-1.5">
      <span className="truncate text-sm text-foreground" title={label}>
        {label}
      </span>
      <span aria-hidden className="h-2 rounded-full bg-secondary">
        <span
          className="block h-2 rounded-full bg-primary"
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="font-mono text-12 tabular-nums text-muted-foreground">
        {count.toLocaleString("en-IN")}
        {meta ? ` · ${meta}` : ""}
      </span>
    </li>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-card p-5 shadow-e1">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {note && <p className="text-12 text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/* Request-time window boundaries — module-level helper (same idiom as the
   dashboard page) so the render body itself stays pure. */
function timeWindows(tz: ChartTimezone) {
  const now = Date.now();
  const todayStart = startOfToday(tz, now);
  return {
    trendStart: new Date(todayStart.getTime() - (TREND_DAYS - 1) * DAY_MS),
    days30: new Date(now - 30 * DAY_MS),
    days60: new Date(now - 60 * DAY_MS),
  };
}

/** C2 date-range: parse ?from/&to (YYYY-MM-DD, UTC) into a clamped window. */
function parseRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  fallbackStart: Date,
  tz: ChartTimezone,
): { start: Date; endExclusive: Date | null; days: number; label: string } {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (fromRaw && toRaw && DATE.test(fromRaw) && DATE.test(toRaw)) {
    const start = new Date(`${fromRaw}T00:00:00.000Z`);
    const endInclusive = new Date(`${toRaw}T00:00:00.000Z`);
    const days =
      Math.floor((endInclusive.getTime() - start.getTime()) / DAY_MS) + 1;
    if (Number.isFinite(days) && days >= 2 && days <= 366) {
      return {
        start,
        endExclusive: new Date(endInclusive.getTime() + DAY_MS),
        days,
        label: `${fromRaw} → ${toRaw} · ${bucketNote(tz)}`,
      };
    }
  }
  return {
    start: fallbackStart,
    endExclusive: null,
    days: TREND_DAYS,
    label: `90 days · ${bucketNote(tz)}`,
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const tz = asChartTimezone(
    (
      await db.siteSettings.findUnique({
        where: { id: "main" },
        select: { chartTimezone: true },
      })
    )?.chartTimezone,
  );
  const { trendStart: defaultTrendStart, days30, days60 } = timeWindows(tz);
  const params = await searchParams;
  const range = parseRange(params.from, params.to, defaultTrendStart, tz);
  const trendWhere = {
    gte: range.start,
    ...(range.endExclusive ? { lt: range.endExclusive } : {}),
  };

  const [
    inquiries30,
    inquiriesPrev30,
    subscribers30,
    subscribersPrev30,
    converted30,
    trendRows,
    statusGroups,
    sourceGroups,
    productGroups,
    categoryRows,
    attributionRows,
  ] = await Promise.all([
    db.inquiry.count({ where: { createdAt: { gte: days30 } } }),
    db.inquiry.count({
      where: { createdAt: { gte: days60, lt: days30 } },
    }),
    db.subscriber.count({ where: { createdAt: { gte: days30 } } }),
    db.subscriber.count({
      where: { createdAt: { gte: days60, lt: days30 } },
    }),
    db.inquiry.count({
      where: {
        createdAt: { gte: days30 },
        status: {
          in: [
            InquiryStatus.CONFIRMED,
            InquiryStatus.IN_PRODUCTION,
            InquiryStatus.DELIVERED,
          ],
        },
      },
    }),
    db.inquiry.findMany({
      where: { createdAt: trendWhere },
      select: { createdAt: true },
    }),
    db.inquiry.groupBy({
      by: ["status"],
      where: { createdAt: trendWhere },
      _count: { _all: true },
    }),
    db.inquiry.groupBy({
      by: ["source"],
      where: { createdAt: trendWhere },
      _count: { _all: true },
    }),
    db.inquiry.groupBy({
      by: ["productId"],
      where: { createdAt: trendWhere, productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 8,
    }),
    // Category rollup needs the product join — one raw aggregate.
    db.$queryRaw<{ name: string; count: bigint }[]>`
      SELECT c.name, count(*)::bigint AS count
      FROM "Inquiry" i
      JOIN "Product" p ON p.id = i."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE i."createdAt" >= ${range.start}
        AND i."createdAt" < ${range.endExclusive ?? new Date(Date.now() + DAY_MS)}
      GROUP BY c.name ORDER BY count DESC LIMIT 8`,
    // First-touch attribution split (S-05 data): utm_source, else referrer
    // host, else "direct".
    db.$queryRaw<{ source: string; count: bigint }[]>`
      SELECT COALESCE(
               NULLIF(i.attribution->>'utm_source', ''),
               NULLIF(split_part(split_part(i.attribution->>'referrer', '//', 2), '/', 1), ''),
               'direct'
             ) AS source,
             count(*)::bigint AS count
      FROM "Inquiry" i
      WHERE i."createdAt" >= ${range.start}
        AND i."createdAt" < ${range.endExclusive ?? new Date(Date.now() + DAY_MS)}
      GROUP BY 1 ORDER BY count DESC LIMIT 8`,
  ]);

  // Resolve product titles after the groupBy (depends on its result).
  const productIds = productGroups
    .map((g) => g.productId)
    .filter((id): id is string => Boolean(id));
  const titles = new Map(
    (
      await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true },
      })
    ).map((p) => [p.id, p.title]),
  );

  const series = buildDailySeries(trendRows, range.start, range.days, tz);
  const statusCount = new Map(
    statusGroups.map((g) => [g.status, g._count._all]),
  );
  const funnelMax = Math.max(
    1,
    ...FUNNEL.map((f) => statusCount.get(f.status) ?? 0),
  );
  const sourceMax = Math.max(1, ...sourceGroups.map((g) => g._count._all));
  const productMax = Math.max(1, ...productGroups.map((g) => g._count._all));
  const categoryMax = Math.max(1, ...categoryRows.map((r) => Number(r.count)));
  const attributionMax = Math.max(
    1,
    ...attributionRows.map((r) => Number(r.count)),
  );
  const total90 = trendRows.length;

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Where inquiries come from and how they move through the WhatsApp funnel. Counts use ${bucketNote(tz)} over the selected range.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Inquiries · 30d"
          value={`${inquiries30.toLocaleString("en-IN")} (${delta(inquiries30, inquiriesPrev30)})`}
          href="/studio/inquiries"
        />
        <StatCard
          label="Confirmed or beyond · 30d"
          value={`${converted30.toLocaleString("en-IN")}${
            inquiries30 > 0
              ? ` (${Math.round((converted30 / inquiries30) * 100)}%)`
              : ""
          }`}
        />
        <StatCard
          label="Subscribers · 30d"
          value={`${subscribers30.toLocaleString("en-IN")} (${delta(subscribers30, subscribersPrev30)})`}
          href="/studio/subscribers"
        />
        <StatCard
          label="Inquiries · 90d"
          value={total90.toLocaleString("en-IN")}
        />
      </div>

      <div className="mt-6 grid gap-6">
        {/* C2 date-range — plain GET form; empty fields reset to 90d. */}
        <form
          action="/studio/analytics"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm text-muted-foreground">
            From
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="mt-1 block h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            To
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="mt-1 block h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Apply range
          </button>
        </form>

        <Section title="Inquiries over time" note={range.label}>
          <InquiriesChart data={series} />
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            title="Status funnel"
            note={`current status of the range · ${range.label}`}
          >
            <ul>
              {FUNNEL.map((f) => (
                <BarRow
                  key={f.status}
                  label={f.label}
                  count={statusCount.get(f.status) ?? 0}
                  max={funnelMax}
                />
              ))}
            </ul>
          </Section>

          <Section title="By source">
            <ul>
              {sourceGroups
                .slice()
                .sort((a, b) => b._count._all - a._count._all)
                .map((g) => (
                  <BarRow
                    key={g.source}
                    label={SOURCE_LABELS[g.source] ?? g.source}
                    count={g._count._all}
                    max={sourceMax}
                  />
                ))}
            </ul>
          </Section>

          <Section title="Top products" note="product-page orders only">
            {productGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No product inquiries in this window yet.
              </p>
            ) : (
              <ul>
                {productGroups.map((g) => (
                  <BarRow
                    key={g.productId ?? "?"}
                    label={titles.get(g.productId ?? "") ?? "(removed product)"}
                    count={g._count._all}
                    max={productMax}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section title="Top categories" note="via each inquiry's product">
            {categoryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No category data in this window yet.
              </p>
            ) : (
              <ul>
                {categoryRows.map((r) => (
                  <BarRow
                    key={r.name}
                    label={r.name}
                    count={Number(r.count)}
                    max={categoryMax}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section
          title="First-touch attribution"
          note="utm_source, else referrer host, else direct (S-05 capture)"
        >
          <ul>
            {attributionRows.map((r) => (
              <BarRow
                key={r.source}
                label={r.source}
                count={Number(r.count)}
                max={attributionMax}
              />
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
