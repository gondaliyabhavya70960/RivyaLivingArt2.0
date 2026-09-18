"use client";

import { useId, type ReactNode } from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import { fieldControlClasses, pillClasses } from "./form-field";

/**
 * Customization controls — REDESIGN.md §9.3.
 *
 * > "Functionality unchanged; presentation changes from generic dropdowns to:
 * > colour **swatches** (circular, champagne ring when selected) · material
 * > **chips** · size **cards** with a small silhouette indicating scale ·
 * > engraving input with a **live typography preview** · image upload as the
 * > visual Upload component."
 *
 * Every control here is a presentation shell over a value the order panel
 * owns. None of them knows what a field is, validates anything, or touches
 * the submitted payload — they take `value` / `onChange` and give back the
 * same strings the old `<select>`s gave back. That is the whole point: §9.3
 * is a presentation change, and the Inquiry that reaches WhatsApp must be
 * byte-identical to the one the dropdowns produced.
 *
 * Three rules the spec states once and this file obeys everywhere:
 *
 * - **State is never colour alone** (Part 17). Selection is a champagne ring
 *   *plus* a check mark *plus* a weight change, so a swatch of "Ivory" reads
 *   as chosen without relying on the ring's hue.
 * - **44px, always.** Every target clears the Part 17 floor even where the
 *   painted disc is 28px.
 * - **Champagne is a ring, never a fill** (Part 3.1). The one champagne fill
 *   in the system belongs to the `premium` button at hover.
 *
 * The four v2.0 exports (`OptionPicker`, `PersonalizationText`,
 * `OccasionSelect`, `QuantityStepper`) stay: `/design-lab` renders them, and
 * a radio-backed pill group is still the right control for a short, generic
 * option list.
 */

/* Part 16: 2px sapphire ring at 3px offset. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-background";

const LABEL = "font-body text-14 font-medium text-ink";

/** Shared label + optional required mark + hint/error slot. */
function ControlShell({
  label,
  required,
  requiredLabel,
  hint,
  error,
  errorId,
  labelId,
  children,
}: {
  label: string;
  required?: boolean;
  /** Translated "(required)" for assistive tech — the `*` is decorative. */
  requiredLabel?: string;
  hint?: string | null;
  error?: string;
  errorId?: string;
  labelId?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <span id={labelId} className={LABEL}>
        {label}
        {required ? (
          <>
            <span aria-hidden className="text-alert">
              {" "}
              *
            </span>
            {requiredLabel ? (
              <span className="sr-only"> {requiredLabel}</span>
            ) : null}
          </>
        ) : null}
      </span>
      {children}
      {hint ? <p className="font-body text-12 text-graphite">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="font-body text-12 text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type ChoiceControlProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  requiredLabel?: string;
  hint?: string | null;
  error?: string;
  errorId?: string;
};

/* ————————————————— colour swatches (SWATCH) ————————————————— */

/**
 * §9.3's circular swatches. The disc carries the colour; the name carries the
 * meaning, and both are always visible — a grid of unlabelled circles is
 * unusable to anyone who cannot separate two greens.
 *
 * `colorFor` is injected rather than resolved here: the colour vocabulary is
 * product data (the owner's option strings), and a token-only component has
 * no business holding a table of literal hexes.
 */
export function ColourSwatches({
  label,
  options,
  value,
  onChange,
  colorFor,
  disabled,
  required,
  requiredLabel,
  hint,
  error,
  errorId,
}: ChoiceControlProps & { colorFor: (option: string) => string }) {
  const labelId = useId();

  return (
    <ControlShell
      label={label}
      required={required}
      requiredLabel={requiredLabel}
      hint={hint}
      error={error}
      errorId={errorId}
      labelId={labelId}
    >
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        data-error={error ? "true" : undefined}
        tabIndex={error ? -1 : undefined}
        className="flex flex-wrap gap-x-5 gap-y-4"
      >
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(selected ? "" : option)}
              className={cn(
                "group/swatch flex w-16 flex-col items-center gap-2 rounded-input py-1",
                "disabled:pointer-events-none disabled:opacity-40",
                FOCUS_RING,
              )}
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full transition-shadow duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                  selected
                    ? "ring-2 ring-champagne ring-offset-2 ring-offset-background"
                    : "ring-1 ring-hairline group-hover/swatch:ring-ink/30",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: colorFor(option) }}
                >
                  {selected ? (
                    <Check
                      strokeWidth={2}
                      className="size-4 text-mineral mix-blend-difference"
                    />
                  ) : null}
                </span>
              </span>
              <span
                className={cn(
                  "w-full text-center font-body text-12 leading-tight break-words",
                  selected ? "font-medium text-ink" : "text-graphite",
                )}
              >
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </ControlShell>
  );
}

/* ————————————————— material chips (SELECT) ————————————————— */

/** §9.3's material chips — the replacement for a generic dropdown. */
export function MaterialChips({
  label,
  options,
  value,
  onChange,
  disabled,
  required,
  requiredLabel,
  hint,
  error,
  errorId,
}: ChoiceControlProps) {
  const labelId = useId();

  return (
    <ControlShell
      label={label}
      required={required}
      requiredLabel={requiredLabel}
      hint={hint}
      error={error}
      errorId={errorId}
      labelId={labelId}
    >
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        data-error={error ? "true" : undefined}
        tabIndex={error ? -1 : undefined}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(selected ? "" : option)}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full border px-4 font-body text-14",
                "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                "disabled:pointer-events-none disabled:opacity-40",
                selected
                  ? "border-champagne bg-sand font-medium text-ink"
                  : "border-hairline text-ink hover:bg-sand",
                FOCUS_RING,
              )}
            >
              {selected ? (
                <Check
                  aria-hidden
                  strokeWidth={1.5}
                  className="-ms-1 size-4 text-champagne-ink"
                />
              ) : null}
              {option}
            </button>
          );
        })}
      </div>
    </ControlShell>
  );
}

/* ————————————————— size cards (SIZE) ————————————————— */

/**
 * §9.3's size cards, "with a small silhouette indicating scale". The
 * silhouette is drawn from the option's POSITION in the owner's own list —
 * options are authored small → large — so it communicates relative scale
 * without inventing a dimension the studio never stated.
 */
export function SizeCards({
  label,
  options,
  value,
  onChange,
  disabled,
  required,
  requiredLabel,
  hint,
  error,
  errorId,
}: ChoiceControlProps) {
  const labelId = useId();
  const steps = Math.max(options.length, 1);

  return (
    <ControlShell
      label={label}
      required={required}
      requiredLabel={requiredLabel}
      hint={hint}
      error={error}
      errorId={errorId}
      labelId={labelId}
    >
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        data-error={error ? "true" : undefined}
        tabIndex={error ? -1 : undefined}
        className="flex flex-wrap gap-3"
      >
        {options.map((option, index) => {
          const selected = value === option;
          // 40% → 100% of the tile, in the authored order.
          const scale = 40 + Math.round((index / Math.max(steps - 1, 1)) * 60);
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(selected ? "" : option)}
              className={cn(
                "flex min-h-11 min-w-24 flex-col items-center gap-2 rounded-card border p-3 font-body text-14",
                "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                "disabled:pointer-events-none disabled:opacity-40",
                selected
                  ? "border-champagne bg-sand font-medium text-ink"
                  : "border-hairline text-ink hover:bg-sand",
                FOCUS_RING,
              )}
            >
              <span
                aria-hidden
                className="flex h-8 w-full items-end justify-center"
              >
                <span
                  className={cn(
                    "block border",
                    selected
                      ? "border-champagne bg-champagne/20"
                      : "border-graphite/40",
                  )}
                  style={{ width: `${scale}%`, height: `${scale}%` }}
                />
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </ControlShell>
  );
}

/* ————————————————— engraving (TEXT) ————————————————— */

/**
 * §9.3's engraving input with a live typography preview. The preview is the
 * display face on a sand plate — what the studio actually cuts — and it is
 * `aria-hidden`: the input already carries the value, and a second live copy
 * of every keystroke is noise to a screen reader.
 */
export function EngravingField({
  label,
  value,
  onChange,
  placeholder,
  previewLabel,
  previewPlaceholder,
  maxLength = 300,
  disabled,
  required,
  requiredLabel,
  hint,
  error,
  errorId,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Mono caption over the plate, e.g. "Preview". */
  previewLabel: string;
  /** Shown on the plate before anything is typed. */
  previewPlaceholder: string;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  requiredLabel?: string;
  hint?: string | null;
  error?: string;
  errorId?: string;
  id: string;
}) {
  return (
    <div className="grid gap-3">
      <label htmlFor={id} className={LABEL}>
        {label}
        {required ? (
          <>
            <span aria-hidden className="text-alert">
              {" "}
              *
            </span>
            {requiredLabel ? (
              <span className="sr-only"> {requiredLabel}</span>
            ) : null}
          </>
        ) : null}
      </label>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn("h-11", fieldControlClasses)}
      />
      <div className="border border-hairline bg-sand px-5 py-6">
        <p className="u-micro mb-3">{previewLabel}</p>
        <p
          aria-hidden
          className={cn(
            "font-display text-h3 leading-tight break-words",
            // Full-opacity graphite, not the /60 fade this replaced: at
            // text-h3 on bg-sand the faded tone measured under 4.5:1 (batch
            // G's a11y audit on /product/demo-product-001, routed to A3).
            // aria-hidden exempts it from being announced but not from being
            // SEEN, and axe's color-contrast rule checks exactly that.
            value.trim() ? "text-ink" : "text-graphite",
          )}
        >
          {value.trim() || previewPlaceholder}
        </p>
      </div>
      {hint ? <p className="font-body text-12 text-graphite">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="font-body text-12 text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ————————————————— v2.0 primitives (kept: /design-lab) ————————————————— */

/**
 * Pill radiogroup on REAL radio inputs (sr-only) + styled labels, so arrow-key
 * navigation, form semantics and screen-reader announcements come native.
 */
export function OptionPicker({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const uid = useId();

  return (
    <fieldset data-slot="sf-option-picker" className="grid gap-2">
      <legend className="mb-2 font-body text-14 font-medium text-ink">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const inputId = `${uid}-${option.value}`;
          const checked = value === option.value;

          return (
            <span key={option.value} className="inline-flex">
              <input
                type="radio"
                id={inputId}
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                /* The pill grammar lives once, in form-field.tsx, beside
                   `PillField` — the custom-order form renders the same pill
                   on real fields, and two hand-kept copies of it would drift
                   the day one of them is adjusted. */
                className={pillClasses(checked)}
              >
                {option.label}
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Personalization text (engraved names, embedded dates). The live "N/max"
 * counter is mono per Part 3.2, announced politely only near the limit.
 */
export function PersonalizationText({
  label,
  name,
  maxLength,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  maxLength?: number;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const hintId = `${uid}-hint`;
  const counterId = `${uid}-counter`;
  const ariaDescribedBy =
    [hint ? hintId : null, maxLength !== undefined ? counterId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div data-slot="sf-personalization-text" className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className={LABEL}>
          {label}
        </label>
        {maxLength !== undefined ? (
          <span id={counterId} className="u-num text-12 text-graphite">
            {value.length}/{maxLength}
            {/* Announce only near the limit — a per-keystroke live region
                narrates every character. */}
            <span aria-live="polite" className="sr-only">
              {maxLength - value.length <= Math.ceil(maxLength * 0.2)
                ? `${maxLength - value.length} characters left`
                : ""}
            </span>
          </span>
        ) : null}
      </div>
      <input
        type="text"
        id={inputId}
        name={name}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={ariaDescribedBy}
        className={cn("h-11", fieldControlClasses)}
      />
      {hint ? (
        <p id={hintId} className="font-body text-12 text-graphite">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The default gifting moments for made-to-order resin. */
const DEFAULT_OCCASIONS: { value: string; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "wedding-gift", label: "Wedding gift" },
  { value: "housewarming", label: "Housewarming" },
  { value: "just-because", label: "Just because" },
];

/** Styled native `<select>` — appearance-none with a lucide chevron. */
export function OccasionSelect({
  value,
  onChange,
  options = DEFAULT_OCCASIONS,
  label = "Occasion",
  name = "occasion",
}: {
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
  label?: string;
  name?: string;
}) {
  const uid = useId();
  const selectId = `${uid}-select`;

  return (
    <div data-slot="sf-occasion-select" className="grid gap-1.5">
      <label htmlFor={selectId} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn("h-11 appearance-none pe-10", fieldControlClasses)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-graphite"
        />
      </div>
    </div>
  );
}

/** Quantity stepper. size-11 buttons keep the 44px floor. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const stepButtonClasses = cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline text-ink",
    "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-sand motion-reduce:transition-none",
    /* aria-disabled (not `disabled`) at the bounds: a natively-disabled
       button drops keyboard focus to <body>, stranding the user mid-count. */
    "aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent",
    FOCUS_RING,
  );

  return (
    <div
      data-slot="sf-quantity-stepper"
      role="group"
      aria-labelledby={labelId}
      className="grid gap-1.5"
    >
      <span id={labelId} className={LABEL}>
        Quantity
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease quantity"
          aria-disabled={value <= min}
          onClick={() => {
            if (value > min) onChange(value - 1);
          }}
          className={stepButtonClasses}
        >
          <Minus aria-hidden strokeWidth={1.5} className="size-4" />
        </button>
        <span
          role="status"
          aria-live="polite"
          className="u-num min-w-8 text-center text-16 text-ink"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          aria-disabled={max !== undefined && value >= max}
          onClick={() => {
            if (max === undefined || value < max) onChange(value + 1);
          }}
          className={stepButtonClasses}
        >
          <Plus aria-hidden strokeWidth={1.5} className="size-4" />
        </button>
      </div>
    </div>
  );
}
