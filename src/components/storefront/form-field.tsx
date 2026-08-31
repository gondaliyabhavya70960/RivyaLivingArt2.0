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

export { fieldControlClasses, fieldLabelClasses };
