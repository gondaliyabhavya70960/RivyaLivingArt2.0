import { cn } from "@/lib/utils";

/**
 * Right-aligned live `n/max` counter for length-capped text fields — turns
 * `text-destructive` as the value nears the limit so users aren't surprised by
 * a silent cap or a post-submit rejection (UIUX-009). Near the limit it also
 * appends "N left" — so the warning isn't color-only — inside a polite live
 * region that stays empty otherwise, keeping screen readers quiet until the
 * cap actually matters (UIUX-P35).
 */
export function CharCounter({
  length,
  max,
  className,
}: {
  length: number;
  max: number;
  className?: string;
}) {
  const over = length > max;
  const near = length >= max * 0.9;
  return (
    <p
      className={cn(
        "text-end text-xs tabular-nums",
        near || over ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {length}/{max}
      {/* Callers with a maxLength cap can never exceed `max`; the SEO fields
          are uncapped, where "-1 left" is nonsense. Say what is true instead. */}
      <span aria-live="polite">
        {over ? ` — ${length - max} over` : near ? ` — ${max - length} left` : ""}
      </span>
    </p>
  );
}
