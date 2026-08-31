"use client";

import { NewsletterSignup } from "@/components/storefront/newsletter-signup";

/**
 * The footer's newsletter row — REDESIGN.md §5.8: "One component, two
 * placements only (footer, journal index)."
 *
 * This file used to be a second, near-identical implementation of the same
 * form: its own `subscribeEmail` call, its own honeypot, its own three states,
 * its own error mapping. Two implementations meant two behaviours — the footer
 * had no "already subscribed" state, no retry affordance and no loading lock —
 * so it is now a name, not a component. `NewsletterSignup`'s `inline` variant
 * IS the footer row.
 *
 * The alias stays because the footer's call site is not this pass's to change:
 * it renders its own visible `<label htmlFor>` and mono hint beside the field,
 * and passes `inputId` to bind them.
 */
export function NewsletterForm({
  source = "footer",
  inputId,
  className,
}: {
  source?: string;
  /** Email-input id so the call site's visible `<label htmlFor>` binds to it. */
  inputId?: string;
  className?: string;
}) {
  return (
    <NewsletterSignup
      variant="inline"
      source={source}
      inputId={inputId}
      className={className}
    />
  );
}
