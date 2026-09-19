/**
 * The shortlist funnel's shared presentational bits — extracted from the
 * review inbox so the inbox grid, the detail sheet and the Kanban board all
 * draw a state and a price the SAME way. One definition per fact; the inbox
 * grew them first and now lends them out.
 */
import { Badge } from "@/components/ui/badge";
import {
  SHORTLIST_STATE_LABELS,
  ShortlistState,
} from "@/lib/scraper/shortlist";

export const STATE_BADGE: Record<
  ShortlistState,
  {
    variant: "default" | "secondary" | "outline" | "success";
    className?: string;
  }
> = {
  NEW: { variant: "outline" },
  REVIEW: { variant: "secondary" },
  SHORTLISTED: { variant: "success" },
  CONFIRMED: { variant: "default" },
  REJECTED: { variant: "secondary", className: "text-muted-foreground" },
  INSPIRATION_ONLY: { variant: "outline" },
  DUPLICATE: { variant: "secondary", className: "text-muted-foreground" },
};

const inr = new Intl.NumberFormat("en-IN");

export const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatPriceRange(
  min: number | null,
  max: number | null,
): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min !== max) {
    return `₹${inr.format(min)} – ₹${inr.format(max)}`;
  }
  return `₹${inr.format((min ?? max) as number)}`;
}

export function StateBadge({ state }: { state: ShortlistState }) {
  const config = STATE_BADGE[state];
  return (
    <Badge variant={config.variant} className={config.className}>
      {SHORTLIST_STATE_LABELS[state]}
    </Badge>
  );
}
