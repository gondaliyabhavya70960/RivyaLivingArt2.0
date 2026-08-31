"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { subscribeEmail } from "@/actions/public";
import { Button } from "@/components/storefront/button";
import { EmailField } from "@/components/storefront/form-field";
import { toast } from "@/components/storefront/toast";
import { useFormToken } from "@/hooks/use-form-token";
import { trackLead } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Explicit input id so the error path can restore focus (UIUX-P30). */
const INPUT_ID = "sf-workshop-waitlist-email";

/**
 * The workshop waitlist — REDESIGN.md §11.5 item 5.
 *
 * "When dates don't exist, an actual waitlist form, and an empty state that
 * invites rather than apologises." A page that says "workshops are being
 * scheduled" and then offers nothing to do about it wastes the only intent
 * the visitor arrived with.
 *
 * **No new endpoint.** This posts to the same `subscribeEmail` Server Action
 * the newsletter uses, with the same honeypot and form-token spam signals,
 * and tags the row `workshops-waitlist` through the action's existing
 * `source` field — so the studio can see who asked for dates without a
 * second table, a second action or a second thing to maintain.
 *
 * Success swaps the form for a `role="status"` confirmation *and* raises a
 * toast, so the answer lands whether or not the toaster is mounted; errors
 * arrive as locale-free codes and are translated once, here.
 */
export function WorkshopWaitlist({ className }: { className?: string }) {
  const t = useTranslations("Workshops.waitlist");
  const tErrors = useTranslations("Errors");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const getFormToken = useFormToken();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError("");

    let result: Awaited<ReturnType<typeof subscribeEmail>>;
    try {
      result = await subscribeEmail({
        email: email.trim(),
        source: "workshops-waitlist",
        honeypot: honeypotRef.current?.value ?? "",
        formToken: await getFormToken(),
      });
    } catch {
      // Network/transport failure — the action itself never throws.
      result = { ok: false, error: "generic" };
    }

    if (result.ok) {
      // Spam-rejected submissions return silent:true — skip the lead event.
      if (!result.silent) {
        trackLead("newsletter_subscribe", { source: "workshops-waitlist" });
      }
      setStatus("done");
      toast.success(t("success"));
    } else {
      const message = tErrors(result.error);
      setError(message);
      setStatus("idle");
      toast.error(message);
      document.getElementById(INPUT_ID)?.focus();
    }
  }

  if (status === "done") {
    return (
      <p
        role="status"
        className={cn(
          "font-body text-body leading-relaxed text-success",
          className,
        )}
      >
        {t("success")}
      </p>
    );
  }

  return (
    <form
      data-slot="sf-workshop-waitlist"
      onSubmit={handleSubmit}
      noValidate
      className={cn("flex w-full flex-col gap-4", className)}
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
          id={INPUT_ID}
          label={t("label")}
          name="workshop-waitlist-email"
          required
          placeholder={t("placeholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error || undefined}
          className="flex-1"
        />
        <Button
          type="submit"
          size="lg"
          loading={status === "submitting"}
          loadingLabel={t("submitting")}
          className="shrink-0 sm:mt-7"
        >
          {t("submit")}
        </Button>
      </div>
      <p className="u-micro">{t("hint")}</p>
    </form>
  );
}
