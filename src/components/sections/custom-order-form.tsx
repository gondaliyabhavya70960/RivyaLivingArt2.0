"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useFormToken } from "@/hooks/use-form-token";
import { asWaLocale } from "@/i18n/config";
import { trackEvent as track, trackLead } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
import { ChevronUp, MessageCircle } from "lucide-react";

import { submitCustomOrder } from "@/actions/order";
import type { FormOptionSet } from "@/lib/form-options";
import { Button } from "@/components/storefront/button";
import { toast } from "@/components/storefront/toast";
import {
  fieldControlClasses,
  fieldLabelClasses,
  PillField,
  SelectField,
} from "@/components/storefront/form-field";
import { ReferenceImageUploader } from "@/components/storefront/reference-image-uploader";
import {
  WhatsAppSummaryCard,
  type SummaryRow,
} from "@/components/storefront/whatsapp-summary-card";
import { CharCounter } from "@/components/ui/char-counter";
import { cn } from "@/lib/utils";
import { uploadReferenceImages } from "@/lib/upload-client";
import {
  bilingualLabel,
  buildOrderMessage,
  localizedOrderLabels,
} from "@/lib/whatsapp";

/* ─────────────────────────────────────────────────────────────────────────
 * The four dropdowns now arrive as a prop, resolved for the visitor's locale
 * from `FormOption` rows with the bundled lists as the fallback
 * (`src/lib/form-options.ts`).
 *
 * The submitted payload is unchanged, which is the point. Part 1.1 puts the
 * custom-order form's FIELDS on the do-not-change list, and each choice still
 * submits its canonical `value` — the same English string the inline arrays
 * used to submit — so `submitCustomOrder`, the Inquiry row and the WhatsApp
 * message all carry exactly what they carried before. Only the LABEL the
 * customer reads is translated, and only the SOURCE of the list moved.
 * ───────────────────────────────────────────────────────────────────────── */

const PHONE_PATTERN = /^[0-9+\-() ]{8,17}$/;

/** The four groups, in order. Ids are the scroll-spy anchors. */
const GROUPS = [
  { id: "commission-idea", key: "idea" },
  { id: "commission-details", key: "details" },
  { id: "commission-references", key: "references" },
  { id: "commission-contact", key: "contact" },
] as const;

/** Which fields each group owns — used by the mobile `Continue` gate. */
const GROUP_FIELDS: Record<number, readonly string[]> = {
  0: ["designIdea"],
  1: [],
  2: ["notes"],
  3: ["name", "phone", "email"],
};

/** Field name → the id suffix its control carries, for the summary links. */
const FIELD_ANCHORS: Record<string, string> = {
  designIdea: "idea",
  notes: "notes",
  name: "name",
  phone: "phone",
  email: "email",
};

/** Summary rows stay one line; the full text lives in the message preview. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

type Phase = "idle" | "uploading" | "submitting";

/** Mono counter re-scoped to the v3 inks without touching the shared component. */
const COUNTER_CLASSES =
  "font-mono text-micro [--destructive:var(--alert)] [--muted-foreground:var(--graphite)]";

/**
 * The guided commission brief — REDESIGN.md Part 10.
 *
 * The old form was one long column of eleven controls with a live summary
 * bolted to the bottom. Every field survives — Part 1.1 forbids removing one,
 * and the audit's verdict was that the form is *comprehensive*, not that it is
 * wrong. What changed is the experience:
 *
 * - **Four groups behind one mono rail** (§10.3) — `01 / 04`, docked left so
 *   it rhymes with the cure line. Desktop shows all four with the rail
 *   scroll-spying; below `lg` one group shows at a time behind `Back` /
 *   `Continue` and a `Step 2 of 4` label.
 * - **Validation on blur, then on change once errored** (§10.3). Blur only
 *   judges a field the visitor has actually touched or filled — tabbing
 *   through a form should not light it up red.
 * - **The submit states its blocker while disabled** (§3.6: never a silently
 *   dead button). `reason` renders it as a mono line and wires it to the
 *   control with `aria-describedby`.
 * - **The live summary becomes `WhatsAppSummaryCard`** (§10.4) — sticky right
 *   column on desktop, an expandable bottom sheet on mobile.
 * - **`Continue on WhatsApp`** (§10.5), with the promise underneath that the
 *   details are prepared automatically.
 *
 * Untouched below the surface: the state shape, the spam signals, the upload
 * call, the payload sent to `submitCustomOrder`, the Inquiry it writes, the
 * message `wa.me` receives, and the `/whatsapp-order` landing that catches a
 * blocked popup.
 *
 * One structural note. All four groups live in one `<form>` at every
 * breakpoint; the mobile stepper hides the inactive ones with `display: none`
 * rather than unmounting them. The values are React state, not `FormData`, so
 * nothing is lost either way — but a hidden field cannot be focused, which is
 * exactly what a step gate should guarantee, and the summary keeps updating
 * from every group no matter which one is on screen.
 */
export function CustomOrderForm({ options }: { options: FormOptionSet }) {
  const t = useTranslations("CustomOrder.form");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // WhatsApp message language — preview + submit both follow the UI locale.
  const locale = useLocale();
  const tWa = useTranslations("WhatsApp");

  /**
   * Per-field rules, shared by the submit-time validate(), the blur check and
   * the on-change refresh that clears a stale error once its fix lands
   * (UIUX-P28). Defined in-component so messages resolve from the active
   * locale. The rules themselves are unchanged — they still mirror the server
   * action's zod schema, which stays authoritative.
   */
  function validateField(field: string, value: string): string | undefined {
    const trimmed = value.trim();
    switch (field) {
      case "designIdea":
        if (trimmed.length < 10) return t("validationDesignIdeaShort");
        if (trimmed.length > 2000) return t("validationDesignIdeaLong");
        return undefined;
      case "name":
        if (trimmed.length < 2) return t("validationNameRequired");
        return undefined;
      case "phone":
        if (!PHONE_PATTERN.test(trimmed)) return t("validationPhoneInvalid");
        return undefined;
      case "email":
        if (trimmed && !/^\S+@\S+\.\S+$/.test(trimmed))
          return t("validationEmailInvalid");
        return undefined;
      case "notes":
        if (trimmed.length > 1500) return t("validationNotesLong");
        return undefined;
      default:
        return undefined;
    }
  }

  const [designIdea, setDesignIdea] = useState("");
  const [material, setMaterial] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [occasion, setOccasion] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progressText, setProgressText] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

  /* Presentation-only state: the mobile step, the desktop scroll-spy index,
     the mobile summary sheet, and whether a submit has already failed. */
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  // Spam-check inputs — the effect only writes refs, never state.
  const getFormToken = useFormToken();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  /** Fields the visitor has actually typed in — gates the blur check. */
  const dirtyRef = useRef<Set<string>>(new Set());
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);

  // Fire once on first interaction so form start→submit drop-off is measurable.
  function handleFormStart() {
    if (startedRef.current) return;
    startedRef.current = true;
    track("custom_order_started");
  }

  const combinedNotes = [designIdea.trim(), notes.trim()]
    .filter(Boolean)
    .join("\n");

  // Live summary — buildOrderMessage is a pure lib fn, safe on the client.
  // Same localized labels as the server rebuild, so preview === sent message
  // — including the bilingual Material/Occasion selection rows (I18N-902).
  const selLabel = (key: "material" | "occasion", english: string): string =>
    locale === "en" ? english : bilingualLabel(String(tWa.raw(key)), english);
  const previewMessage = buildOrderMessage(
    {
      productTitle: "Custom commission",
      selections: [
        ...(material
          ? [{ label: selLabel("material", "Material"), value: material }]
          : []),
        ...(occasion
          ? [{ label: selLabel("occasion", "Occasion"), value: occasion }]
          : []),
      ],
      referenceImageUrls: files.map((f) => f.name),
      notes: combinedNotes || undefined,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      },
      budgetRange: budget || undefined,
      timeline: timeline || undefined,
    },
    localizedOrderLabels((key) => String(tWa.raw(key)), locale),
  );

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const values = { designIdea, name, phone, email, notes };
    for (const [field, value] of Object.entries(values)) {
      const error = validateField(field, value);
      if (error) errors[field] = error;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Re-check an already-errored field as it's edited so a corrected value
  // sheds its stale red error immediately (UIUX-P28). Fields without an
  // error stay silent until blur — no premature nagging mid-typing.
  function refreshFieldError(field: string, value: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const error = validateField(field, value);
      if (error === prev[field]) return prev;
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  /**
   * §10.3's blur pass. A field is judged when it holds something or when the
   * visitor has typed in it and cleared it again — never when they merely
   * tabbed past an untouched control, which would turn a keyboard pass down
   * the form into a wall of red.
   */
  function handleBlur(field: string, value: string) {
    if (!value.trim() && !dirtyRef.current.has(field)) return;
    const error = validateField(field, value);
    setFieldErrors((prev) => {
      if (prev[field] === error) return prev;
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function handleChange(
    field: string,
    value: string,
    setter: (value: string) => void,
  ) {
    dirtyRef.current.add(field);
    setter(value);
    refreshFieldError(field, value);
  }

  /* ————— desktop scroll-spy for the rail (§10.3) ————— */
  useEffect(() => {
    const nodes = GROUPS.map((group) =>
      document.getElementById(group.id),
    ).filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    // The observer callback is async by definition, so no state is written
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (!visible) return;
        const index = nodes.indexOf(visible.target as HTMLElement);
        if (index >= 0) setActive(index);
      },
      { rootMargin: "-30% 0px -55% 0px" },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, []);

  /* Esc closes the mobile summary sheet and focus returns to its trigger
     (Part 17: "Esc closes every layer and focus returns to the trigger"). */
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetOpen(false);
        sheetTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function focusFirstInvalid() {
    // rAF waits for the aria-invalid attributes to flush after the state
    // update; the global scroll-margin-top clears the fixed header.
    requestAnimationFrame(() => {
      const invalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      invalid?.focus({ preventScroll: true });
      invalid?.scrollIntoView({ block: "center" });
    });
  }

  /** Mobile `Continue`: judge this group, then move on. */
  function goToStep(next: number) {
    if (next > step) {
      const owned = GROUP_FIELDS[step] ?? [];
      const values: Record<string, string> = {
        designIdea,
        notes,
        name,
        phone,
        email,
      };
      const errors: Record<string, string> = {};
      for (const field of owned) {
        const error = validateField(field, values[field] ?? "");
        if (error) errors[field] = error;
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...errors }));
        focusFirstInvalid();
        return;
      }
    }
    setStep(next);
    document
      .getElementById(GROUPS[next].id)
      ?.scrollIntoView({ block: "start", behavior: "auto" });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) {
      // Part 17: the error summary takes focus on a failed submit, so the
      // failure is announced instead of nothing appearing to happen.
      setSubmitFailed(true);
      requestAnimationFrame(() => {
        summaryRef.current?.focus({ preventScroll: true });
        summaryRef.current?.scrollIntoView({ block: "center" });
      });
      return;
    }
    setSubmitFailed(false);

    try {
      let referenceImageUrls: string[] = [];
      if (files.length > 0) {
        setPhase("uploading");
        setUploadedCount(0);
        setProgressText(
          t("submitUploadingProgress", { done: 0, total: files.length }),
        );
        const uploaded = await uploadReferenceImages(files, (done, total) => {
          setUploadedCount(done);
          setProgressText(t("submitUploadingProgress", { done, total }));
        });
        referenceImageUrls = uploaded.map((u) => u.url);
      }

      setPhase("submitting");
      setProgressText("");
      track("custom_order_submit_attempt");
      const result = await submitCustomOrder({
        designIdea: designIdea.trim(),
        materials: material || undefined,
        occasion: occasion || undefined,
        budgetRange: budget || undefined,
        timeline: timeline || undefined,
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
        trackLead("custom_order_submitted");
        toast.success(t("submitPreparing"));
        // Open WhatsApp AND land on the fallback page — popup blockers
        // can't strand the customer.
        window.open(result.data.whatsappUrl, "_blank", "noopener");
        router.push(
          `/whatsapp-order?i=${result.data.inquiryId}&t=${result.data.claimToken}`,
        );
      } else {
        // Attempt and success were both tracked; failure was not, so a
        // rejected commission looked identical to an abandoned one.
        track("custom_order_submit_failed", { reason: "rejected" });
        setServerError(result.error);
        setPhase("idle");
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
    } catch (error) {
      track("custom_order_submit_failed", { reason: "threw" });
      setServerError(
        error instanceof Error ? error.message : t("errorGeneric"),
      );
      setPhase("idle");
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  const busy = phase !== "idle";

  /* §3.6 — the submit names the one thing standing in its way. The order
     matches the reading order of the form, so the reason always points at
     the earliest gap rather than the last one typed. */
  const blocker =
    designIdea.trim().length < 10
      ? t("blockerIdea")
      : name.trim().length < 2
        ? t("blockerName")
        : !PHONE_PATTERN.test(phone.trim())
          ? t("blockerPhone")
          : null;

  const errorList = Object.entries(fieldErrors);
  const showSummaryOfErrors = submitFailed && errorList.length > 0;

  /* §4.6 — every row renders even when empty, so the card doubles as a
     checklist of what the message is still missing. */
  const summaryRows: SummaryRow[] = [
    { label: t("rows.idea"), value: truncate(designIdea.trim(), 44) },
    { label: t("rows.material"), value: material },
    { label: t("rows.occasion"), value: occasion },
    { label: t("rows.budget"), value: budget },
    { label: t("rows.timeline"), value: timeline },
    {
      label: t("rows.references"),
      value: files.length
        ? t("rows.referencesValue", { count: files.length })
        : "",
    },
    { label: t("rows.name"), value: name.trim() },
    { label: t("rows.phone"), value: phone.trim() },
    { label: t("rows.email"), value: email.trim() },
  ];

  const summaryCard = (defaultOpen: boolean, className?: string) => (
    <WhatsAppSummaryCard
      title={t("summaryTitle")}
      toggleLabel={t("summaryToggle")}
      rows={summaryRows}
      message={previewMessage}
      messageLabel={t("summaryMessageLabel")}
      defaultOpen={defaultOpen}
      className={className}
    />
  );

  const groupHeading = (index: number) => (
    <div className="flex items-baseline gap-4">
      <span aria-hidden className="u-micro text-champagne-ink">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="font-display text-h3 leading-h3 tracking-display text-ink">
        {t(`rail.${GROUPS[index].key}`)}
      </h3>
    </div>
  );

  /** Mobile only: the group is hidden unless it is the active step. */
  const groupVisibility = (index: number) =>
    cn("flex scroll-mt-28 flex-col gap-8", index !== step && "hidden lg:flex");

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
      {/* ————— the rail (§10.3) — desktop only, scroll-spying ————— */}
      <nav
        aria-label={t("progressLabel")}
        className="hidden lg:col-span-2 lg:block"
      >
        <div className="sticky top-28 flex flex-col gap-6">
          <p className="u-num text-14 text-graphite">
            {`${String(active + 1).padStart(2, "0")} / ${String(
              GROUPS.length,
            ).padStart(2, "0")}`}
          </p>
          <ol className="flex flex-col">
            {GROUPS.map((group, index) => (
              <li key={group.id} className="relative">
                <a
                  href={`#${group.id}`}
                  aria-current={index === active ? "step" : undefined}
                  className={cn(
                    "u-micro flex min-h-11 items-center gap-3 border-s ps-4 transition-colors duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
                    index === active
                      ? "border-sapphire text-ink"
                      : "border-hairline hover:text-ink",
                  )}
                >
                  <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                  <span>{t(`rail.${group.key}`)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* ————— the form ————— */}
      <form
        ref={formRef}
        onSubmit={(e) => void handleSubmit(e)}
        onFocusCapture={handleFormStart}
        noValidate
        className="flex flex-col gap-14 lg:col-span-6"
      >
        {/* Honeypot — invisible to humans, irresistible to bots. */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="custom-website">Website</label>
          <input
            id="custom-website"
            ref={honeypotRef}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Mobile step counter (§10.3: "a Step 2 of 4 label"). */}
        <p className="u-micro lg:hidden" aria-live="polite">
          {t("stepOf", { current: step + 1, total: GROUPS.length })}
        </p>

        {/* ═══ 01 · your idea ═══ */}
        <fieldset id={GROUPS[0].id} className={groupVisibility(0)}>
          <legend className="sr-only">{t("rail.idea")}</legend>
          {groupHeading(0)}
          <div className="grid gap-2">
            <label htmlFor="custom-idea" className={fieldLabelClasses}>
              {t("designIdeaLabel")}{" "}
              <span aria-hidden className="text-alert">
                *
              </span>
              <span className="sr-only"> required</span>
            </label>
            <textarea
              id="custom-idea"
              rows={6}
              maxLength={2000}
              placeholder={t("designIdeaPlaceholder")}
              value={designIdea}
              disabled={busy}
              required
              aria-required
              aria-invalid={fieldErrors.designIdea ? true : undefined}
              aria-describedby={
                fieldErrors.designIdea
                  ? "custom-idea-hint custom-idea-error"
                  : "custom-idea-hint"
              }
              onChange={(e) =>
                handleChange("designIdea", e.target.value, setDesignIdea)
              }
              onBlur={(e) => handleBlur("designIdea", e.target.value)}
              className={cn("resize-y py-3", fieldControlClasses)}
            />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <p id="custom-idea-hint" className="u-micro">
                {t("designIdeaHint")}
              </p>
              <CharCounter
                length={designIdea.length}
                max={2000}
                className={COUNTER_CLASSES}
              />
            </div>
            {fieldErrors.designIdea && (
              <p
                id="custom-idea-error"
                role="alert"
                className="font-body text-14 text-alert"
              >
                {fieldErrors.designIdea}
              </p>
            )}
          </div>
        </fieldset>

        {/* ═══ 02 · details ═══ */}
        <fieldset id={GROUPS[1].id} className={groupVisibility(1)}>
          <legend className="sr-only">{t("rail.details")}</legend>
          {groupHeading(1)}
          <div className="grid gap-8 sm:grid-cols-2">
            <SelectField
              id="custom-material"
              name="material"
              label={t("materialLabel")}
              optionalLabel={t("optional")}
              placeholder={t("materialPlaceholder")}
              options={options.MATERIAL}
              value={material}
              disabled={busy}
              onChange={(e) => setMaterial(e.target.value)}
            />
            {/* Occasion, budget and timeline are pills, not selects (plan
                §2.4 · audit §3.5). All three are short closed lists whose
                whole point is comparison — a budget band is chosen by
                looking at the bands — and an OS picker sheet hides the form
                while you do it. Material stays a select: the spec wants
                macro thumbnails there, and the four material macros do not
                map onto the five owner-editable options without inventing
                the pairing.

                Each one keeps the placeholder's job as a first pill: these
                fields are optional, and a radiogroup cannot otherwise be
                un-answered. */}
            <PillField
              id="custom-occasion"
              name="occasion"
              label={t("occasionLabel")}
              optionalLabel={t("optional")}
              emptyLabel={t("occasionNone")}
              options={options.OCCASION}
              value={occasion}
              disabled={busy}
              onChange={setOccasion}
              className="sm:col-span-2"
            />
            <PillField
              id="custom-budget"
              name="budget"
              label={t("budgetLabel")}
              optionalLabel={t("optional")}
              emptyLabel={t("noPreference")}
              options={options.BUDGET}
              value={budget}
              disabled={busy}
              hint={t("budgetHint")}
              onChange={setBudget}
              className="sm:col-span-2"
            />
            <PillField
              id="custom-timeline"
              name="timeline"
              label={t("timelineLabel")}
              optionalLabel={t("optional")}
              emptyLabel={t("noPreference")}
              options={options.TIMELINE}
              value={timeline}
              disabled={busy}
              hint={t("timelineHint")}
              onChange={setTimeline}
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        {/* ═══ 03 · references ═══ */}
        <fieldset id={GROUPS[2].id} className={groupVisibility(2)}>
          <legend className="sr-only">{t("rail.references")}</legend>
          {groupHeading(2)}
          <div className="grid gap-2">
            <span id="custom-reference-label" className={fieldLabelClasses}>
              {t("referenceLabel")}{" "}
              <span className="font-normal text-graphite">{t("optional")}</span>
            </span>
            <ReferenceImageUploader
              idPrefix="custom-order"
              labelledBy="custom-reference-label"
              onFilesChange={setFiles}
              disabled={busy}
              uploading={phase === "uploading"}
              uploadedCount={uploadedCount}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="custom-notes" className={fieldLabelClasses}>
              {t("notesLabel")}{" "}
              <span className="font-normal text-graphite">{t("optional")}</span>
            </label>
            <textarea
              id="custom-notes"
              rows={4}
              maxLength={1500}
              placeholder={t("notesPlaceholder")}
              value={notes}
              disabled={busy}
              aria-invalid={fieldErrors.notes ? true : undefined}
              aria-describedby={
                fieldErrors.notes ? "custom-notes-error" : undefined
              }
              onChange={(e) => handleChange("notes", e.target.value, setNotes)}
              onBlur={(e) => handleBlur("notes", e.target.value)}
              className={cn("resize-y py-3", fieldControlClasses)}
            />
            <CharCounter
              length={notes.length}
              max={1500}
              className={COUNTER_CLASSES}
            />
            {fieldErrors.notes && (
              <p
                id="custom-notes-error"
                role="alert"
                className="font-body text-14 text-alert"
              >
                {fieldErrors.notes}
              </p>
            )}
          </div>
        </fieldset>

        {/* ═══ 04 · your details ═══ */}
        <fieldset id={GROUPS[3].id} className={groupVisibility(3)}>
          <legend className="sr-only">{t("rail.contact")}</legend>
          {groupHeading(3)}
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="custom-name" className={fieldLabelClasses}>
                {t("nameLabel")}{" "}
                <span aria-hidden className="text-alert">
                  *
                </span>
                <span className="sr-only"> required</span>
              </label>
              <input
                id="custom-name"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                value={name}
                disabled={busy}
                required
                aria-required
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={
                  fieldErrors.name ? "custom-name-error" : undefined
                }
                onChange={(e) => handleChange("name", e.target.value, setName)}
                onBlur={(e) => handleBlur("name", e.target.value)}
                className={cn("h-14", fieldControlClasses)}
              />
              {fieldErrors.name && (
                <p
                  id="custom-name-error"
                  role="alert"
                  className="font-body text-14 text-alert"
                >
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <label htmlFor="custom-phone" className={fieldLabelClasses}>
                {t("phoneLabel")}{" "}
                <span aria-hidden className="text-alert">
                  *
                </span>
                <span className="sr-only"> required</span>
              </label>
              <input
                id="custom-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phone}
                disabled={busy}
                required
                aria-required
                aria-invalid={fieldErrors.phone ? true : undefined}
                aria-describedby={
                  fieldErrors.phone
                    ? "custom-phone-hint custom-phone-error"
                    : "custom-phone-hint"
                }
                onChange={(e) =>
                  handleChange("phone", e.target.value, setPhone)
                }
                onBlur={(e) => handleBlur("phone", e.target.value)}
                className={cn("h-14", fieldControlClasses)}
              />
              <p id="custom-phone-hint" className="u-micro">
                {t("phoneHint")}
              </p>
              {fieldErrors.phone && (
                <p
                  id="custom-phone-error"
                  role="alert"
                  className="font-body text-14 text-alert"
                >
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="custom-email" className={fieldLabelClasses}>
                {t("emailLabel")}{" "}
                <span className="font-normal text-graphite">
                  {t("optional")}
                </span>
              </label>
              <input
                id="custom-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={busy}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={
                  fieldErrors.email ? "custom-email-error" : undefined
                }
                onChange={(e) =>
                  handleChange("email", e.target.value, setEmail)
                }
                onBlur={(e) => handleBlur("email", e.target.value)}
                className={cn("h-14", fieldControlClasses)}
              />
              {fieldErrors.email && (
                <p
                  id="custom-email-error"
                  role="alert"
                  className="font-body text-14 text-alert"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* ————— the error summary (Part 17) —————
            Focused on a failed submit, and the only place a server error is
            reported. `tabIndex={-1}` makes it programmatically focusable
            without adding a tab stop. */}
        <div
          ref={summaryRef}
          tabIndex={-1}
          role={showSummaryOfErrors || serverError ? "alert" : undefined}
          className="empty:hidden"
        >
          {serverError ? (
            <p className="border-s-2 border-alert ps-4 font-body text-16 text-alert">
              {serverError}
            </p>
          ) : showSummaryOfErrors ? (
            <div className="border-s-2 border-alert ps-4">
              <p className="font-body text-16 font-medium text-alert">
                {t("errorSummaryTitle", { count: errorList.length })}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {errorList.map(([field, message]) => (
                  <li key={field}>
                    <a
                      href={`#custom-${FIELD_ANCHORS[field] ?? field}`}
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

        {/* ————— mobile step controls ————— */}
        <div className="flex items-center gap-4 lg:hidden">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => goToStep(step - 1)}
            >
              {t("back")}
            </Button>
          ) : null}
          {step < GROUPS.length - 1 ? (
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => goToStep(step + 1)}
            >
              {t("continue")}
            </Button>
          ) : null}
        </div>

        {/* ————— the CTA (§10.5) —————
            Rendered in flow, never in the fixed bar: a submit pinned to the
            bottom edge is the control iOS hides under the keyboard
            (Part 13). On mobile it belongs to the last step only. */}
        <div
          className={cn(
            "flex flex-col gap-3",
            step !== GROUPS.length - 1 && "hidden lg:flex",
          )}
        >
          <Button
            type="submit"
            variant="whatsapp"
            size="lg"
            disabled={busy || blocker !== null}
            loading={busy}
            loadingLabel={
              phase === "uploading"
                ? progressText || t("submitUploading")
                : t("submitPreparing")
            }
            reason={blocker ?? undefined}
          >
            <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
            {t("ctaContinue")}
          </Button>
          <p className="font-body text-14 leading-relaxed text-graphite">
            {t("ctaNote")}
          </p>
          {/* The disabled button drops from the tab order while busy — mirror
              the phase for screen readers in a persistent live region. */}
          <p role="status" aria-live="polite" className="sr-only">
            {phase === "uploading"
              ? progressText || t("submitUploading")
              : phase === "submitting"
                ? t("submitPreparing")
                : ""}
          </p>
          <p className="font-body text-14 leading-relaxed text-graphite">
            {t("disclaimer")}
          </p>
        </div>

        {/* Clearance for the fixed mobile summary bar. */}
        <div aria-hidden className="h-14 lg:hidden" />
      </form>

      {/* ————— the live summary (§10.4) — sticky right column ————— */}
      <aside className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-28 flex flex-col gap-3">
          {summaryCard(false)}
          <p className="font-body text-14 leading-relaxed text-graphite">
            {t("summaryNote")}
          </p>
        </div>
      </aside>

      {/* ————— …and the same card as a bottom sheet on mobile ————— */}
      <div className="lg:hidden">
        {sheetOpen ? (
          <button
            type="button"
            aria-label={t("summaryClose")}
            onClick={() => {
              setSheetOpen(false);
              sheetTriggerRef.current?.focus();
            }}
            className="fixed inset-0 z-40 bg-obsidian/50"
          />
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-mineral">
          <button
            ref={sheetTriggerRef}
            type="button"
            aria-expanded={sheetOpen}
            aria-controls="commission-summary-sheet"
            onClick={() => setSheetOpen((open) => !open)}
            className="u-micro flex min-h-14 w-full items-center justify-between gap-3 px-5 text-start text-ink outline-none"
          >
            {/* Not "Preview your message" — the card inside carries that
                disclosure, and two identical triggers in one column read as a
                bug. The sheet opens the summary; the card opens the message. */}
            {t("summaryTitle")}
            <ChevronUp
              aria-hidden
              strokeWidth={1.5}
              className={cn(
                "size-4 shrink-0 transition-transform duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
                sheetOpen && "rotate-180",
              )}
            />
          </button>
          <div
            id="commission-summary-sheet"
            hidden={!sheetOpen}
            className="max-h-[70svh] overflow-y-auto border-t border-hairline"
          >
            {summaryCard(false, "rounded-none border-0")}
          </div>
        </div>
      </div>
    </div>
  );
}
