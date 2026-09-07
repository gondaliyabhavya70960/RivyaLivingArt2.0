/**
 * After a refused submit, bring the first message into view — but only when
 * nothing else did.
 *
 * React Hook Form focuses the first errored INPUT, and focusing scrolls it
 * into view for free. Two kinds of refusal have no input to focus:
 *
 * - an ARRAY-LEVEL rule (the product's eight lexical rows, its twelve linked
 *   products) errors at the array's root, which has no ref;
 * - the two cross-form guards render an alert above a form whose only Save
 *   button is a sticky bar, visible from every scroll position.
 *
 * In both cases the refusal is real and rendered and off screen, which reads
 * to the owner as Save doing nothing — the exact symptom this batch set out
 * to remove. Measured: nine lexical rows put the message 1,500px below the
 * fold of a 900px viewport.
 *
 * Runs two frames late so React Hook Form's own focus pass (which fires
 * after `onInvalid`, and again in a `setTimeout`) wins whenever it can, and
 * stands down entirely once that pass has reached an errored control.
 */
export function scrollToFirstErrorIfUnfocused(formId: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Looked up here rather than held in a ref: a ref read from a handler
      // passed during render trips `react-hooks/refs`, and the element is
      // only ever needed after the submit.
      const form = document.getElementById(formId);
      if (!form) return;
      // Skip only when React Hook Form actually reached an errored control:
      // after a click the Save button still holds focus, so "something in
      // the form is focused" is not the question — "is the focused thing the
      // problem" is.
      if (document.activeElement?.getAttribute("aria-invalid") === "true") {
        return;
      }
      const first = form.querySelector<HTMLElement>('[role="alert"]');
      if (!first) return;
      first.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  });
}
