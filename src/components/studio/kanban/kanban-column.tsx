import type { ReactNode } from "react";

/**
 * KanbanEmptyColumn — a lane with nothing in it. Never a blank lane and
 * never an invented promise: the default copy states the fact and stops.
 */
export function KanbanEmptyColumn({
  label = "Nothing at this stage",
}: {
  label?: string;
}) {
  return <p className="u-micro mt-4 px-1">{label}</p>;
}

/**
 * KanbanColumn — one lane: header (icon + label + true count) and either its
 * cards or the empty state. The count comes from the CONSUMER'S server data
 * (the lane may render a capped slice of a longer list), so the header never
 * lies about the lane's real size.
 */
export function KanbanColumn({
  icon,
  label,
  count,
  empty = false,
  emptyLabel,
  children,
}: {
  /** Lane mark from the enum-pinned icon registry, passed in already rendered. */
  icon?: ReactNode;
  label: ReactNode;
  /** The lane's TRUE total, not the number of cards rendered. */
  count: number;
  /** Set when the lane has no cards; `children` is then ignored. */
  empty?: boolean;
  emptyLabel?: string;
  children?: ReactNode;
}) {
  return (
    <li className="w-[19rem] shrink-0">
      <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
        <h3 className="u-micro flex items-center gap-2 text-foreground">
          {icon}
          {label}
        </h3>
        <span className="u-num text-small text-graphite">{count}</span>
      </div>
      {empty ? (
        <KanbanEmptyColumn label={emptyLabel} />
      ) : (
        <ul className="mt-3 space-y-3">{children}</ul>
      )}
    </li>
  );
}
