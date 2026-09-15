import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { SlotImage } from "@/components/storefront/slot-image";
import { getSiteImageRefs } from "@/lib/site-images-server";

/**
 * Shared frame for every /studio auth page — REDESIGN.md §12.1.
 *
 *   Split screen. Left: the panel on a solid surface with RIVYA LIVING ART /
 *   OWNER & STAFF ACCESS. Right: a dark cinematic studio image with
 *   `RIVYA LIVING ART · STUDIO` in mono, bottom-left.
 *   Mobile: the image becomes a 28vh top band.
 *
 * Eight decisions the markup does not explain:
 *
 * 1. **The image is `order-first` on mobile, `order-last` at `lg`.** One DOM
 *    order would either put a decorative band ahead of the form for a screen
 *    reader, or leave the band under the fold on a phone. It is `aria-hidden`
 *    ambience either way, so flex order carries the layout and the form always
 *    stays the first meaningful thing in the accessible tree.
 * 2. **The panel ground is `bg-background`, not a card.** Part 3.5 removes boxes:
 *    the split itself is the separation, so there is no card, no shadow and no
 *    second border inside the left half.
 * 3. **`min-h-svh`, not `min-h-screen`.** On mobile Safari the 28vh band plus
 *    a keyboard-raised viewport pushes `Sign in` off a `100vh` screen.
 * 4. **Dividers inside the panel are `border-border`, never the `rule`
 *    utility.** `rule` is `--hairline`, `rgba(18,20,26,.12)` — a DARK line, and
 *    the `.studio-v2` scope carries a `prefers-color-scheme: dark` block that
 *    turns this panel obsidian. `--border` is the semantic token that flips to
 *    `--hairline-dk` with it, so these seams survive a dark Studio; a `rule`
 *    here would vanish. The band below is the mirror case: it is obsidian in
 *    BOTH schemes, so its divider is `rule-dk` unconditionally.
 * 5. **The backdrop goes through `SlotImage`, not a bare `<Image>`.**
 *    `getSiteImage()` returns only a URL, so this screen used to throw away
 *    three things the owner had already set on the `studio.login` slot: the
 *    focal point, the separate phone crop, and the LQIP blur. On the 28svh
 *    mobile band the missing phone crop is the visible one — a 16:9 studio
 *    frame centre-cropped into a letterbox keeps the middle and drops exactly
 *    the composition the owner chose. `SlotImage` forwards all three.
 * 6. **The panel is a `<main>`, and the only one on the page.** All four auth
 *    screens used to be `<div>`s the whole way down, so a screen-reader user
 *    landed on four pages with no landmark to jump to and axe reported
 *    `landmark-one-main` on every one of them. The band is `aria-hidden`
 *    ambience, so the panel is the page's content and nothing else competes
 *    for the role. Nothing gated this: `studio-audit.mjs` signs in THROUGH
 *    /studio/login without ever auditing it, and the a11y sweep covers the
 *    storefront only.
 * 7. **The subtitle measure is `u-lede`, not a `ch` value of its own.** It was
 *    `max-w-[34ch]` — a number off the type scale, which Part 3 does not
 *    define and CLAUDE.md forbids inventing. `u-lede` (52ch) is wider than the
 *    26rem panel, so the panel's own width becomes the measure and the
 *    subtitle now aligns with the h1 and the form beneath it instead of
 *    wrapping short against them.
 * 8. **The panel is three hairline-separated zones** — identity, then the ask,
 *    then the way out. Before this it was one uniform `mt-6/mt-8` stack, which
 *    gave a staffer no signal about where the brand block ended and the thing
 *    they came to do began, and left `← Back to the store` orphaned below the
 *    footer note as a second competing exit. They now share one closing row.
 *
 * The band's picture is the `studio.login` slot, so the owner can change it
 * from /studio/site-images. Resolved here rather than threaded through a prop:
 * all four auth pages are server components, and six call sites should not
 * each have to remember to pass the same image.
 */
export async function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const backdrop = (await getSiteImageRefs())["studio.login"];

  return (
    <div className="flex min-h-svh flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Cinematic studio band. Ambience only — the accessible name of this
          screen is the h1 in the panel, so the picture takes alt="". */}
      <div className="relative order-first h-[28svh] w-full shrink-0 overflow-hidden border-champagne/25 bg-obsidian max-lg:border-b lg:order-last lg:h-auto lg:min-h-svh lg:border-s">
        <SlotImage
          slot={backdrop}
          alt=""
          fill
          priority
          /* Wider than the box, because the box is TALLER than the picture.
             `object-cover` on a 16:9 master in a full-height column scales by
             HEIGHT: at 1440×900 the band is ~754×900, so the image is drawn
             1613 CSS px wide and only ~754 of it is visible. The old
             `55vw` asked next/image for a 828px source and then stretched it
             to twice that, which is why the backdrop read as a blur. */
          sizes="(max-width: 1023px) 110vw, 115vw"
          className="object-cover"
        />
        {/* Depth scrim. Monotonic — it used to ramp 85 → 25 → 40, so it got
            DARKER again towards the top and pressed a grey band across the
            middle of the photograph. One direction only: opaque where the
            mono mark sits, clear where the picture should be. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-45% via-obsidian/25 to-obsidian/0"
        />
        {/* The mark, anchored. A short rule above it is what turns a line of
            text floating over a photograph into a caption — the same device
            every editorial band on the storefront uses. */}
        <div
          data-theme="navy"
          className="absolute bottom-5 start-5 end-5 lg:bottom-8 lg:start-8 lg:end-8"
        >
          <div aria-hidden className="rule-dk w-10" />
          <p className="u-micro mt-3 text-mist">RIVYA LIVING ART · STUDIO</p>
        </div>
      </div>

      {/* Panel */}
      <main className="flex flex-1 flex-col bg-background px-6 pt-8 pb-10 max-lg:justify-start sm:px-10 lg:justify-center lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-[26rem]">
          {/* Zone 1 — identity. */}
          <Logo className="h-8 text-ink transition-opacity hover:opacity-90" />
          <p className="u-micro mt-3">OWNER &amp; STAFF ACCESS</p>

          {/* Zone 2 — the ask. */}
          <div className="mt-7 border-t border-border pt-7">
            <h1 className="font-display text-h3 leading-h3 tracking-display text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="u-lede mt-2 text-small leading-relaxed text-graphite">
                {subtitle}
              </p>
            )}

            <div className="mt-7">{children}</div>
          </div>

          {/* Zone 3 — the way out. One row, so the panel has a single closing
              edge rather than a footer note and a stray link beneath it. */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-5">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-input text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              ← Back to the store
            </Link>
            {footer && (
              <div className="text-small text-graphite">{footer}</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Inline banner used across the auth pages. §12.1: an invalid sign-in is ONE
 * generic message above the form, never field-specific — so this is deliberately
 * the only error surface the login screen has.
 */
export function AuthBanner({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    // A 2px start-rule instead of a full box (Part 3.5: hairlines, not boxes).
    error: "border-alert/60 bg-alert/8 text-alert",
    success: "border-success/60 bg-success/8 text-success",
    info: "border-border bg-card text-graphite",
  } as const;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-input border-s-2 px-4 py-3 text-small leading-relaxed ${tones[tone]}`}
    >
      {children}
    </p>
  );
}
