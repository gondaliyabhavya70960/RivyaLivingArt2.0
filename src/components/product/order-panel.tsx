"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useFormToken } from "@/hooks/use-form-token";
import { asWaLocale } from "@/i18n/config";
import { trackEvent as track, trackLead } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
import { MessageCircle } from "lucide-react";

import { submitProductOrder } from "@/actions/order";
import { Button } from "@/components/storefront/button";
import {
  ColourSwatches,
  EngravingField,
  MaterialChips,
  SizeCards,
} from "@/components/storefront/customization-controls";
import { fieldControlClasses } from "@/components/storefront/form-field";
import { ReferenceImageUploader } from "@/components/storefront/reference-image-uploader";
import {
  WhatsAppSummaryCard,
  type SummaryRow,
} from "@/components/storefront/whatsapp-summary-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CharCounter } from "@/components/ui/char-counter";
import { swatchColor } from "@/lib/swatch-colors";
import { uploadReferenceImages } from "@/lib/upload-client";
import { cn, formatPriceBand } from "@/lib/utils";
import { buildOrderMessage, localizedOrderLabels } from "@/lib/whatsapp";

export type OrderPanelFieldType =
  | "SELECT"
  | "TEXT"
  | "SWATCH"
  | "SIZE"
  | "NUMBER"
  | "FILE";

export type OrderPanelProduct = {
  id: string;
  slug: string;
  title: string;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean;
  inStock: boolean;
  timeline: string | null;
  /** Synthetic Content Lab row (owner decision 9 — a dead button on a live
   *  card is worse). The flow still submits; the note beneath the CTA says so. */
  isDemo: boolean;
  customFields: {
    id: string;
    label: string;
    type: OrderPanelFieldType;
    options: string[];
    required: boolean;
    helpText: string | null;
    order: number;
  }[];
};

/**
 * Server-resolved copy for the out-of-stock enquiry flow (audit H2 — honest
 * OOS: the flow reframes as a restock enquiry instead of pretending the
 * piece can ship). Resolved in the PDP server component from the Product
 * message namespace (with its per-key English fallback) so the client
 * bundle carries no hardcoded strings and locales that haven't synced the
 * new keys yet never render raw key paths.
 */
export type OrderPanelOosCopy = {
  /** Submit CTA — Product.oosCta ("Ask about restock on WhatsApp"). */
  cta: string;
  /** First line of the live order summary — Product.oosSummaryNote. */
  summaryNote: string;
  /** Enquiry-framed intro for the WhatsApp message — Product.oosWaIntro. */
  waIntro: string;
};

/* Swatch colour names → css moved to `src/lib/swatch-colors.ts` (A3): the
   table and `swatchColor()` are byte-identical, only the import site moved
   so the resolver can be unit-tested apart from this client component. */

const PHONE_PATTERN = /^[0-9+\-() ]{8,17}$/;

/** Beyond this many options a chip wall stops helping and a menu starts. */
const CHIP_CEILING = 12;

/** Field-label register — the storefront form-field label language. */
const LABEL_CLASSES = "font-body text-14 font-medium text-ink";

/** Inline "(optional)" note beside a label. */
const OPTIONAL_CLASSES = "font-body font-normal text-graphite";

/** Error line under a control — text + border, never colour-only. */
const ERROR_CLASSES = "font-body text-12 text-alert";

/** Help/hint line under a control. */
const HINT_CLASSES = "font-body text-12 text-graphite";

type Phase = "idle" | "uploading" | "submitting";

/**
 * THE conversion surface — REDESIGN.md §9.2 · §9.3 · Part 0.
 *
 * Product customization → reference images → customer details → Inquiry row →
 * WhatsApp deep link. No cart, no payment: WhatsApp is checkout.
 *
 * **Nothing below the presentation layer moved.** `buildEntries`, `validate`
 * and `handleSubmit` are the same functions they were; the payload
 * `submitProductOrder` receives and the message `buildOrderMessage` produces
 * are byte-identical to the version this replaces. §9.3 is explicit that the
 * customization change is presentational, and the Part 0 order flow is the
 * one thing on this site that must not drift.
 *
 * What did change:
 *
 * - **Dropdowns became objects** (§9.3): circular colour swatches, material
 *   chips, size cards with a scale silhouette, and an engraving input with a
 *   live typography preview. A `SELECT` past twelve options keeps the menu —
 *   a chip wall of thirty is not a premium control, it is a different mess.
 * - **The live summary became `WhatsAppSummaryCard`**, collapsed behind
 *   "Preview your message ▾" (§4.6). It used to sit open beneath the CTA,
 *   pushing the action off screen on a phone. Empty fields render as `— `
 *   so the card doubles as a checklist of what the message still needs.
 * - **Two columns from `lg`**: the form in cols 1–7, the summary sticky in
 *   cols 9–12, which is exactly where §4.6 puts it on desktop.
 */
export function ProductOrderPanel({
  product,
  oosCopy = null,
}: {
  product: OrderPanelProduct;
  oosCopy?: OrderPanelOosCopy | null;
}) {
  const router = useRouter();

  // Honest out-of-stock flow (audit H2): the form still submits — the studio
  // WANTS the restock conversation — but the CTA, summary and WhatsApp
  // message all say what this really is: an availability enquiry.
  const outOfStock = !product.inStock && oosCopy !== null;

  // Fields render (and enter the summary) in studio-defined order.
  const fields = [...product.customFields].sort((a, b) => a.order - b.order);
  const fileFields = fields.filter((f) => f.type === "FILE");

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progressText, setProgressText] = useState("");
  /**
   * Whole reference images already uploaded — drives the per-file progress
   * hairline in §4.6's `Upload`. `uploadReferenceImages` reports completed
   * files, so the bar tracks a real network rather than a timer.
   */
  const [uploadedCount, setUploadedCount] = useState(0);

  // WhatsApp message language — preview + submit both follow the UI locale.
  const locale = useLocale();
  const tWa = useTranslations("WhatsApp");
  const t = useTranslations("Product.order");
  // Product.demoOrderNote lives at the namespace root, not under `.order`.
  const tProduct = useTranslations("Product");

  // Spam-check inputs — same pattern as the contact form: the effect only
  // writes refs, never state.
  const getFormToken = useFormToken();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Emit once when the user first interacts, so form-completion rate and the
  // start→submit→success funnel can be computed (MKT-007).
  function handleFormStart() {
    if (startedRef.current) return;
    startedRef.current = true;
    track("order_form_started", { slug: product.slug });
  }
  function setSelection(fieldId: string, value: string) {
    setSelections((prev) => ({ ...prev, [fieldId]: value }));
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  /** Shared by the live preview and the submit payload. */
  function buildEntries(): { label: string; value: string }[] {
    return fields.flatMap((field) => {
      if (field.type === "FILE") {
        return files.length > 0
          ? [
              {
                label: field.label,
                // Localized like WhatsApp.greeting: the visitor's language
                // carries into the persisted payload by design (S-01).
                value: t("referenceAttached", { count: files.length }),
              },
            ]
          : [];
      }
      const value = (selections[field.id] ?? "").trim();
      return value ? [{ label: field.label, value }] : [];
    });
  }

  // Live summary — buildOrderMessage is a pure lib fn, safe on the client.
  // Image links appear as filenames until the real upload happens on submit.
  // The preview uses the SAME localized labels the server action rebuilds
  // with, so what the customer sees is what WhatsApp receives. For an
  // out-of-stock piece the intro swaps to the enquiry framing — mirrored by
  // submitProductOrder so preview and persisted message stay identical.
  const orderLabels = localizedOrderLabels(
    (key) => String(tWa.raw(key)),
    locale,
  );
  const previewMessage = buildOrderMessage(
    {
      productTitle: product.title,
      selections: buildEntries(),
      referenceImageUrls: files.map((f) => f.name),
      notes: notes.trim() || undefined,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      },
    },
    outOfStock && oosCopy
      ? { ...orderLabels, intro: oosCopy.waIntro }
      : orderLabels,
  );

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      if (field.type === "FILE") {
        if (files.length === 0) {
          errors[field.id] = t("errors.referenceRequired", {
            label: field.label,
          });
        }
      } else if (!(selections[field.id] ?? "").trim()) {
        errors[field.id] = t("errors.required");
      }
    }
    if (name.trim().length < 2) errors.name = t("errors.name");
    if (!PHONE_PATTERN.test(phone.trim())) errors.phone = t("errors.phone");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()))
      errors.email = t("errors.email");
    if (notes.trim().length > 1500)
      errors.notes = t("errors.notesLength", { max: 1500 });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) {
      // Move focus to the first invalid control so it's announced and the
      // user isn't stranded on the submit button (A11Y-004). rAF waits for
      // the aria-invalid attributes to flush after the state update. Chip
      // groups carry aria-invalid + tabIndex=-1, so a required-swatch-only
      // failure is caught too, and we scroll it into view for mobile.
      requestAnimationFrame(() => {
        const target = formRef.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"], [data-error="true"]',
        );
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        target?.focus();
      });
      return;
    }

    try {
      // 1. Upload reference images (compressed client-side).
      let referenceImageUrls: string[] = [];
      if (files.length > 0) {
        setPhase("uploading");
        setUploadedCount(0);
        setProgressText(t("uploadProgress", { done: 0, total: files.length }));
        const uploaded = await uploadReferenceImages(files, (done, total) => {
          setUploadedCount(done);
          setProgressText(t("uploadProgress", { done, total }));
        });
        referenceImageUrls = uploaded.map((u) => u.url);
      }

      // 2. Create the Inquiry + get the WhatsApp deep link.
      setPhase("submitting");
      setProgressText("");
      // Fires for every attempt (incl. ones that fail below) so form-completion
      // rate and drop-off are measurable, not just successes (MKT-007).
      track("order_submit_attempt", { slug: product.slug });
      const result = await submitProductOrder({
        productId: product.id,
        selections: buildEntries(),
        referenceImageUrls,
        notes: notes.trim() || undefined,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        honeypot: honeypotRef.current?.value ?? "",
        formToken: await getFormToken(),
        attribution: getAttribution(),
        locale: asWaLocale(locale),
      });

      if (result.ok) {
        // Completed order — reaches Meta Lead + GA4 generate_lead (MKT-206).
        trackLead("order_submitted", { slug: product.slug });
        track("whatsapp_redirected");
        // Open WhatsApp AND land on the fallback page — popup blockers
        // can't strand the customer.
        window.open(result.data.whatsappUrl, "_blank", "noopener");
        router.push(
          `/whatsapp-order?i=${result.data.inquiryId}&t=${result.data.claimToken}`,
        );
      } else {
        // The funnel counted attempts and successes but never failures, so a
        // server-rejected order was indistinguishable from one nobody
        // submitted (MKT-007's remaining leg).
        track("order_submit_failed", {
          slug: product.slug,
          reason: "rejected",
        });
        setServerError(result.error);
        setPhase("idle");
      }
    } catch (error) {
      track("order_submit_failed", { slug: product.slug, reason: "threw" });
      setServerError(
        error instanceof Error ? error.message : t("errors.generic"),
      );
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  /* §4.6 — the card doubles as a checklist: an unfilled row shows "—". */
  const summaryRows: SummaryRow[] = [
    { label: t("summaryPiece"), value: product.title },
    {
      label: t("summaryPrice"),
      value: product.showPrice
        ? [
            formatPriceBand(product.priceMin, product.priceMax),
            product.timeline
              ? t("craftedIn", { timeline: product.timeline })
              : "",
          ]
            .filter(Boolean)
            .join(" ")
        : t("priceOnWhatsApp"),
    },
    ...buildEntries().map((entry) => ({
      label: entry.label,
      value: entry.value,
    })),
    ...(files.length > 0
      ? [
          {
            label: t("referenceImagesLabel"),
            value: t("referenceAttached", { count: files.length }),
          },
        ]
      : []),
    { label: t("nameLabel"), value: name.trim() },
    { label: t("phoneLabel"), value: phone.trim() },
    { label: t("emailLabel"), value: email.trim() },
  ];

  return (
    <form
      ref={formRef}
      onSubmit={(e) => void handleSubmit(e)}
      onFocusCapture={handleFormStart}
      noValidate
      className="grid gap-12 lg:grid-cols-12 lg:gap-x-16"
    >
      {/* Honeypot — invisible to humans, irresistible to bots. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="order-website">Website</label>
        <input
          id="order-website"
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-10 lg:col-span-7">
        {/* ——— customization fields ——— */}
        {fields.length > 0 ? (
          <div className="flex flex-col gap-8">
            {fields.map((field) => (
              <OrderField
                key={field.id}
                field={field}
                value={selections[field.id] ?? ""}
                onChange={(value) => setSelection(field.id, value)}
                error={
                  field.type === "FILE" ? undefined : fieldErrors[field.id]
                }
                disabled={busy}
              />
            ))}
          </div>
        ) : null}

        {/* ——— reference images (uploaded on submit) ——— */}
        <div className="space-y-2">
          {/* A <span id>, not a <label htmlFor>: §4.6's Upload wraps its own
              <label> around the file input, and a second `for` pointing at
              the same input would be concatenated into the control's
              accessible name. `labelledBy` gives the input this line as its
              name instead. */}
          <span
            id={`order-${product.id}-reference-label`}
            className={LABEL_CLASSES}
          >
            {t("referenceImagesLabel")}{" "}
            <span className={OPTIONAL_CLASSES}>
              {fileFields.some((f) => f.required) ? (
                <span aria-hidden className="text-alert">
                  *
                </span>
              ) : (
                t("optional")
              )}
            </span>
          </span>
          <ReferenceImageUploader
            idPrefix={`order-${product.id}`}
            labelledBy={`order-${product.id}-reference-label`}
            onFilesChange={(next) => {
              setFiles(next);
              setFieldErrors((prev) => {
                const cleaned = { ...prev };
                for (const f of fileFields) delete cleaned[f.id];
                return cleaned;
              });
            }}
            disabled={busy}
            uploading={phase === "uploading"}
            uploadedCount={uploadedCount}
          />
          {fileFields.map((field) => (
            <p key={field.id} className={HINT_CLASSES}>
              {field.label}
              {field.required && (
                <span aria-hidden className="text-alert">
                  {" "}
                  *
                </span>
              )}{" "}
              {t("attachAbove")}
              {field.helpText ? ` ${field.helpText}` : ""}
            </p>
          ))}
          {fileFields.map(
            (field) =>
              fieldErrors[field.id] && (
                <p
                  key={`${field.id}-error`}
                  role="alert"
                  className={ERROR_CLASSES}
                >
                  {fieldErrors[field.id]}
                </p>
              ),
          )}
        </div>

        {/* ——— notes ——— */}
        <div className="space-y-2">
          <label htmlFor="order-notes" className={LABEL_CLASSES}>
            {t("notesLabel")}{" "}
            <span className={OPTIONAL_CLASSES}>{t("optional")}</span>
          </label>
          <textarea
            id="order-notes"
            rows={3}
            maxLength={1500}
            placeholder={t("notesPlaceholder")}
            value={notes}
            disabled={busy}
            aria-invalid={fieldErrors.notes ? true : undefined}
            aria-describedby={
              fieldErrors.notes ? "order-notes-error" : undefined
            }
            onChange={(e) => setNotes(e.target.value)}
            className={`resize-y py-2.5 ${fieldControlClasses}`}
          />
          {/* Mono per Part 3.2; the var re-scopes point the counter's shared
              status colours at the v3 AA inks. */}
          <CharCounter
            length={notes.length}
            max={1500}
            className="font-mono [--destructive:var(--alert)] [--muted-foreground:var(--graphite)]"
          />
          {fieldErrors.notes && (
            <p id="order-notes-error" role="alert" className={ERROR_CLASSES}>
              {fieldErrors.notes}
            </p>
          )}
        </div>

        {/* ——— customer details ——— */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="order-name" className={LABEL_CLASSES}>
              {t("nameLabel")}{" "}
              <span aria-hidden className="text-alert">
                *
              </span>
              <span className="sr-only">{t("required")}</span>
            </label>
            <input
              id="order-name"
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              value={name}
              disabled={busy}
              required
              aria-required
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={
                fieldErrors.name ? "order-name-error" : undefined
              }
              onChange={(e) => setName(e.target.value)}
              className={`h-11 ${fieldControlClasses}`}
            />
            {fieldErrors.name && (
              <p id="order-name-error" role="alert" className={ERROR_CLASSES}>
                {fieldErrors.name}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="order-phone" className={LABEL_CLASSES}>
              {t("phoneLabel")}{" "}
              <span aria-hidden className="text-alert">
                *
              </span>
              <span className="sr-only">{t("required")}</span>
            </label>
            <input
              id="order-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("phonePlaceholder")}
              value={phone}
              disabled={busy}
              required
              aria-required
              aria-invalid={fieldErrors.phone ? true : undefined}
              aria-describedby={
                fieldErrors.phone ? "order-phone-error" : undefined
              }
              onChange={(e) => setPhone(e.target.value)}
              className={`h-11 ${fieldControlClasses}`}
            />
            {fieldErrors.phone && (
              <p id="order-phone-error" role="alert" className={ERROR_CLASSES}>
                {fieldErrors.phone}
              </p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="order-email" className={LABEL_CLASSES}>
              {t("emailLabel")}{" "}
              <span className={OPTIONAL_CLASSES}>{t("optional")}</span>
            </label>
            <input
              id="order-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              disabled={busy}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={
                fieldErrors.email ? "order-email-error" : undefined
              }
              onChange={(e) => setEmail(e.target.value)}
              className={`h-11 ${fieldControlClasses}`}
            />
            {fieldErrors.email && (
              <p id="order-email-error" role="alert" className={ERROR_CLASSES}>
                {fieldErrors.email}
              </p>
            )}
          </div>
        </div>

        {serverError && (
          <p role="alert" className="font-body text-14 text-alert">
            {serverError}
          </p>
        )}

        <div>
          {/* WhatsApp green — the site's one sanctioned green, ONLY on this
              final Place Order action (Part 0). */}
          <Button
            type="submit"
            variant="whatsapp"
            size="lg"
            className="w-full"
            disabled={busy}
          >
            <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
            {phase === "uploading"
              ? progressText || t("uploading")
              : phase === "submitting"
                ? t("preparing")
                : outOfStock && oosCopy
                  ? oosCopy.cta
                  : t("placeOrder")}
          </Button>
          <p className="mt-4 font-body text-12 leading-relaxed text-graphite">
            {t("noPayment")}
          </p>
          {product.isDemo ? (
            <p className="u-num mt-2 text-12 text-graphite">
              {tProduct("demoOrderNote")}
            </p>
          ) : null}
        </div>
      </div>

      {/* ——— the live summary — sticky right column on desktop (§4.6) ——— */}
      <aside className="lg:col-span-4 lg:col-start-9 lg:sticky lg:top-24 lg:self-start">
        <WhatsAppSummaryCard
          title={t("summaryTitle")}
          toggleLabel={t("previewMessage")}
          messageLabel={t("whatsappMessageLabel")}
          rows={summaryRows}
          message={previewMessage}
          note={outOfStock && oosCopy ? oosCopy.summaryNote : undefined}
        />
        <p className="mt-3 font-body text-12 leading-relaxed text-graphite">
          {t("updatesHint")}
        </p>
      </aside>
    </form>
  );
}

/* ————————————————— per-type field control ————————————————— */

function OrderField({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: OrderPanelProduct["customFields"][number];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
}) {
  const t = useTranslations("Product.order");

  // FILE fields render their note next to the shared uploader instead.
  if (field.type === "FILE") return null;

  const inputId = `order-field-${field.id}`;
  const errorId = `${inputId}-error`;
  const shared = {
    label: field.label,
    options: field.options,
    value,
    onChange,
    disabled,
    required: field.required,
    requiredLabel: t("required"),
    hint: field.helpText,
    error,
    errorId,
  };

  /* §9.3 — colour swatches. */
  if (field.type === "SWATCH") {
    return <ColourSwatches {...shared} colorFor={swatchColor} />;
  }

  /* §9.3 — size cards with a scale silhouette. */
  if (field.type === "SIZE") {
    return <SizeCards {...shared} />;
  }

  /* §9.3 — material chips, until the list is long enough that a wall of
     chips is worse than a menu. */
  if (field.type === "SELECT" && field.options.length <= CHIP_CEILING) {
    return <MaterialChips {...shared} />;
  }

  /* §9.3 — engraving, with the live typography preview. */
  if (field.type === "TEXT") {
    return (
      <EngravingField
        id={inputId}
        label={field.label}
        value={value}
        onChange={onChange}
        placeholder={
          field.helpText || t("yourLabel", { label: field.label.toLowerCase() })
        }
        previewLabel={t("engravingPreview")}
        previewPlaceholder={t("engravingPreviewEmpty")}
        disabled={disabled}
        required={field.required}
        requiredLabel={t("required")}
        error={error}
        errorId={errorId}
      />
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className={LABEL_CLASSES}>
        {field.label}
        {field.required && (
          <>
            <span aria-hidden className="text-alert">
              *
            </span>
            <span className="sr-only">{t("required")}</span>
          </>
        )}
      </label>

      {field.type === "SELECT" && (
        <Select
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={inputId}
            className={cn(
              "w-full rounded-input border-hairline bg-sand px-3 font-body text-ink outline-none",
              "duration-(--dur-fast) ease-(--ease-settle) hover:border-ink/30",
              "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3",
              "data-[placeholder]:text-graphite aria-invalid:border-alert [&_svg]:text-graphite",
            )}
            aria-required={field.required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          >
            <SelectValue
              placeholder={t("choose", { label: field.label.toLowerCase() })}
            />
          </SelectTrigger>
          <SelectContent className="rounded-card border-hairline bg-mineral text-ink">
            {field.options.map((option) => (
              <SelectItem
                key={option}
                value={option}
                className="rounded-input font-body text-ink focus:bg-sand focus:text-sapphire [&_svg]:text-sapphire"
              >
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "NUMBER" && (
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={field.helpText || "0"}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 ${fieldControlClasses}`}
        />
      )}

      {field.helpText && field.type !== "NUMBER" && (
        <p className={HINT_CLASSES}>{field.helpText}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className={ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}
