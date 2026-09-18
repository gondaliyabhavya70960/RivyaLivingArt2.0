import type { ComponentType, ReactNode } from "react";

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
 * RECORDED DECISION D31 — 2026-09-18 · line art on the STUDIO'S empty states
 * (owner instruction: "add related and needed icon and vector in Studio";
 * D18 format)
 *
 * OVERRIDES, quoted: REDESIGN.md Part 16 — "premium, directive, NO
 * ILLUSTRATION. Statement → one line → one action." That sentence was this
 * component's entire header, and it is why neither this nor
 * `storefront/empty-state.tsx` has ever carried a mark.
 *
 * TWO REPO DOCUMENTS DISAGREE HERE, and the disagreement is real rather than
 * a misreading:
 *
 *   REDESIGN.md Part 16          no illustration        (design law)
 *   implementation-plan §6.17    "Line illustration self-draws 600ms +
 *                                 one next-action pill; used in every
 *                                 Studio list"          (reference design)
 *
 * Where those two conflict the contract's own rule is that design law wins.
 * What settles it the other way is the owner instruction above, which is the
 * mechanism the contract provides for exactly this: "reversing a written rule
 * requires a recorded decision in the file that reverses it — dated, numbered,
 * quoting the rule it overrides."
 *
 * ## THE SCOPE IS THE STUDIO, AND THAT IS NOT A HEDGE
 *
 * The instruction says "in Studio", and Part 16's reasoning applies with
 * different force on the two surfaces. On the storefront, an empty state is a
 * visitor being told a collection has nothing in it, and restraint is the
 * brand — `storefront/empty-state.tsx` IS UNTOUCHED and keeps Part 16
 * verbatim. In the Studio, an empty list is a staff member being told where to
 * start, on a dense tool where §12 already permits density the storefront
 * refuses, and a 96px mark is the fastest way to tell "products" from
 * "inquiries" while scanning.
 *
 * ## The art is OPTIONAL and the structure is unchanged
 *
 * §6.17's own structure still holds: mark · short heading · one useful
 * sentence · ONE next action. A caller that passes no `art` gets exactly what
 * this component rendered before, which is what keeps the decision reversible
 * in one edit rather than in thirty call sites.
 *
 * Left-aligned on a surface ground rather than a dashed box — Part 3.5
 * separates with a surface shift, not a border that looks like a drop target.
 */
export function EmptyState({
  title,
  description,
  action,
  art: Art,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * A mark from `@/components/icons/empty-art`. It self-draws once over 600ms
   * and renders complete under reduced motion. `aria-hidden` by construction —
   * the heading beside it is the content.
   */
  art?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-card border border-border bg-card px-6 py-12 sm:px-10 sm:py-16">
      {Art ? <Art size={72} className="mb-6 text-mist" /> : null}
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
