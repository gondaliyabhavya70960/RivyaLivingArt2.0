"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { subscribeEmail } from "@/actions/public";
import { useFormToken } from "@/hooks/use-form-token";
import { Button } from "@/components/storefront/button";
import { EmailField } from "@/components/storefront/form-field";
import { toast } from "@/components/storefront/toast";
import { trackLead } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Newsletter — REDESIGN.md §5.8.
 *
 * > "One component, two placements only (footer, journal index) — it currently
 * > appears twice on the homepage, once under a duplicate 'Notes from the
 * > studio' heading. Dark section, large display heading, one line of copy,
 * > single field, `Subscribe`. Real states: idle → submitting → success
 * > (`You're on the list.`) → already subscribed → error with retry. Helper
 * > line in mono: `THREE OR FOUR LETTERS A YEAR`."
 *
 * This IS that one component. `NewsletterForm` (sections/newsletter-form.tsx)
 * is now a thin alias of the `inline` variant, so the footer call site keeps
 * working and there is exactly one implementation of the action call, the spam
 * signals, the analytics event and the five states.
 *
 * Two variants, one machine:
 *
 * The `section` variant's inks are scope-resolved rather than hardcoded to a
 * dark ground: §5.8 describes a dark band, but §3.1 forbids one touching the
 * obsidian footer, so the journal index places the same component on sand.
 * Hardcoding mineral-on-obsidian made that placement invisible.
 *
 * - **`section`** — the band: display heading, one line of copy, the
 *   field and `Subscribe` side by side from `sm`, mono helper beneath. Used on
 *   the journal index (and the homepage's closing band).
 * - **`inline`** — the field alone on a shared hairline, for a call site that
 *   already renders its own label and hint (the footer's newsletter row).
 *   `inputId` binds that external `<label htmlFor>`.
 *
 * ## Why the heading is not `journal.heading`
 *
 * The previous version titled itself "Notes from the studio.", which is the
 * journal's own heading — so the homepage shipped that sentence twice and the
 * journal index would have shipped it three times. Part 17 forbids duplicated
 * heading text on a page, so the newsletter now owns its own line.
 *
 * ## "Already subscribed" is honest, not guessed
 *
 * `subscribeEmail` upserts, so a re-subscribe is a plain success and the
 * server never reports "already on the list" — and changing that would be a
 * Server Action change, which this pass may not make. What the component CAN
 * know truthfully is that *this visitor already submitted this address here*,
 * which is exactly the case the state exists for: they subscribed in the
 * footer, kept reading, and hit the journal index's form with the same
 * address. The accepted set therefore lives at module scope rather than in a
 * ref — it is shared by every mounted form and survives client-side
 * navigation, which is the only way the state is ever reached (a successful
 * form is replaced by its confirmation, so it can never be submitted twice).
 * Nothing is persisted: no storage, no address written anywhere, and no claim
 * about data the server did not tell us.
 */

/** Addresses accepted from any newsletter form in this browsing session. */
const acceptedInSession = new Set<string>();

type Status = "idle" | "submitting" | "done" | "already" | "error";

export function NewsletterSignup({
  source = "home",
  variant = "section",
  inputId,
  className,
}: {
  /** Where they subscribed from — stored on the Subscriber row. */
  source?: string;
  variant?: "section" | "inline";
  /** Email-input id so a call site's visible `<label htmlFor>` binds to it. */
  inputId?: string;
  className?: string;
}) {
  const t = useTranslations("Newsletter");
  const tFooter = useTranslations("Footer");
  const tErrors = useTranslations("Errors");

  const reactId = useId();
  const fieldId = inputId ?? `sf-newsletter-${reactId}`;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const getFormToken = useFormToken();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "submitting") return;

    const address = email.trim();
    if (acceptedInSession.has(address.toLowerCase())) {
      setStatus("already");
      return;
    }

    setStatus("submitting");
    setError("");

    let result: Awaited<ReturnType<typeof subscribeEmail>>;
    try {
      result = await subscribeEmail({
        email: address,
        source,
        honeypot: honeypotRef.current?.value ?? "",
        formToken: await getFormToken(),
      });
    } catch {
      // Network/transport failure — the action itself never throws.
      result = { ok: false, error: "generic" };
    }

    if (result.ok) {
      // Spam-rejected submissions return silent:true — skip the lead event.
      if (!result.silent) trackLead("newsletter_subscribe", { source });
      acceptedInSession.add(address.toLowerCase());
      setStatus("done");
      toast.success(t("success"));
      return;
    }

    // Action errors arrive as locale-free codes (S-01) — translate once.
    const message = tErrors(result.error);
    setError(message);
    setStatus("error");
    toast.error(message);
    // Put the visitor straight back in the field to correct it.
    document.getElementById(fieldId)?.focus();
  }

  /* Part 16 · success is an explicit confirmation with role="status". The
     form is replaced rather than reset: there is nothing left to do. */
  const confirmation =
    status === "done" ? t("success") : status === "already" ? t("already") : "";

  const helper = <p className="u-micro">{t("helper")}</p>;

  if (confirmation && variant === "inline") {
    return (
      <p
        role="status"
        className={cn(
          "font-body text-body text-ink in-data-[theme=navy]:text-mineral",
          className,
        )}
      >
        {confirmation}
      </p>
    );
  }

  const form = (
    <form
      data-slot="sf-newsletter"
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        variant === "section" ? "flex flex-col gap-3" : "flex flex-col gap-2",
        variant === "inline" && className,
      )}
    >
      {/* Honeypot — invisible to humans, irresistible to bots. */}
      <input
        ref={honeypotRef}
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="sr-only"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <EmailField
          id={fieldId}
          label={t("fieldLabel")}
          name="newsletter-email"
          hideLabel
          required
          autoComplete="email"
          placeholder={tFooter("newsletterPlaceholder")}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === "error") setStatus("idle");
          }}
          error={error || undefined}
          className="flex-1"
        />
        <Button
          type="submit"
          size={variant === "section" ? "md" : "sm"}
          loading={status === "submitting"}
          loadingLabel={t("submitting")}
          className="shrink-0"
        >
          {status === "error" ? t("retry") : t("submit")}
        </Button>
      </div>
      {variant === "inline" ? null : helper}
    </form>
  );

  if (variant === "inline") return form;

  return (
    <div
      data-slot="sf-newsletter-section"
      className={cn("grid gap-8 lg:grid-cols-12 lg:items-start", className)}
    >
      <div className="flex flex-col gap-4 lg:col-span-6">
        <h2 className="max-w-[16ch] font-display text-h2 leading-[1.06] tracking-display text-ink in-data-[theme=navy]:text-mineral">
          {t("heading")}
        </h2>
        <p className="u-lede font-body text-body text-graphite in-data-[theme=navy]:text-mist">
          {t("body")}
        </p>
      </div>
      <div className="lg:col-span-5 lg:col-start-8">
        {confirmation ? (
          <div className="flex flex-col gap-3">
            <p
              role="status"
              className="font-display text-h3 leading-h3 text-ink in-data-[theme=navy]:text-mineral"
            >
              {confirmation}
            </p>
            {helper}
          </div>
        ) : (
          form
        )}
      </div>
    </div>
  );
}
