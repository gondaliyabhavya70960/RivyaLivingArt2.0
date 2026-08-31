import type { ReactNode } from "react";

/** Card wrapper for one titled block of a studio form. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
