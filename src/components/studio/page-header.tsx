import type { ReactNode } from "react";

/**
 * The single `h1` for a Studio screen, with an optional mono eyebrow and an
 * action cluster. Part 17: one `h1` per page, and the top bar deliberately
 * does not repeat this text.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  /** Mono micro label above the title — Part 3.2's eyebrow. */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-6">
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow && <p className="u-micro mb-2">{eyebrow}</p>}
        {/* The one raw leading left in src/, and deliberately so: the
            storefront's `leading-h3` (1.15) is an editorial value, and Part 12
            asks the Studio for "a functional counterpoint" — every panel screen
            opens with this line above a dense table, where 1.15 costs a row.
            A Studio leading scale is workstream A7's to define, not this
            pass's to guess. */}
        <h1 className="font-display text-h3 leading-[1.05] tracking-display text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[62ch] text-small leading-relaxed text-graphite">
            {description}
          </p>
        )}
      </div>
      {actions && (
        // `shrink-0` kept the cluster at its max-content width, so a header
        // with four buttons pushed the whole page sideways on a phone —
        // 763px inside a 390px viewport on /studio/scraper/sources.
        // `min-w-0` lets it shrink so `flex-wrap` can do its job.
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * Part 16 empty state: "premium, directive, no illustration. Statement → one
 * line → one action." Left-aligned on a `sand`/surface ground rather than a
 * dashed box — Part 3.5 separates with a surface shift, not a border that
 * looks like a drop target.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-card px-6 py-12 sm:px-10 sm:py-16">
      <p className="font-display text-h3 leading-tight tracking-display text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-3 max-w-[52ch] text-small leading-relaxed text-graphite">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
