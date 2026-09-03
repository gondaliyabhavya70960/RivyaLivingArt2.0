import { cn } from "@/lib/utils";

/**
 * The visible "this is a seeded fixture, not a customer" mark (owner
 * decision, 2026-09-03 session): every demo row the storefront is allowed to
 * show (`SiteSettings.demoContentPublic`, or any non-production
 * environment) carries this wherever it renders, so a visitor — or a
 * search-engine crawler that ignores `noindex` — is never left reading a
 * fabricated review or case study as if it were real.
 *
 * Presentational only: the caller supplies the translated `label` (e.g.
 * `t("Common.demoMark")`) rather than this component resolving its own copy,
 * so it stays usable from both server and client parents without forcing a
 * `next-intl` dependency on either.
 *
 * NOTE — this file is expected to also be introduced by batch A1
 * (`docs/…` wave-1 plan, file ownership table). Whichever lands first is
 * authoritative; the other's identical copy is a no-op merge, not a
 * conflict to resolve by hand.
 */
export function DemoMark({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span data-slot="sf-demo-mark" className={cn("u-micro", className)}>
      {label}
    </span>
  );
}
