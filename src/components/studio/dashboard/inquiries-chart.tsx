"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  CHART_AREA_GRADIENT,
  CHART_AXIS_TICK,
  CHART_INK,
} from "@/lib/chart-theme";

export type InquiriesChartPoint = {
  /** UTC day key, `YYYY-MM-DD`. */
  day: string;
  count: number;
};

/* Day keys are UTC buckets, so format them in UTC too — otherwise the label
   would shift a day for staff west of Greenwich. */
const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDay(day: string | number | undefined): string {
  return typeof day === "string" ? dayFormatter.format(new Date(day)) : "";
}

/* Tooltip content — bg-card / mist border per C3; values wear text tokens
   (never the series color). */
function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const count = typeof raw === "number" ? raw : 0;
  return (
    <div className="rounded-card border border-border bg-card px-3 py-2 shadow-e2">
      <p className="u-micro">{formatDay(label)}</p>
      <p className="u-num text-12 font-medium text-foreground">
        {count === 1
          ? "1 inquiry"
          : `${count.toLocaleString("en-IN")} inquiries`}
      </p>
    </div>
  );
}

/**
 * C3 area chart — inquiries per day over the last 30 days. Single royal-blue
 * series with a gradient fill fading to transparent, mist gridlines, minimal
 * 12px slate axes. The plot is exposed to AT as one image with a summary
 * label; the sr-only paragraph after it carries the total + peak day.
 */
export function InquiriesChart({ data }: { data: InquiriesChartPoint[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const peak = data.reduce(
    (best, d) => (d.count > best.count ? d : best),
    data[0] ?? { day: "", count: 0 },
  );
  const summary =
    total === 0
      ? "No inquiries received in the last 30 days."
      : `${total.toLocaleString("en-IN")} inquiries in the last 30 days; busiest day ${formatDay(peak.day)} with ${peak.count.toLocaleString("en-IN")}.`;

  return (
    <>
      <div
        role="img"
        aria-label={`Area chart of inquiries per day, last 30 days. ${summary}`}
        className="h-[220px] w-full"
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            /* The wrapper is role="img": keep recharts from adding focusable,
               AT-hidden internals. */
            accessibilityLayer={false}
          >
            <defs>
              {/* Colours come from `@/lib/chart-theme` — see its header for
                  why a chart is the one surface where a raw hex survives
                  every gate this repo runs. */}
              <linearGradient id="inquiries-fill" x1="0" y1="0" x2="0" y2="1">
                {CHART_AREA_GRADIENT.map(({ offset, opacity }) => (
                  <stop
                    key={offset}
                    offset={offset}
                    stopColor={CHART_INK.series}
                    stopOpacity={opacity}
                  />
                ))}
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              interval="preserveStartEnd"
              tick={CHART_AXIS_TICK}
              tickFormatter={formatDay}
            />
            <YAxis
              allowDecimals={false}
              width={30}
              tickLine={false}
              axisLine={false}
              tick={CHART_AXIS_TICK}
            />
            <Tooltip
              cursor={{ stroke: CHART_INK.grid }}
              content={ChartTooltip}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={CHART_INK.series}
              strokeWidth={2}
              fill="url(#inquiries-fill)"
              isAnimationActive={!prefersReducedMotion}
              activeDot={{
                r: 4,
                fill: CHART_INK.series,
                stroke: CHART_INK.surface,
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Text alternative outside the role="img" node, which hides its own
          descendants from AT. */}
      <p className="sr-only">{summary}</p>
    </>
  );
}
