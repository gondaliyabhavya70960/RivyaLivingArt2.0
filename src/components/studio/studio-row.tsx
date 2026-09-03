import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Body row for studio list tables — the sibling of `StudioTableHead`.
 *
 * The header treatment was centralised for DS-008; the row treatment was not,
 * and it drifted into three: two tables (products, inquiries) carry the v3
 * `hover:bg-foreground/3` with a token duration, fifteen carry a pre-v3
 * `hover:bg-muted/40`, and the border/last-child handling was retyped each
 * time. At fifty rows a page that difference is visible between two screens
 * an owner moves between all day.
 *
 * **Why `foreground/3` and not a sapphire tint.** Sapphire is the Studio's
 * action colour — it marks what you can press, and `stat-card` and `sidebar`
 * both keep it to borders and ink. A row you are merely passing over is not
 * an action, so the hover is a neutral lift.
 *
 * **The backgrounds are opaque on purpose, and that is load-bearing.** They
 * used to be `hover:bg-foreground/3` — a translucent wash over whatever the
 * table sat on. That reads identically on a card, so it cost nothing until a
 * column needed PINNING: a sticky cell inherits its row's background, and a
 * translucent one lets the columns scrolling underneath show straight through
 * it. Mixing the same 3% against the card up front gives the same colour and a
 * cell that actually covers what passes beneath it.
 *
 * `motion-reduce:transition-none` because the transition is decorative; the
 * colour still changes, it just stops easing.
 *
 * Selection is `data-selected`, not a class, so a caller can drive it straight
 * from its own checkbox state without composing strings.
 */
export function StudioRow({
  children,
  className,
  selected,
  ...props
}: {
  children: ReactNode;
  className?: string;
  /** Renders the selected tint. Drives `data-selected` for styling only. */
  selected?: boolean;
} & Omit<React.ComponentProps<"tr">, "children" | "className">) {
  return (
    <tr
      data-selected={selected ? "true" : undefined}
      className={cn(
        "border-b border-border bg-card transition-colors duration-(--dur-fast) last:border-0 hover:bg-[color-mix(in_oklab,var(--color-foreground)_3%,var(--color-card))] data-[selected=true]:bg-[color-mix(in_oklab,var(--color-foreground)_5%,var(--color-card))] motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}
