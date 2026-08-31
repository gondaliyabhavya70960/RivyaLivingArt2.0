"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/storefront/button";
import { cn } from "@/lib/utils";

/**
 * ErrorState — REDESIGN.md §4.6 · Part 16.
 *
 * "Human language, never technical. Retry + a WhatsApp escape hatch."
 *
 * Three rules are baked in rather than left to the caller:
 *
 * 1. **Nothing technical reaches the reader.** There is no prop for a stack,
 *    a message off an `Error`, or an HTTP status — the only machine-shaped
 *    string this renders is the optional `reference`, and that exists so a
 *    person can quote it to us, not so they can debug it. Anything the caller
 *    logs, it logs to the console.
 * 2. **The escape hatch is not optional.** Part 0 makes WhatsApp the only way
 *    an order finishes, which means a failed page is a failed sale unless the
 *    conversation can continue somewhere else. `whatsappHref` is required.
 * 3. **Retry is the primary act.** Most of these errors are transient, so the
 *    solid button reloads and WhatsApp stays secondary — carrying the Lucide
 *    mark at the house 1.5 stroke (Part 3.7) so the affordance still reads,
 *    without spending the reserved WhatsApp green on something that is not
 *    the Place Order action.
 *
 * Copy arrives already translated (the `breadcrumb.tsx` pattern) — a leaf
 * primitive that fetched its own strings would flatten every failure on the
 * site into one sentence, and a 500 does not sound like an empty search.
 *
 * `"use client"` is real here: `onRetry` is an event handler, and the two
 * places this belongs (`error.tsx`, `global-error.tsx`) are client boundaries
 * by definition.
 */
export type ErrorStateProps = {
  /** The display statement, in plain words: "Something went wrong." */
  statement: string;
  /** One line of reassurance — what we know, what usually fixes it. */
  reassurance: string;
  /** Optional mono micro label above the statement (Part 3.2 · u-micro). */
  eyebrow?: string;
  /** Translated label for the retry action. */
  retryLabel: string;
  /**
   * Retry handler — typically the `reset` a Next.js error boundary hands
   * down. Omit it where there is nothing to retry (a hard 500 served from a
   * static shell) and the retry action simply does not render.
   */
  onRetry?: () => void;
  /** `wa.me` deep link — build it with `@/lib/whatsapp`, never inline. */
  whatsappHref: string;
  /** Translated label for the WhatsApp escape hatch. */
  whatsappLabel: string;
  /**
   * Translated `Common.openInNewTab`. Passing it opens WhatsApp in a new tab
   * and appends the string as screen-reader-only text — the same contract the
   * footer and the mobile bar use. Omitted, the link stays in-tab.
   */
  whatsappNewTabLabel?: string;
  /**
   * Optional reference code for the 500 page — the digest a visitor can quote
   * back to us. Rendered mono and selectable, and deliberately NOT through
   * `u-micro`: that utility uppercases, and a reference has to survive being
   * copied into a WhatsApp message exactly as it was shown.
   */
  reference?: string;
  /**
   * Heading level for the statement. Part 17 forbids skipped levels; on a
   * full-page boundary this is the page's only `h1`, inside a failed list it
   * is an `h2`. Visual size stays `text-h3` either way.
   */
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
};

export function ErrorState({
  statement,
  reassurance,
  eyebrow,
  retryLabel,
  onRetry,
  whatsappHref,
  whatsappLabel,
  whatsappNewTabLabel,
  reference,
  headingLevel: Heading = "h2",
  className,
}: ErrorStateProps) {
  return (
    <div
      data-slot="sf-error-state"
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col items-center py-20 text-center md:py-28",
        className,
      )}
    >
      {eyebrow ? <p className="u-micro">{eyebrow}</p> : null}

      <Heading
        className={cn(
          "font-display text-h3 tracking-display text-ink in-data-[theme=navy]:text-mineral",
          eyebrow && "mt-4",
        )}
      >
        {statement}
      </Heading>

      <p className="u-lede mt-4 font-body text-body leading-relaxed text-graphite in-data-[theme=navy]:text-mist">
        {reassurance}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <Button size="lg" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}

        <Button size="lg" variant="secondary" asChild>
          <a
            href={whatsappHref}
            {...(whatsappNewTabLabel
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
            {whatsappLabel}
            {whatsappNewTabLabel ? (
              <span className="sr-only"> {whatsappNewTabLabel}</span>
            ) : null}
          </a>
        </Button>
      </div>

      {reference ? (
        <p className="mt-8 font-mono text-micro leading-relaxed text-graphite select-all in-data-[theme=navy]:text-mist">
          {reference}
        </p>
      ) : null}
    </div>
  );
}
