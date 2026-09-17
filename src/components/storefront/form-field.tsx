import type * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * v3 storefront form primitives — REDESIGN.md §4.4, §10.3, Part 13, Part 17.
 *
 * > "Large inputs, large labels, generous whitespace, minimal borders,
 * > floating helper text."
 *
 * Which is why a field here is not a box. Part 3.5 asks for separation by
 * whitespace, type and surface — never by a rounded rectangle — so a control
 * is a single 1px hairline under a 56px line of 16px type. Filling it changes
 * one thing: the rule goes sapphire. Getting it wrong changes one thing: the
 * rule goes alert, *and* a sentence appears, because Part 16 forbids colour
 * as the only signal.
 *
 * Four rules that are not style choices:
 *
 * 1. **16px minimum on every control.** Part 13 — anything smaller makes iOS
 *    zoom the page on focus, and a form that jumps when you tap it is a
 *    mobile bug wearing a type scale.
 * 2. **The label is always visible.** Part 17 forbids placeholder-only
 *    labelling. `hideLabel` keeps the label in the accessibility tree for the
 *    two toolbar controls (sort, newsletter) whose surrounding copy already
 *    names them; it never removes it.
 * 3. **Focus is the global ring, not a local one.** `globals.css` paints
 *    `:focus-visible` as a 2px `--focus` outline at 3px offset, scope-resolved
 *    to champagne inside dark bands. A borderless control must therefore not
 *    set `outline-none` — the previous skin did, and then rebuilt the ring
 *    with `ring-*` utilities that could not follow the dark scope.
 * 4. **Hint and error are wired, not merely adjacent.** Both ids go into
 *    `aria-describedby`, alongside whatever the caller already passed.
 *
 * Server-compatible: native elements, no state. Ids derive from `name` (or an
 * explicit `id`), so no hook is needed and a server component can render a
 * complete form.
 */

/**
 * The shared control skin. Exported because the two long order forms compose
 * their own heights on top of it (`h-14`, `resize-y py-3`) and must not drift
 * from the primitives.
 */
const fieldControlClasses = [
  "w-full rounded-none border-0 border-b border-hairline bg-transparent px-0",
  "font-body text-16 text-ink placeholder:text-graphite",
  "transition-colors duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
  "hover:border-graphite focus:border-sapphire",
  "disabled:pointer-events-none disabled:opacity-40",
  "aria-invalid:border-alert",
  // Dark bands (the footer newsletter, any obsidian panel).
  "in-data-[theme=navy]:border-hairline-dk in-data-[theme=navy]:text-mineral",
  "in-data-[theme=navy]:placeholder:text-mist in-data-[theme=navy]:focus:border-champagne",
].join(" ");

/**
 * The pill skin, shared by {@link PillField} and the `/design-lab`
 * `OptionPicker` so the two can never drift into two different pills.
 *
 * `h-11` is Part 13's 44px tap floor, not a look — a pill row is the one
 * control on this site a thumb aims at directly. Selection is carried by
 * BORDER + WEIGHT + GROUND, never by colour alone (Part 16); the checked
 * champagne border is the accent on top of three signals that already say it.
 */
function pillClasses(checked: boolean): string {
  return cn(
    "inline-flex h-11 cursor-pointer items-center rounded-full border px-5 font-body text-14 select-none",
    "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
    "peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-3",
    "peer-disabled:pointer-events-none peer-disabled:opacity-40",
    checked
      ? "border-champagne bg-sand font-medium text-ink"
      : "border-hairline text-ink hover:bg-sand",
  );
}

/** Label register — large, per §10.3, and never hidden by a placeholder. */
const fieldLabelClasses =
  "font-body text-16 font-medium text-ink in-data-[theme=navy]:text-mineral";

type FieldOwnProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  /** Keep the label for screen readers only (e.g. the newsletter row). */
  hideLabel?: boolean;
};

function fieldIds(name: string, id?: string) {
  const fieldId = id ?? `sf-field-${name}`;
  return {
    fieldId,
    hintId: `${fieldId}-hint`,
    errorId: `${fieldId}-error`,
  };
}

function describedBy(
  existing: string | undefined,
  hint: string | undefined,
  hintId: string,
  error: string | undefined,
  errorId: string,
) {
  const ids = [existing, hint ? hintId : null, error ? errorId : null].filter(
    Boolean,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** Internal shell: label (+ required asterisk), control, hint, error. */
function FieldShell({
  label,
  required,
  optionalLabel,
  hideLabel,
  fieldId,
  hint,
  hintId,
  error,
  errorId,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  /** Translated "(optional)" — shown when the field is not required. */
  optionalLabel?: string;
  hideLabel?: boolean;
  fieldId: string;
  hint?: string;
  hintId: string;
  error?: string;
  errorId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="sf-form-field" className={cn("grid gap-2", className)}>
      <label
        htmlFor={fieldId}
        className={cn(fieldLabelClasses, hideLabel && "sr-only")}
      >
        {label}
        {required ? (
          <>
            <span aria-hidden className="text-alert">
              {" "}
              *
            </span>
            <span className="sr-only"> required</span>
          </>
        ) : optionalLabel ? (
          <span className="font-normal text-graphite in-data-[theme=navy]:text-mist">
            {" "}
            {optionalLabel}
          </span>
        ) : null}
      </label>
      {children}
      {/* Floating helper text (§10.3): mono micro, no box, no icon. */}
      {hint ? (
        <p id={hintId} className="u-micro">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="font-body text-14 text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  hideLabel,
  optionalLabel,
  className,
  id,
  required,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: FieldOwnProps & {
  optionalLabel?: string;
} & React.ComponentProps<"input">) {
  const { fieldId, hintId, errorId } = fieldIds(name, id);

  return (
    <FieldShell
      label={label}
      required={required}
      optionalLabel={optionalLabel}
      hideLabel={hideLabel}
      fieldId={fieldId}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      className={className}
    >
      <input
        data-slot="sf-input"
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          ariaDescribedBy,
          hint,
          hintId,
          error,
          errorId,
        )}
        className={cn("h-14", fieldControlClasses)}
        {...rest}
      />
    </FieldShell>
  );
}

/** Tel input (Part 13: `inputmode="tel"` on every phone field). */
export function TelField(
  props: FieldOwnProps & {
    optionalLabel?: string;
  } & React.ComponentProps<"input">,
) {
  return <TextField autoComplete="tel" inputMode="tel" {...props} type="tel" />;
}

/** Email input. */
export function EmailField(
  props: FieldOwnProps & {
    optionalLabel?: string;
  } & React.ComponentProps<"input">,
) {
  return (
    <TextField autoComplete="email" inputMode="email" {...props} type="email" />
  );
}

export function SelectField({
  label,
  name,
  options,
  placeholder,
  error,
  hint,
  hideLabel,
  optionalLabel,
  className,
  id,
  required,
  defaultValue,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: FieldOwnProps & {
  options: { value: string; label: string }[];
  placeholder?: string;
  optionalLabel?: string;
} & React.ComponentProps<"select">) {
  const { fieldId, hintId, errorId } = fieldIds(name, id);
  const resolvedDefault =
    rest.value === undefined && defaultValue === undefined && placeholder
      ? ""
      : defaultValue;

  return (
    <FieldShell
      label={label}
      required={required}
      optionalLabel={optionalLabel}
      hideLabel={hideLabel}
      fieldId={fieldId}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      className={className}
    >
      <div className="relative">
        <select
          data-slot="sf-select"
          id={fieldId}
          name={name}
          required={required}
          defaultValue={resolvedDefault}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(
            ariaDescribedBy,
            hint,
            hintId,
            error,
            errorId,
          )}
          className={cn(
            "h-14 appearance-none pe-8",
            // The unfilled placeholder option reads as secondary text, so a
            // resting select does not look like a chosen answer.
            "[&:has(option[value='']:checked)]:text-graphite",
            fieldControlClasses,
          )}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 end-0 size-4 -translate-y-1/2 text-graphite in-data-[theme=navy]:text-mist"
        />
      </div>
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  error,
  hint,
  hideLabel,
  optionalLabel,
  className,
  id,
  required,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: FieldOwnProps & {
  optionalLabel?: string;
} & React.ComponentProps<"textarea">) {
  const { fieldId, hintId, errorId } = fieldIds(name, id);

  return (
    <FieldShell
      label={label}
      required={required}
      optionalLabel={optionalLabel}
      hideLabel={hideLabel}
      fieldId={fieldId}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      className={className}
    >
      <textarea
        data-slot="sf-textarea"
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          ariaDescribedBy,
          hint,
          hintId,
          error,
          errorId,
        )}
        className={cn("min-h-32 resize-y py-3", fieldControlClasses)}
        {...rest}
      />
    </FieldShell>
  );
}

/**
 * A short closed list as a pill radiogroup instead of a native `<select>` —
 * plan §2.4 and audit §3.5 ("budget and timeline as pills", "occasion as
 * chips"). Every option is visible at rest, so choosing is one tap rather
 * than open-scroll-pick, and on a phone it replaces the OS picker sheet that
 * covers the form the visitor is filling in.
 *
 * Built on REAL radio inputs (`sr-only`) with styled labels, so arrow-key
 * navigation, `name`-based grouping, form semantics and screen-reader
 * announcements are all native and none of them is re-implemented.
 *
 * **An optional field keeps a way back out.** A `<select>` had one — its
 * placeholder row — and a radiogroup has none: once a radio is checked,
 * nothing but another radio unchecks it. So an optional pill field renders
 * `emptyLabel` as its FIRST pill, valued `""`. Without it, tapping any pill
 * on an optional question would be irreversible, which is a worse control
 * than the select it replaces.
 *
 * The lists behind these are owner-editable (`/studio/forms`), so the row
 * wraps and nothing here assumes a count — and nothing maps a value to an
 * icon: the audit asks for "icon chips", but an icon per option would break
 * the moment an owner adds one, and a chip with no icon beside chips that
 * have one reads as an error.
 */
export function PillField({
  label,
  name,
  options,
  value,
  onChange,
  emptyLabel,
  optionalLabel,
  hint,
  error,
  disabled,
  required,
  className,
  id,
}: FieldOwnProps & {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Translated "No preference" — the opt-out pill on an optional field. */
  emptyLabel?: string;
  optionalLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}) {
  const { fieldId, hintId, errorId } = fieldIds(name, id);
  const choices = emptyLabel
    ? [{ value: "", label: emptyLabel }, ...options]
    : options;

  return (
    <div data-slot="sf-form-field" className={cn("grid gap-2", className)}>
      <fieldset
        aria-describedby={describedBy(
          undefined,
          hint,
          hintId,
          error,
          errorId,
        )}
        aria-invalid={error ? true : undefined}
      >
        <legend className={cn(fieldLabelClasses, "mb-3")}>
          {label}
          {required ? (
            <>
              <span aria-hidden className="text-alert">
                {" "}
                *
              </span>
              <span className="sr-only"> required</span>
            </>
          ) : optionalLabel ? (
            <span className="font-normal text-graphite in-data-[theme=navy]:text-mist">
              {" "}
              {optionalLabel}
            </span>
          ) : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {choices.map((option) => {
            const inputId = `${fieldId}-${option.value || "none"}`;
            return (
              <span key={option.value} className="inline-flex">
                <input
                  type="radio"
                  id={inputId}
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  disabled={disabled}
                  onChange={() => onChange(option.value)}
                  className="peer sr-only"
                />
                <label htmlFor={inputId} className={pillClasses(value === option.value)}>
                  {option.label}
                </label>
              </span>
            );
          })}
        </div>
      </fieldset>
      {hint ? (
        <p id={hintId} className="u-micro">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="font-body text-14 text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { fieldControlClasses, fieldLabelClasses, pillClasses };
