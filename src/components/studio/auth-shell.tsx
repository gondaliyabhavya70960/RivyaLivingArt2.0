import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { getSiteImage } from "@/lib/site-images-server";

/**
 * Shared frame for every /studio auth page — REDESIGN.md §12.1.
 *
 *   Split screen. Left: the panel on a solid surface with RESINRIVA /
 *   OWNER & STAFF ACCESS. Right: a dark cinematic studio image with
 *   `RESINRIVA · STUDIO` in mono, bottom-left.
 *   Mobile: the image becomes a 28vh top band.
 *
 * Three decisions the markup does not explain:
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
  const backdrop = await getSiteImage("studio.login");

  return (
    <div className="flex min-h-svh flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Cinematic studio band. Ambience only — the accessible name of this
          screen is the h1 in the panel, so the picture takes alt="". */}
      <div className="relative order-first h-[28svh] w-full shrink-0 overflow-hidden bg-obsidian lg:order-last lg:h-auto lg:min-h-svh">
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          sizes="(max-width: 1023px) 100vw, 55vw"
          className="object-cover"
        />
        {/* Depth scrim — strongest at the bottom, where the mono mark sits. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/25 to-obsidian/40"
        />
        <p
          data-theme="navy"
          className="u-micro absolute bottom-5 start-5 text-mist lg:bottom-8 lg:start-8"
        >
          RESINRIVA · STUDIO
        </p>
      </div>

      {/* Panel */}
      <div className="flex flex-1 flex-col justify-center bg-background px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-[26rem]">
          <Logo className="h-8 text-ink transition-opacity hover:opacity-90" />
          <p className="u-micro mt-3">OWNER &amp; STAFF ACCESS</p>

          <h1 className="mt-6 font-display text-h3 leading-[1.1] tracking-display text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-[34ch] text-small leading-relaxed text-graphite">
              {subtitle}
            </p>
          )}

          <div className="mt-8">{children}</div>

          {footer && (
            <div className="mt-8 border-t border-border pt-5 text-small text-graphite">
              {footer}
            </div>
          )}

          <Link
            href="/"
            className="mt-8 inline-flex min-h-11 items-center rounded-input text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            ← Back to the store
          </Link>
        </div>
      </div>
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
