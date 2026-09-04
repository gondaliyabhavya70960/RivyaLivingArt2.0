import type { ReactNode } from "react";

/**
 * Shared numbered-label wrapper for every design-lab tab — the same
 * `01 · Title` mono treatment the old kitchen sink used, kept as one
 * component so a spacing change lands once.
 */
export function LabSection({
  index,
  title,
  children,
}: {
  index: number;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-mono text-12 text-champagne-ink">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-display text-25 text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}
