import type { ReactNode } from "react";

/**
 * Helper text under a field — the sentence that says what the field is for or
 * what shape it wants, BEFORE anything has gone wrong. Pair it with
 * `FieldError` and hand both ids to the control through `describedBy()` so a
 * screen reader hears the hint on focus and the error once there is one.
 *
 * Not `role="alert"`: a hint is not an event. Muted rather than destructive
 * for the same reason.
 */
export function FieldHint({
  id,
  children,
}: {
  id?: string;
  children?: ReactNode;
}) {
  if (!children) return null;
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Compose an `aria-describedby` value from whichever descriptions currently
 * exist. `describedBy("f-hint", error && "f-error")` yields `"f-hint f-error"`
 * with an error and `"f-hint"` without one; with nothing it yields
 * `undefined`, which is the attribute's absence rather than an empty string
 * (an empty `aria-describedby` is a real attribute pointing at nothing).
 */
export function describedBy(
  ...ids: Array<string | false | null | undefined>
): string | undefined {
  const present = ids.filter((id): id is string => Boolean(id));
  return present.length ? present.join(" ") : undefined;
}
