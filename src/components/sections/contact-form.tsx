"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { trackLead } from "@/lib/analytics";
import { useFormToken } from "@/hooks/use-form-token";
import { getAttribution } from "@/lib/attribution";
import { MessageCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { submitContactInquiry, type PublicActionError } from "@/actions/public";
import { Link } from "@/i18n/navigation";
import { useWaNumber } from "@/components/providers/wa-number-provider";
import { Button } from "@/components/storefront/button";
import {
  SelectField,
  TelField,
  TextareaField,
  TextField,
} from "@/components/storefront/form-field";
import { CharCounter } from "@/components/ui/char-counter";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

type FormValues = {
  name: string;
  phone: string;
  email: string;
  message: string;
};

// Client-side validation mirrors the server action's zod schema (which stays
// authoritative). Hand-rolled react-hook-form rules keep zod out of the public
// bundle — it's only shipped to the studio forms now (PERF-003). Each rule
// trims like the server schema does before checking.
const PHONE_RE = /^[0-9+\-() ]{8,17}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * §11.7's "What's this about?".
 *
 * The five topics are a **presentation control and nothing else** — they shape
 * the prompt the message field asks for and, for a commission, point at the
 * form that asks better questions. No topic value is sent anywhere: the
 * Inquiry payload is `{name, phone, email, message}` exactly as it was, and
 * Part 1.1 puts that on the do-not-change list. A topic that quietly prefixed
 * itself into the message body would be changing what the studio receives
 * under cover of a UI improvement.
 */
const TOPICS = [
  "commission",
  "order",
  "workshop",
  "printing",
  "other",
] as const;
type Topic = (typeof TOPICS)[number] | "";

/**
 * The contact form — REDESIGN.md §11.7, Part 16, Part 17.
 *
 * One column, large labels, 56px controls on a hairline, and every current
 * field kept. What is new is the shaping select at the top, an error summary
 * that takes focus when a submit fails, and the guarantee the spec asks for
 * out loud: **a failed submit preserves everything typed.** That is why the
 * server error renders beside the still-populated form instead of swapping it
 * — the only state that replaces the form is success.
 */
export function ContactForm() {
  const t = useTranslations("Contact.form");
  const tCommon = useTranslations("Common");
  const tWa = useTranslations("WhatsApp");
  // Server actions return locale-free error CODES (S-01) — translate here.
  const tErrors = useTranslations("Errors");
  const waNumber = useWaNumber();

  // Validation messages resolve from the Contact.form namespace, so the rules
  // live in-component (they close over t); the regexes/limits mirror the
  // server action's zod schema, which stays authoritative.
  const rules = {
    name: {
      validate: (v: string) => v.trim().length >= 2 || t("validationName"),
    },
    phone: {
      validate: (v: string) => PHONE_RE.test(v.trim()) || t("validationPhone"),
    },
    email: {
      validate: (v: string) =>
        !v.trim() || EMAIL_RE.test(v.trim()) || t("validationEmail"),
    },
    message: {
      validate: {
        min: (v: string) => v.trim().length >= 10 || t("validationMessageMin"),
        max: (v: string) =>
          v.trim().length <= 2000 || t("validationMessageMax"),
      },
    },
  } as const;

  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<PublicActionError | null>(
    null,
  );
  const [topic, setTopic] = useState<Topic>("");
  const alertRef = useRef<HTMLDivElement>(null);

  // Spam-check inputs. The effect only writes refs — no state, no re-render.
  const getFormToken = useFormToken();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormValues>({
    // Validate each field on first blur (then on change) instead of batching
    // every error at submit time.
    mode: "onTouched",
    // Part 17 wants the SUMMARY focused on a failed submit, not the first bad
    // input — RHF's default would race our own focus and win.
    shouldFocusError: false,
    defaultValues: { name: "", phone: "", email: "", message: "" },
  });

  const messageLength = (useWatch({ control, name: "message" }) ?? "").length;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await submitContactInquiry({
      ...values,
      email: values.email || undefined,
      honeypot: honeypotRef.current?.value ?? "",
      formToken: await getFormToken(),
      attribution: getAttribution(),
    });
    if (result.ok) {
      setSubmitted(true);
      trackLead("contact_submitted");
    } else {
      // Everything the visitor typed stays exactly where it is — RHF is never
      // reset on failure, and the form is never unmounted (§11.7).
      setServerError(result.error);
      requestAnimationFrame(() => alertRef.current?.focus());
    }
  }

  /** Part 17: the summary takes focus when client validation fails. */
  function onInvalid() {
    requestAnimationFrame(() => {
      alertRef.current?.focus({ preventScroll: true });
      alertRef.current?.scrollIntoView({ block: "center" });
    });
  }

  if (submitted) {
    return (
      /* role="status" announces the swap, and tabIndex/-1 + the mount-focus
         catches the keyboard position — otherwise the form (with the focused
         submit button) unmounts silently and focus falls to <body>. */
      <div
        role="status"
        tabIndex={-1}
        ref={(el) => el?.focus({ preventScroll: true })}
        className="flex flex-col gap-6 border-s-2 border-success ps-6 outline-none md:ps-8"
      >
        <p className="u-micro text-champagne-ink">{t("successEyebrow")}</p>
        <h3 className="font-display text-h3 leading-[1.15] tracking-display text-ink">
          {t("successHeading")}
        </h3>
        <p className="u-prose font-body text-body leading-relaxed text-graphite">
          {t("successBody")}
        </p>
        <Button variant="whatsapp" size="lg" className="w-fit" asChild>
          <a
            href={buildWaLink(defaultWaGreeting(tWa("greeting")), waNumber)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
            {t("successCta")}
            <span className="sr-only"> {tCommon("openInNewTab")}</span>
          </a>
        </Button>
      </div>
    );
  }

  const errorList = Object.entries(errors)
    .map(([field, error]) => [field, error?.message] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  const showErrorSummary = isSubmitted && errorList.length > 0;

  return (
    /* handleSubmit is invoked at event time so the ref-reading submit handler
       is never touched during render (react-hooks/refs). */
    <form
      onSubmit={(e) => void handleSubmit(onSubmit, onInvalid)(e)}
      noValidate
      className="flex flex-col gap-8"
    >
      {/* Honeypot — invisible to humans, irresistible to bots. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* §11.7 — the shaping select, first, so the rest of the form knows what
          it is asking about. Presentation only: nothing here is submitted. */}
      <SelectField
        id="contact-topic"
        name="topic"
        label={t("topicLabel")}
        placeholder={t("topicPlaceholder")}
        options={TOPICS.map((value) => ({
          value,
          label: t(`topics.${value}`),
        }))}
        value={topic}
        onChange={(e) => setTopic(e.target.value as Topic)}
      />

      {topic === "commission" ? (
        <p className="border-s border-champagne ps-4 font-body text-14 leading-relaxed text-graphite">
          {t("commissionNudge")}{" "}
          <Link
            href="/custom-order"
            className="font-medium text-sapphire underline underline-offset-4 hover:text-sapphire-hi"
          >
            {t("commissionNudgeCta")}
          </Link>
        </p>
      ) : null}

      <TextField
        id="contact-name"
        label={t("nameLabel")}
        autoComplete="name"
        placeholder={t("namePlaceholder")}
        error={errors.name?.message}
        {...register("name", rules.name)}
      />

      <TelField
        id="contact-phone"
        label={t("phoneLabel")}
        placeholder="+91 98765 43210"
        hint={t("phoneHint")}
        error={errors.phone?.message}
        {...register("phone", rules.phone)}
      />

      <TextField
        id="contact-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        label={t("emailLabel")}
        optionalLabel={t("optional")}
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email", rules.email)}
      />

      <div className="flex flex-col gap-2">
        <TextareaField
          id="contact-message"
          label={t("messageLabel")}
          rows={6}
          maxLength={2000}
          // The one thing the topic select changes: what we ask you to write.
          placeholder={
            topic ? t(`messagePrompts.${topic}`) : t("messagePlaceholder")
          }
          error={errors.message?.message}
          {...register("message", rules.message)}
        />
        <CharCounter
          length={messageLength}
          max={2000}
          className="font-mono text-micro [--destructive:var(--alert)] [--muted-foreground:var(--graphite)]"
        />
      </div>

      {/* The error summary — client failures and server failures land in the
          same place, and it takes focus either way. */}
      <div ref={alertRef} tabIndex={-1} className="empty:hidden">
        {serverError ? (
          <p
            role="alert"
            className="border-s-2 border-alert ps-4 font-body text-16 text-alert"
          >
            {tErrors(serverError)}
          </p>
        ) : showErrorSummary ? (
          <div role="alert" className="border-s-2 border-alert ps-4">
            <p className="font-body text-16 font-medium text-alert">
              {t("errorSummaryTitle", { count: errorList.length })}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {errorList.map(([field, message]) => (
                <li key={field}>
                  <a
                    href={`#contact-${field}`}
                    className="font-body text-14 text-alert underline underline-offset-4"
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          className="w-fit"
          loading={isSubmitting}
          loadingLabel={t("sending")}
        >
          {t("send")}
        </Button>
        <p className="font-body text-14 leading-relaxed text-graphite">
          {t("sendNote")}
        </p>
      </div>
    </form>
  );
}
