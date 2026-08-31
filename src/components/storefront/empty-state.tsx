import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * EmptyState — REDESIGN.md §4.6 · Part 16.
 *
 * "No illustration, no icon. Statement → one line of direction → one primary
 * action." Nothing else. The premium read comes from restraint and
 * whitespace, so this component deliberately owns no surface, no border and
 * no card: it is type on whatever ground it lands on.
 *
 * ## It must be conditionally rendered
 *
 * An empty state is a claim about the data. Rendering it unconditionally
 * turns that claim into a lie, and Part 16 treats that as a defect rather
 * than a cosmetic one. The live audit finding this component exists to fix:
 * `/portfolio` renders its "no commissions yet" band underneath the archive,
 * so the page currently says the studio has no work while twenty case studies
 * are on screen. The caller owns the test — `items.length === 0 ? <EmptyState
 * … /> : <Grid … />` — and this component gives it nothing that would survive
 * the false branch.
 *
 * ## Copy is the caller's
 *
 * Both lines arrive already translated, the pattern every storefront
 * primitive here uses (see `breadcrumb.tsx`): a leaf component that called
 * `useTranslations` itself would force every page onto one shared, generic
 * sentence, and the whole point of the spec's example is that the statement
 * is specific to what is missing.
 *
 * ## Centred in its block, not on the page
 *
 * The spec asks for centred, not for the full-viewport "nothing here" screen
 * that reads as an error. The block centres its own content and stops — no
 * `min-h`, no viewport units, no vertical centring — so it occupies exactly
 * the slot the populated content would have occupied.
 */
export type EmptyStateProps = {
  /** The statement. One sentence, specific: "No commissions yet." */
  statement: string;
  /** One line of direction: "Your next project starts with an idea." */
  direction: string;
  /** Optional mono micro label above the statement (Part 3.2 · u-micro). */
  eyebrow?: string;
  /**
   * The single primary action. Pass a `<Button>` (or a `<Link>`) — this stays
   * a slot so the empty state never has to know whether the action navigates,
   * clears a filter or opens WhatsApp. `children` is accepted as the same
   * slot for callers that read better with JSX between the tags.
   */
  action?: ReactNode;
  /** Optional secondary action, rendered beside the primary one. */
  secondaryAction?: ReactNode;
  children?: ReactNode;
  /**
   * Heading level for the statement. Part 17 forbids skipped levels, and a
   * primitive cannot know its depth — the caller does. Visual size is fixed
   * at `text-h3` regardless (Part 3.2 separates level from scale).
   */
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
};

export function EmptyState({
  statement,
  direction,
  eyebrow,
  action,
  secondaryAction,
  children,
  headingLevel: Heading = "h2",
  className,
}: EmptyStateProps) {
  const primary = action ?? children;

  return (
    <div
      data-slot="sf-empty-state"
      className={cn(
        /* Generous vertical air is the whole design here — the block is
           mostly nothing, on purpose (§4.6). */
        "mx-auto flex w-full max-w-2xl flex-col items-center py-20 text-center md:py-28",
        className,
      )}
    >
      {eyebrow ? <p className="u-micro">{eyebrow}</p> : null}

      {/* h4 is not display-faced by the globals.css base layer, so the face
          is stated here and the level stays a semantics-only choice. */}
      <Heading
        className={cn(
          "font-display text-h3 tracking-display text-ink in-data-[theme=navy]:text-mineral",
          eyebrow && "mt-4",
        )}
      >
        {statement}
      </Heading>

      <p className="u-lede mt-4 font-body text-body leading-relaxed text-graphite in-data-[theme=navy]:text-mist">
        {direction}
      </p>

      {primary || secondaryAction ? (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {primary}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
