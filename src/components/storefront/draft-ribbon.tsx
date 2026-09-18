import { draftMode } from "next/headers";

/**
 * The preview ribbon.
 *
 * Mounted in the storefront layout and renders nothing unless the staff
 * draft-mode cookie is set, so a visitor never sees it. It exists because the
 * failure mode of a good preview is forgetting you are in one: staff read the
 * staged copy, believe it is live, and report a bug that is really a draft.
 *
 * Server component on purpose — `draftMode()` is a request API, and reading it
 * here keeps the route ISR-cacheable exactly as the page-level reads do.
 *
 * The exit link is a plain `<a>` rather than any `Link`, and the lint rule is
 * suppressed for it on purpose. Three reasons, all of which `Link` breaks:
 * it targets a route HANDLER rather than a page; the locale-aware `Link` would
 * prefix it into `/hi/api/draft`, which does not exist; and clearing the
 * draft-mode cookie needs a full navigation, since a client-side transition
 * would re-render from a tree that still believes it is in preview.
 */
export async function DraftRibbon() {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-(--z-ribbon) flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-alert px-4 py-2 text-center font-mono text-12 tracking-[0.12em] text-obsidian uppercase"
    >
      <span>Preview — showing changes that are not published</span>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/draft?disable=1"
        className="underline underline-offset-4 hover:no-underline"
      >
        Leave preview
      </a>
    </div>
  );
}
