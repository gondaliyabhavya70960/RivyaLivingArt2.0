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
        "border-b border-border transition-colors duration-(--dur-fast) last:border-0 hover:bg-foreground/3 data-[selected=true]:bg-foreground/5 motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}
