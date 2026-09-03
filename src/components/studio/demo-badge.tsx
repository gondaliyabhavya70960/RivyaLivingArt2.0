import { Badge } from "@/components/ui/badge";

/**
 * Marks a row as Content Lab fixture content in a Studio list or detail
 * screen — never a real product, post, case study, testimonial or inquiry.
 *
 * Minimal placeholder: this batch (G — Content Lab) needed a demo marker
 * before the wave-1 batch that owns the canonical version had landed in this
 * worktree. Kept intentionally small (a styled `Badge`, nothing else) so the
 * merge can keep whichever copy carries more — see the batch's SHARED-FILE
 * NOTES.
 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      Demo
    </Badge>
  );
}
