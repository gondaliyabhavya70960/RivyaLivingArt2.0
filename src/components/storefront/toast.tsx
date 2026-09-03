"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Toaster, toast as sonnerToast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * Toast — REDESIGN.md §4.6 · Part 14 · Part 16.
 *
 * "Bottom-centre mobile, bottom-left desktop. 320px, obsidian, white text,
 * 3px left border in success or alert colour, auto-dismiss 5s with a hairline
 * countdown, paused on hover/focus. `role="status"` for success,
 * `role="alert"` for errors."
 *
 * Sonner is still the transport — it owns stacking, mount/unmount and swipe —
 * but none of the spec above survives its default rendering, so every toast
 * on the storefront goes out through `toast.custom()` and this file draws the
 * card itself. Four decisions that are not obvious from the markup:
 *
 * 1. **We own the dismissal clock.** Sonner's timer pauses on hover and on
 *    pointer-down, but not on keyboard focus, and it is not reachable from
 *    outside. Since the spec asks for focus too, the toast is handed
 *    `duration: Infinity` and the timer below runs the 5s, banking the
 *    remaining time on pause. It is a JS timer on purpose: if dismissal rode
 *    on the countdown's `animationend`, the global reduced-motion collapse
 *    (`animation-duration: .01ms`) would blink every toast out of existence.
 * 2. **The pause is bound to sonner's `<li>`, not to this card.** The
 *    focusable element is the `<li tabIndex={0}>` sonner renders around us,
 *    which is our *ancestor* — `:focus-within` on the card can never see it,
 *    and neither can a `group-focus-within:` variant. So both halves of the
 *    pause (the timer here, the `animation-play-state` in COUNTDOWN_CSS) key
 *    off `[data-sonner-toast]` itself.
 * 3. **One position, two readings.** Sonner takes a single `position`, so the
 *    toaster is anchored `bottom-left` and its own ≤600px rules stretch the
 *    row to the viewport; the card inside is a fixed 320px with `mx-auto`, so
 *    it lands centred on mobile and left on desktop without a second mount.
 * 4. **It clears the mobile WhatsApp bar.** That bar is `lg:hidden` at 64px,
 *    and sonner's mobile breakpoint is 600px — the two do not line up, so the
 *    bottom offset is raised for everything under `--breakpoint-lg` rather
 *    than through `mobileOffset`, which only reaches 600px. The ≥1024px
 *    reset back to sonner's own offset lives in globals.css under
 *    `@variant lg` — a Tailwind at-rule cannot be authored inside a JS
 *    template string, which COUNTDOWN_CSS below otherwise is.
 *
 * Mount `<SfToaster/>` once in the storefront layout; fire from anywhere with
 * the `toast` export. The Studio keeps its own plain sonner `<Toaster/>` and
 * imports `toast` straight from sonner — none of this reaches it.
 */

/** §4.6: auto-dismiss at 5s. */
const TOAST_DURATION_MS = 5000;
/** §4.6: 320px. Sonner paints `--width` onto the row; the card matches it. */
const TOAST_WIDTH = "320px";

/**
 * The two things Tailwind cannot express here: a keyframe, and selectors that
 * have to reach *up* to sonner's own elements. Kept beside the component
 * rather than in globals.css because it is meaningless without it.
 *
 * The countdown animates `inline-size` rather than `scaleX` so it drains from
 * the inline start in Arabic without a mirrored `transform-origin`. It is one
 * hairline over five seconds — the paint cost of animating a logical size
 * here is not worth the RTL bug the cheaper property buys.
 *
 * The `[data-sonner-theme]` on the last two selectors is not decoration. It
 * buys a third attribute so they outrank sonner's own
 * `[data-sonner-toaster][data-y-position=bottom]`, which sonner appends to
 * `<head>` when its module evaluates on the client — i.e. after anything
 * React emitted during SSR. Same reason Tailwind classes cannot do this job:
 * sonner's stylesheet is unlayered and beats every `@layer utilities` rule
 * whatever its specificity.
 */
const COUNTDOWN_CSS = `
@keyframes sf-toast-countdown { from { inline-size: 100% } to { inline-size: 0% } }
.sf-toast-countdown { animation: sf-toast-countdown var(--sf-toast-duration) linear forwards }
[data-sonner-toast]:hover .sf-toast-countdown,
[data-sonner-toast]:focus-within .sf-toast-countdown { animation-play-state: paused }
[data-sonner-toaster][data-sonner-theme][data-y-position="bottom"] { bottom: calc(5.5rem + env(safe-area-inset-bottom)) }
`;

type ToastTone = "success" | "alert" | "neutral";

/* §4.6 · the 3px inline-start border, in the tone's own colour. Neutral takes
   champagne — Part 3.1's role for "a tiny highlight", and the one accent that
   clears 7.5:1 on the obsidian this card is drawn on.

   The border is reinforcement, never the signal: alert on obsidian measures
   2.87:1, a shade under the 3:1 non-text floor, so the meaning has to survive
   without it — and it does, in the `role="alert"` and in the sentence itself
   at mineral-on-obsidian. Spec asks for the tone colour here; colour alone is
   not asked to carry anything. */
const toneBorder: Record<ToastTone, string> = {
  success: "border-s-success",
  alert: "border-s-alert",
  neutral: "border-s-champagne",
};

const toneCountdown: Record<ToastTone, string> = {
  success: "bg-success",
  alert: "bg-alert",
  neutral: "bg-champagne",
};

type SfToastProps = {
  id: string | number;
  tone: ToastTone;
  message: string;
  description?: string;
  duration: number;
};

function SfToast({ id, tone, message, description, duration }: SfToastProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    // See note 2 in the file header — the pause has to hang off sonner's row.
    const row = card.closest<HTMLElement>("[data-sonner-toast]") ?? card;

    let remaining = duration;
    let startedAt = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      startedAt = performance.now();
      timer = setTimeout(() => sonnerToast.dismiss(id), remaining);
    };
    const hold = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
    };
    const release = () => {
      if (timer === undefined && remaining > 0) run();
    };

    run();
    row.addEventListener("pointerenter", hold);
    row.addEventListener("pointerleave", release);
    row.addEventListener("focusin", hold);
    row.addEventListener("focusout", release);

    return () => {
      clearTimeout(timer);
      row.removeEventListener("pointerenter", hold);
      row.removeEventListener("pointerleave", release);
      row.removeEventListener("focusin", hold);
      row.removeEventListener("focusout", release);
    };
  }, [duration, id]);

  return (
    <div
      ref={cardRef}
      data-slot="sf-toast"
      /* An obsidian surface is a dark band wherever it lands, so the scope
         goes on the card and nested inks resolve without opting out. */
      data-theme="navy"
      /* §4.6: errors interrupt, everything else waits its turn. */
      role={tone === "alert" ? "alert" : "status"}
      style={{ "--sf-toast-duration": `${duration}ms` } as CSSProperties}
      className={cn(
        /* §4.6 is explicit about 320px. Sonner stretches the ROW to the
           viewport below 600px (its own rule, unlayered, so `w-80` on the row
           cannot win) — the card holds the width and centres itself inside
           that row, which is also how "bottom-centre mobile" is satisfied. */
        "relative mx-auto flex w-80 max-w-full flex-col gap-1 overflow-hidden border-s-[3px] bg-obsidian py-3.5 ps-4 pe-5 text-start",
        toneBorder[tone],
      )}
    >
      <p className="font-body text-small leading-snug text-mineral">
        {message}
      </p>
      {description ? (
        <p className="font-body text-small leading-snug text-mist">
          {description}
        </p>
      ) : null}

      {/* The countdown. Hidden rather than frozen under reduced motion: the
          collapse would leave a fully-drained rule sitting under a toast that
          has four seconds left, which is worse than no rule at all. The
          dismissal is a JS timer either way. */}
      <span
        aria-hidden
        className={cn(
          "sf-toast-countdown absolute bottom-0 start-0 h-px w-full motion-reduce:hidden",
          toneCountdown[tone],
        )}
      />
    </div>
  );
}

export type SfToastOptions = {
  /** Second line, in `mist`. One clause — a toast is not a paragraph. */
  description?: string;
  /** Override the 5s dismissal. Milliseconds. */
  duration?: number;
  /** Reuse an id to replace a toast in place instead of stacking a new one. */
  id?: string | number;
};

function show(tone: ToastTone, message: string, options?: SfToastOptions) {
  const duration = options?.duration ?? TOAST_DURATION_MS;

  return sonnerToast.custom(
    (id) => (
      <SfToast
        id={id}
        tone={tone}
        message={message}
        description={options?.description}
        duration={duration}
      />
    ),
    {
      // Infinity parks sonner's own timer; SfToast runs the clock (note 1).
      duration: Infinity,
      id: options?.id,
      unstyled: true,
    },
  );
}

/**
 * Same call shape as sonner's `toast`, so every existing call site
 * (`toast.success(…)`, `toast.error(…)`, `toast(…)`) keeps working — but each
 * one now renders the card above. `error` maps to the alert tone, which is
 * what promotes it to `role="alert"`.
 */
export const toast = Object.assign(
  (message: string, options?: SfToastOptions) =>
    show("neutral", message, options),
  {
    success: (message: string, options?: SfToastOptions) =>
      show("success", message, options),
    error: (message: string, options?: SfToastOptions) =>
      show("alert", message, options),
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  },
);

export function SfToaster() {
  return (
    <>
      {/* href + precedence lets React 19 hoist and de-duplicate this, so the
          design-lab page mounting a second toaster does not double the rules. */}
      <style href="sf-toast" precedence="default">
        {COUNTDOWN_CSS}
      </style>
      <Toaster
        data-slot="sf-toaster"
        /* Bottom-left on desktop; sonner's ≤600px rules widen the row and the
           card's mx-auto centres it there (note 3). */
        position="bottom-left"
        /* Expanded by default: with `unstyled` rows, sonner's collapsed stack
           relies on its own [data-styled] rules to hide the toasts behind the
           front one, and those rules are exactly what we opted out of. */
        expand
        /* Sizes the column sonner positions; the card inside states the same
           320px in `w-80`, and shrink-wraps the row to it on desktop. */
        style={{ "--width": TOAST_WIDTH } as CSSProperties}
        toastOptions={{ unstyled: true }}
      />
    </>
  );
}
