import { CharCounter } from "@/components/ui/char-counter";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Google truncates around here. Not a hard cap — a budget worth seeing. */
const TITLE_BUDGET = 60;
const DESCRIPTION_BUDGET = 160;
/** Under this, Google usually writes its own snippet instead. */
const DESCRIPTION_FLOOR = 70;

/**
 * What this page will look like in a search result — the one thing SEO editing
 * had no feedback for.
 *
 * Every SEO field in the Studio was a bare input: no length budget, no preview,
 * no warning. So the two failures that actually cost traffic — a description
 * nobody wrote, and a title long enough that the brand suffix truncates it —
 * were invisible until a crawler found them. `CharCounter` already existed and
 * already goes destructive at 90% of a cap; it simply was not wired to
 * anything here.
 *
 * **The suffix is the point.** `src/app/shared-metadata.ts:14` sets the title
 * template to `%s · ResinRiva`, so a page title is never rendered alone: the
 * separator and brand are appended at build time and count against the same
 * budget. Editing a 58-character title against a 60-character budget looks
 * fine and ships truncated. This previews the FULL rendered string and
 * truncates on a word boundary the way a search result does, so the cost of
 * the suffix is visible while typing.
 *
 * Server-safe: no state, no effects — it re-renders from the form's own value.
 */
export function SerpPreview({
  title,
  description,
  path,
  className,
}: {
  /** The page's own title, WITHOUT the brand suffix. */
  title: string;
  description: string;
  /** Site-root path, e.g. `/shop` or `/product/varmala-frame`. */
  path: string;
  className?: string;
}) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  // The homepage default carries its own brand and gets no template applied;
  // everything else is `%s · ResinRiva`.
  const full = trimmedTitle ? `${trimmedTitle} · ${SITE.name}` : "";
  const overTitle = full.length > TITLE_BUDGET;
  const noDescription = trimmedDescription.length === 0;
  const shortDescription =
    !noDescription && trimmedDescription.length < DESCRIPTION_FLOOR;

  // Cut on a word boundary rather than mid-word, which is what a search result
  // does and what makes the loss legible.
  const shownTitle = overTitle
    ? // Trim to a word boundary, then drop a separator or dash left dangling
      // at the cut — "… 3D Printing ·…" reads as a typo rather than a cut.
      `${full
        .slice(0, TITLE_BUDGET - 1)
        .replace(/\s+\S*$/, "")
        .replace(/[\s·—–-]+$/, "")}…`
    : full;

  const host = SITE.url.replace(/^https?:\/\//, "");

  return (
    <div
      data-slot="serp-preview"
      className={cn("rounded-card border border-border bg-muted/40 p-4", className)}
    >
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Search result preview
      </p>

      <div className="mt-3">
        <p className="truncate text-xs text-muted-foreground">
          {host}
          {path}
        </p>
        <p
          className={cn(
            "mt-0.5 text-lg leading-snug",
            overTitle ? "text-destructive" : "text-sapphire-ink",
          )}
        >
          {shownTitle || (
            <span className="text-destructive">No title — this page has none.</span>
          )}
        </p>
        <p
          className={cn(
            "mt-1 text-sm leading-relaxed",
            noDescription ? "text-destructive" : "text-foreground/80",
          )}
        >
          {noDescription
            ? "No description — Google will pick a sentence from the page for you."
            : trimmedDescription}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Title, with “ · {SITE.name}”
          </p>
          <CharCounter length={full.length} max={TITLE_BUDGET} className="text-start" />
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Description
          </p>
          <CharCounter
            length={trimmedDescription.length}
            max={DESCRIPTION_BUDGET}
            className="text-start"
          />
        </div>
      </div>

      {overTitle ? (
        <p className="mt-2 text-sm text-destructive">
          Over {TITLE_BUDGET} characters once “ · {SITE.name}” is added — the end
          will be cut off in search results.
        </p>
      ) : null}
      {shortDescription ? (
        <p className="mt-2 text-sm text-warning">
          Under {DESCRIPTION_FLOOR} characters — Google is likely to write its own
          snippet instead of using this one.
        </p>
      ) : null}
    </div>
  );
}
