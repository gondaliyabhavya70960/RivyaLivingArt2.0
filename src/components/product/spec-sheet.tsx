import { cn } from "@/lib/utils";

/**
 * SpecSheet — REDESIGN.md §9.4 (`MATERIALS` / `DIMENSIONS` / `DETAILS`).
 *
 * A hairline data sheet, not a table: a `dl` where each row is parted from
 * the next by the site's one divider (Part 3.5), the label sits in the mono
 * micro register and the VALUE is mono too — Part 3.2 puts "every dimension,
 * every spec value" in JetBrains Mono, and a spec sheet whose values drift
 * into Inter stops reading as measured fact.
 *
 * Server component, no state: the page builds the rows from fields that
 * actually exist on the row, so nothing here is ever invented, and an empty
 * set renders nothing at all rather than an empty heading (§9.4).
 */

export type SpecRow = {
  /** Stable key for React (field name, e.g. "materials"). */
  key: string;
  label: string;
  value: string;
};

export function SpecSheet({
  heading,
  rows,
  className,
}: {
  heading: string;
  rows: SpecRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <h3 className="u-micro">{heading}</h3>
      <dl className="border-t border-hairline">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-6 border-b border-hairline py-4 sm:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <dt className="u-micro pt-0.5">{row.label}</dt>
            <dd className="u-num min-w-0 font-mono text-14 leading-relaxed text-ink">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
