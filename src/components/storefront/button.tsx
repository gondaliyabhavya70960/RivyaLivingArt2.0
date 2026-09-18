import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * v3 storefront Button — REDESIGN.md §3.6.
 *
 * Five variants, three sizes, and two rules that matter more than any of them:
 *
 * **No scale or lift on hover.** Colour and underline only, 120–180ms. Part 14
 * puts button motion in the same sentence as "no glow" — a button that jumps
 * under the cursor is the tell of a template.
 *
 * **Never a silently dead button.** Disabled is 40% opacity *plus* a stated
 * reason ("Add your phone number"), rendered as a mono line beneath the
 * control and wired to it with `aria-describedby`. That is what `reason` is
 * for; a disabled button without one is a bug, not a style choice.
 *
 * Loading replaces the label with an inline spinner at a locked width, so the
 * row never reflows mid-submit.
 *
 * WhatsApp stays recognisable but integrated: it is the order channel, not the
 * brand. The fill is `whatsapp-deep` rather than the brand green because white
 * on #128C7E is 4.14:1 — short of AA for a 14–16px label.
 *
 * AND IT IS THE FINAL ORDER ACTION, NOTHING ELSE. That sentence sat in the
 * `whatsapp` variant's own comment while sixteen of its twenty call sites were
 * "ask us a question" links, page heroes and card actions — which is how the
 * audit came to report (§2.4) that "primary button colour shifts by page" and
 * that "teal reads like a different product". Green now appears exactly where
 * an order is sent: Place Order on the PDP and its mobile twin, the custom
 * brief's submit, and the `/whatsapp-order` fallback when the popup is
 * blocked. Everywhere else the pill takes `premium`, `primary` or
 * `secondary`, and the channel is carried by the label and the MessageCircle
 * icon instead of by colour.
 *
 * D30 (tokens.css) removed the four `in-data-[theme=navy]:` overrides that
 * used to sit in these variants. They were not deleted for tidiness: each one
 * described "how this button looks on a dark band", every ground is a dark
 * band now, and so each was either promoted to the base (primary's inverted
 * fill, the focus ring's offset) or became a line restating the value
 * directly above it (`text-mineral` where the base already resolves mineral,
 * `text-champagne` where ghost's ink already clears AA). A no-op override is
 * worse than no override: it reads as a live distinction.
 *
 * (`design-lab` keeps one, deliberately: it is the staff variant gallery and
 * its job is to render every variant, including this one.)
 */
const buttonVariants = cva(
  [
    "group/btn relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "font-body font-medium outline-none",
    // Colour and border only — no transform, per Part 14.
    "transition-[color,background-color,border-color] duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
    // D30: the ring's offset paints the GROUND behind the ring, and that
    // ground is obsidian everywhere now — `ring-offset-background` drew a cream
    // halo around every focused button. The `[data-theme=navy]` twin that used
    // to correct it is therefore the base, and the override is gone.
    "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-obsidian",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Primary — the one unmissable action on a screen, so it is whatever
           the ground is not. D30 made the ground obsidian everywhere, so the
           inverted pill this variant used to keep behind
           `in-data-[theme=navy]:` IS the variant now: a mineral fill with an
           obsidian label, settling to sand at hover. The obsidian-on-mineral
           original is not kept as an override, because there is no ground it
           would be correct on — an obsidian pill on an obsidian page is an
           invisible button. */
        primary: "rounded-full bg-mineral text-obsidian hover:bg-mineral/85",
        /* Secondary — transparent, with an underline that draws left→right on
           hover. The rule is a pseudo-element so it can animate its width
           without reserving layout. */
        secondary: [
          "rounded-full text-ink",
          "after:absolute after:bottom-[30%] after:start-[var(--btn-pad)] after:h-px after:w-0 after:bg-current",
          "after:transition-[width] after:duration-(--dur-fast) after:ease-(--ease-luxury)",
          "hover:after:w-[calc(100%-var(--btn-pad)*2)] focus-visible:after:w-[calc(100%-var(--btn-pad)*2)]",
          "motion-reduce:after:transition-none",
        ].join(" "),
        /* Premium — 1px champagne outline on dark, filling to obsidian text on
           champagne at hover. The only place a champagne fill is allowed, and
           only because the label goes dark with it. */
        premium:
          "rounded-full border border-champagne bg-transparent text-champagne hover:bg-champagne hover:text-obsidian",
        /* WhatsApp — the final order action, nothing else. */
        whatsapp: "rounded-full bg-whatsapp-deep text-white hover:bg-whatsapp",
        /* Ghost — an in-card text action with an animated underline. */
        ghost: [
          "rounded-full text-sapphire-ink",
          "after:absolute after:bottom-[30%] after:start-[var(--btn-pad)] after:h-px after:w-0 after:bg-current",
          "after:transition-[width] after:duration-(--dur-fast) after:ease-(--ease-luxury)",
          "hover:after:w-[calc(100%-var(--btn-pad)*2)] focus-visible:after:w-[calc(100%-var(--btn-pad)*2)]",
          "motion-reduce:after:transition-none",
        ].join(" "),
      },
      size: {
        /* --btn-pad feeds the underline insets so the rule spans the label,
           not the padding. `sm` is 40px on a mouse/trackpad (Part 3.6);
           `pointer-coarse:min-h-11` floors it to the 44px touch-target
           minimum on a coarse pointer without touching the fine-pointer
           visual — CSS clamps a used height to at least `min-height`, so the
           fixed `h-10` and the coarse-pointer floor never fight. */
        sm: "h-10 px-5 text-14 pointer-coarse:min-h-11 [--btn-pad:1.25rem]",
        md: "h-12 px-7 text-16 [--btn-pad:1.75rem]",
        lg: "h-14 px-9 text-16 [--btn-pad:2.25rem]",
        /* Icon-only actions still clear the 44px floor. */
        icon: "size-12 rounded-full [--btn-pad:0rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Why this control is disabled, e.g. "Add your phone number". Rendered as
     * a mono line beneath the button and announced via aria-describedby.
     * Required in spirit whenever `disabled` is true — Part 3.6: "Never a
     * silently dead button."
     */
    reason?: string;
    /** Swaps the label for an inline spinner at a locked width. */
    loading?: boolean;
    /** Announced while loading, e.g. "Sending". Falls back to the label. */
    loadingLabel?: string;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  reason,
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const reactId = React.useId();
  const reasonId = reason ? `${reactId}-reason` : undefined;
  const isDisabled = disabled || loading;

  const control = (
    <Comp
      data-slot="sf-button"
      data-loading={loading ? "" : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-describedby={reasonId}
      aria-busy={loading || undefined}
      {...(asChild ? {} : { disabled: isDisabled })}
      {...props}
    >
      {loading ? (
        <>
          {/* Width is locked by rendering the label invisibly underneath, so
              the row cannot reflow when the spinner appears. */}
          <span aria-hidden className="invisible contents">
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
            <span className="sr-only">{loadingLabel ?? "Loading"}</span>
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );

  if (!reason) return control;

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      {control}
      <span id={reasonId} className="u-micro">
        {reason}
      </span>
    </span>
  );
}

/** A 1px-stroke arc on the house curve — the same weight as the Lucide set. */
function Spinner() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 animate-spin motion-reduce:animate-none"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { buttonVariants };
