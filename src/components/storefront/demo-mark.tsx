import { cn } from "@/lib/utils";

/**
 * The demo-content mark (owner decision D7+D8+D14): every demo row rendered
 * on a database with demo content turned visible carries this beside it, so
 * a visitor never mistakes a seeded example for a real listing or review.
 *
 * Never champagne — Part 3.1 reserves that role for "a tiny highlight", and
 * a demo mark is metadata, not something to draw the eye toward. Plain mono
 * graphite (mist inside a dark band) reads the same as every other eyebrow.
 * A server component: the mark itself needs no interactivity, only the
 * translated label its callers already have from `useTranslations`/
 * `getTranslations` (`Common.demoMark`).
 */
export function DemoMark({
  label,
  className,
}: {
  /** Translated, e.g. `Common.demoMark` ("DEMO CONTENT"). */
  label: string;
  className?: string;
}) {
  return (
    <span
      data-slot="sf-demo-mark"
      className={cn(
        "u-micro text-graphite in-data-[theme=navy]:text-mist",
        className,
      )}
    >
      {label}
    </span>
  );
}
