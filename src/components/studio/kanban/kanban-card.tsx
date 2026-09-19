import { cn } from "@/lib/utils";

/**
 * KanbanCardShell — the card chrome: border, card surface, shadow, and the
 * busy fade while its move is in flight. Content is the consumer's — a
 * commission, a product, a staged scrape — the shell owns none of it.
 */
export function KanbanCardShell({
  busy = false,
  children,
}: {
  busy?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "rounded-card border border-border bg-card p-3 shadow-e1 transition-opacity duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
        busy && "opacity-60",
      )}
    >
      {children}
    </article>
  );
}

export type KanbanMoveOption<S extends string> = {
  value: S;
  label: string;
};

/**
 * KanbanMoveSelect — THE move control, present on every card.
 *
 * The accessible path is the primary path, not the fallback (KANBAN-SPEC):
 * a native select is reachable with a single Tab, works on a phone, and is
 * one pointer interaction with no drop target to miss. The consumer wires
 * `onMove` to the entity's EXISTING Server Action — this component never
 * decides where a card may go; the options the consumer passes ARE the
 * state machine (a guard that hides a transition hides it everywhere).
 */
export function KanbanMoveSelect<S extends string>({
  value,
  options,
  disabled = false,
  onMove,
  ariaLabel,
}: {
  value: S;
  options: readonly KanbanMoveOption<S>[];
  disabled?: boolean;
  onMove: (next: S) => void;
  /** The card's accessible name for the control — names whose move this is. */
  ariaLabel: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{ariaLabel}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onMove(event.target.value as S)}
        className="min-h-9 rounded-input border border-field bg-transparent px-2 text-small text-foreground outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-sapphire-ink/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40 motion-reduce:transition-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
