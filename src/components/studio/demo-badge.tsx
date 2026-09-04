import { Badge } from "@/components/ui/badge";

/**
 * Marks a studio list row backed by a Content Lab fixture (`isDemo: true`) —
 * never a real product, post, piece, FAQ, page or inquiry the owner entered.
 * Secondary tone so it reads as a fact about provenance, not a status the row
 * can move through.
 *
 * `product-list.tsx` already renders an outline "DEMO" badge inline (audit
 * M-A1) — left as-is there rather than swapped in, since it participates in
 * that row's own flex-wrap layout; every OTHER list gains this one.
 */
export function DemoBadge() {
  return <Badge variant="secondary">Demo</Badge>;
}
