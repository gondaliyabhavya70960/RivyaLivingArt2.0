import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type ActivityEntry = {
  id: string;
  action: string;
  entity: string;
  /** Pre-formatted on the server so hydration stays deterministic. */
  at: string;
  who: string;
};

/**
 * §12.2's "optional right-hand activity panel", fed by the real `ActivityLog`
 * table — the same rows `/studio/activity` paginates, trimmed to the last few.
 *
 * A timeline, not a table: a 1px rule runs down the start edge and each entry
 * hangs off it, which is the one place in the Studio where a list of events
 * earns a line instead of a border. Verb and object are plain words; the mono
 * timestamp carries the metadata, as everywhere else.
 */
export function ActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section
      aria-labelledby="studio-activity-heading"
      className="min-w-0 rounded-card border border-border bg-card p-5 shadow-e1"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="studio-activity-heading"
          className="font-display text-20 leading-tight text-foreground"
        >
          Latest activity
        </h2>
        <Link
          href="/studio/activity"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-input text-small font-medium text-sapphire-ink underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:underline focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
        >
          All
          <ArrowRight aria-hidden strokeWidth={1.5} className="size-3.5" />
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-small leading-relaxed text-graphite">
          Nothing logged yet. Every publish, status change and deletion made in
          the Studio lands here.
        </p>
      ) : (
        <ol className="mt-4 border-s border-border">
          {entries.map((entry) => (
            <li key={entry.id} className="relative ps-5 pb-4 last:pb-0">
              <span
                aria-hidden
                className="absolute start-0 top-2 h-px w-3 bg-border"
              />
              <p className="text-small leading-snug text-foreground">
                <span className="font-medium capitalize">
                  {entry.action.replace(/-/g, " ")}
                </span>{" "}
                <span className="text-graphite">{entry.entity}</span>
              </p>
              <p className="u-micro mt-1">
                {entry.at} · {entry.who}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
