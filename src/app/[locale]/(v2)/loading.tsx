/**
 * The storefront's ROOT loading boundary — §2.10's last row, and the one the
 * five existing `loading.tsx` files left a hole in.
 *
 * Five sub-routes already have one (`blog`, `portfolio`, `search`, `shop`,
 * `whatsapp-order`). Every other public route — the homepage, the PDP,
 * `/about`, `/process`, `/contact`, `/custom-order`, `/workshops`, `/faq`, the
 * legal pages, the landing pages — fell through to nothing, which on a slow
 * connection is a blank obsidian screen with the chrome already painted around
 * it. This is the fallback for all of them.
 *
 * ## It matches the shell 1:1, which is the whole specification
 *
 * §2.10: "matches the shell 1:1, no CLS." A skeleton whose geometry differs
 * from the page it stands in for does not reduce the wait, it relocates it —
 * the content arrives and everything jumps. So the block sizes here are the
 * ones the storefront's own page shells use: `section-standard` vertical
 * rhythm, `u-shell` rail, an `text-h1`-height heading band, a `u-lede`-width
 * support line, and a three-up card row at the ratio the catalogue cards use.
 *
 * ## No spinner
 *
 * The loading taxonomy puts a spinner on an inline operation and a SKELETON on
 * a page. A centred spinner tells a visitor that something is happening; a
 * skeleton tells them what is about to be there, which is the more useful of
 * the two and the only one that can hold layout.
 *
 * ## The pulse is static under reduced motion
 *
 * `animate-pulse` collapses through the global `@media` rule in tokens.css, so
 * the blocks simply sit at their resting opacity. That is a complete state,
 * not a degraded one: the geometry is doing the work, and the shimmer was only
 * ever saying "not yet".
 *
 * `aria-hidden` on the whole thing, with one polite live region carrying the
 * word. Announcing fourteen empty boxes is worse than announcing nothing; the
 * `role="status"` line is what a screen reader should hear.
 */
export default function StorefrontLoading() {
  return (
    <main id="main-content" className="flex-1">
      <p role="status" className="sr-only">
        Loading
      </p>
      <div aria-hidden className="u-shell section-standard">
        <div className="flex flex-col gap-6">
          {/* Eyebrow · heading · lede — the opening of every storefront page. */}
          <div className="h-3 w-32 animate-pulse rounded-full bg-elev-2" />
          <div className="h-[clamp(2.5rem,4.5vw+0.5rem,5.5rem)] w-full max-w-[14ch] animate-pulse rounded-image bg-elev-2" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-full max-w-[52ch] animate-pulse rounded-full bg-elev-1" />
            <div className="h-4 w-full max-w-[38ch] animate-pulse rounded-full bg-elev-1" />
          </div>
        </div>

        {/* A three-up row at the catalogue card's own 4:5 ratio, so a shop or
            collection page resolves into exactly this footprint. */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="aspect-[4/5] w-full animate-pulse rounded-image bg-elev-1" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-elev-1" />
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-elev-1" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
