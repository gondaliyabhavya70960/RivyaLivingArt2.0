import type { ReactNode } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * §2.10 · THE SHARED SYSTEM-PAGE SHELL.
 *
 * One layout for every page that renders when the normal page could not: 403,
 * 410, 429, maintenance, session-expired, and the post-inquiry thank-you.
 * Its shape is §2.10's list, in the order a stuck visitor needs it:
 *
 *   full-bleed obsidian · mono eyebrow carrying the index · one Instrument
 *   Serif statement sentence · one short Inter support line · one primary
 *   action plus text secondaries · optional faint atmosphere · a footer strip
 *   of WhatsApp · Home · Shop
 *
 * **No nav and no footer link farm.** That is §2.10's rule and it is the one
 * that makes this a system page rather than a thin content page: a person who
 * has hit a wall needs three ways out, not thirty, and the error family
 * renders outside the `(v2)` route group anyway — there is no header or footer
 * here to inherit.
 *
 * `data-system-page` on the `<main>` is how `scripts/redesign-audit.mjs` knows
 * that. Its header-contrast rule measures the sticky header against the pixels
 * behind it and FAILS a route that has none — correctly, because a header that
 * silently fails to mount is exactly the regression that rule exists to catch.
 * On these pages the absence is the specification, so the marker turns that
 * failure into a note. It is a MARKER and not a list of routes in the audit,
 * because a route is exempt for what it is: a seventh system page added next
 * year is covered on the day it is written, where a hardcoded list would fail
 * it and send someone to read a gate they had no reason to suspect.
 *
 * ## Why this is a component and not six copies
 *
 * `[locale]/not-found.tsx` shipped this layout first and shipped it well. The
 * five pages added alongside it either reuse it or diverge from it by
 * accident, and "by accident" is what a shell exists to prevent — an eyebrow
 * that is mono on four pages and sans on the fifth is the tell that nobody
 * owns the set.
 *
 * **The 404 itself is deliberately NOT refactored onto this.** It carries
 * three things no other page in the family has — a working search form, four
 * real catalogue doorways, and the `visual-404.jpg` veil weighted to the
 * reading order with measured contrast — and every one of them is §11.11
 * content specific to being lost, not shell. Folding it in would mean
 * parameterising the shell until it was a description of one page with five
 * degenerate cases. It stays as it is; this file matches its register.
 *
 * ## Never on any of these pages
 *
 * A product name, a price, or a maker portrait. A system page is rendered at
 * the moment the catalogue is least trustworthy — mid-error, mid-maintenance,
 * mid-rate-limit — and a product shown there is a claim made with no data
 * behind it.
 *
 * ## The reference code
 *
 * `ERR-<route>-<4 hex>` is COSMETIC and says so to the reader. There is no
 * logging sink in this project that can look one up, so it is a string a
 * person can quote in a WhatsApp message and nothing more. It is deliberately
 * not called a "correlation id" and deliberately not shaped like one: faking
 * an id that support cannot resolve wastes the one exchange where the visitor
 * is still willing to talk.
 */

export type SystemAction = {
  label: string;
  href: string;
  /** Opens in a new tab — WhatsApp, maps. Adds the rel pair and the sr hint. */
  external?: boolean;
  /** Announced suffix for an external link, e.g. "(opens in new tab)". */
  externalHint?: string;
  /** Analytics hook, matching the storefront's existing `data-wa-source`. */
  waSource?: string;
};

export type SystemPageProps = {
  /** Mono, uppercase, carries the index: `404 · missing piece`. */
  eyebrow: string;
  /** ONE sentence, Instrument Serif. Never two. */
  statement: string;
  /** ONE short line, Inter. */
  support: string;
  /** The single primary action. Omitted on 429, which has only a countdown. */
  primary?: SystemAction;
  /** Text secondaries — never more than three, per §2.10's "one action". */
  secondaries?: SystemAction[];
  /**
   * Anything that is neither statement nor action: the 429 countdown, the
   * maintenance notify-me field, the thank-you's inquiry number. Rendered
   * between the support line and the actions.
   */
  children?: ReactNode;
  /**
   * The cosmetic reference code. Pass the already-composed string — the caller
   * knows its own route, and generating it here would mean this component
   * inventing a route name it cannot verify.
   */
  reference?: string;
  /** The footer strip. Three links, always the same three. */
  footer: {
    whatsapp: SystemAction;
    home: SystemAction;
    shop: SystemAction;
  };
  /**
   * Faint atmosphere behind the content. §2.10: "optional faint resin/meniscus
   * still, never a stock-illustration dump." Bundled paths only — a system
   * page must not depend on the database or on a remote host, since the reason
   * it is rendering may be that one of those is down.
   */
  atmosphere?: { src: string; opacity?: number };
  className?: string;
};

function ActionLink({
  action,
  className,
}: {
  action: SystemAction;
  className: string;
}) {
  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...(action.waSource ? { "data-wa-source": action.waSource } : {})}
      >
        {action.label}
        {action.externalHint ? (
          <span className="sr-only"> {action.externalHint}</span>
        ) : null}
      </a>
    );
  }
  // A plain <a>, not next/link, and that is on purpose across this whole
  // family: these pages render at error and interrupt boundaries where the
  // router's own state is the thing that may be broken. A full document load
  // is the reliable way out, and on a page a visitor reaches once, the
  // prefetch a Link would buy is worth nothing.
  return (
    <a href={action.href} className={className}>
      {action.label}
    </a>
  );
}

const PRIMARY_CLASS = [
  "inline-flex h-12 items-center justify-center rounded-full px-7",
  "border border-champagne bg-transparent font-body text-16 font-medium text-champagne",
  "transition-colors duration-(--dur-fast) ease-(--ease-luxury) motion-reduce:transition-none",
  "hover:bg-champagne hover:text-obsidian",
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
].join(" ");

const SECONDARY_CLASS = [
  "inline-flex min-h-11 items-center font-body text-16 text-mineral underline-offset-4",
  "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
  "hover:text-champagne hover:underline",
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
].join(" ");

const FOOTER_CLASS = [
  // `min-w-11` as well as `min-h-11`, and it is not belt-and-braces: these
  // labels are single short words — "Home" measured 33px wide at 390px — so
  // the height floor alone left a 33×44 target under Part 13's 44px minimum.
  // `redesign-audit.mjs` only FAILS the tap floor at phone widths (it drives a
  // touch-capable context below 700px and reports it as a note above), which
  // is exactly why it has to be run at 390 and not only at 1440.
  // `justify-center` keeps the label centred in the widened box rather than
  // pinned to the start edge with dead space after it.
  "u-micro inline-flex min-h-11 min-w-11 items-center justify-center text-mist",
  "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
  "hover:text-champagne",
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
].join(" ");

export function SystemPage({
  eyebrow,
  statement,
  support,
  primary,
  secondaries = [],
  children,
  reference,
  footer,
  atmosphere,
  className,
}: SystemPageProps) {
  return (
    /* The route-group split put <main id="main-content"> inside the group
       layouts, which do not wrap these boundaries — so the skip-link target
       is provided here, or the root layout's anchor dangles on every one of
       these pages. */
    <main id="main-content" data-system-page className="flex-1">
      <section
        /* `data-theme="navy"` is a no-op scope after D30 (tokens.css) and is
           kept for exactly one reason: the ~88 `in-data-[theme=navy]:`
           utilities in src/ still read it, so a component dropped into this
           shell resolves its dark-band branch rather than its base. It is not
           what makes this section dark — `bg-obsidian` is. */
        data-theme="navy"
        className={cn(
          "relative flex min-h-svh flex-col justify-center overflow-hidden bg-obsidian text-mineral",
          className,
        )}
      >
        {atmosphere ? (
          <div aria-hidden className="absolute inset-0">
            <Image
              src={atmosphere.src}
              alt=""
              fill
              sizes="100vw"
              quality={65}
              /* No `priority`. The statement should paint first; a decorative
                 backdrop that delays it trades the page's actual content for
                 atmosphere, and on a page whose whole job is to tell someone
                 what happened that is the wrong trade. */
              className="object-cover"
              style={{ opacity: atmosphere.opacity ?? 0.35 }}
            />
            {/* The veil is what keeps every text node above 4.5:1 over the
                brightest frame of whatever sits behind it. It is opaque under
                the reading column and thins toward the end edge, where there
                is only the footer strip's short mono text. */}
            <span className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-obsidian/60" />
          </div>
        ) : null}

        <div className="relative z-10 u-shell flex flex-col gap-8 py-24">
          <div className="flex max-w-2xl flex-col gap-6">
            {/* §3.1 caps champagne at TWO visible objects per viewport, and
                this page class spends both deliberately: the eyebrow's words
                and the primary pill. So the champagne sits on the TEXT rather
                than on the paragraph — a `text-champagne` on the <p> is
                inherited by the decorative dash beside it, which paints mist
                and still reports a champagne `color`, spending one of the two
                on a 24px rule nobody reads as an accent. Measured, not
                theorised: `redesign-audit.mjs` counted it. */}
            <p className="u-micro flex items-center gap-3">
              <span aria-hidden className="block h-px w-6 bg-mist/60" />
              <span className="text-champagne">{eyebrow}</span>
            </p>
            {/* ONE sentence. The type is `text-h1`, not `text-hero`: a system
                page is a message, and hero scale on an apology is shouting. */}
            <h1 className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display text-mineral">
              {statement}
            </h1>
            <p className="u-lede font-body text-body leading-relaxed text-mist">
              {support}
            </p>
          </div>

          {children ? <div className="max-w-2xl">{children}</div> : null}

          {primary || secondaries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              {primary ? (
                <ActionLink action={primary} className={PRIMARY_CLASS} />
              ) : null}
              {secondaries.map((action) => (
                <ActionLink
                  key={action.href + action.label}
                  action={action}
                  className={SECONDARY_CLASS}
                />
              ))}
            </div>
          ) : null}

          {reference ? (
            /* `u-num` for the tabular figures, and `select-all` because the
               only thing anyone will ever do with this string is copy it into
               a WhatsApp message. */
            <p className="u-micro u-num select-all text-mist/70">{reference}</p>
          ) : null}
        </div>

        {/* §2.10's footer strip: WhatsApp · Home · Shop. Three links, the same
            three on every page in the family, so a visitor who lands on two of
            these in a row finds the way out in the same place both times. */}
        <div className="relative z-10 u-shell border-t border-hairline-dk py-6">
          <nav aria-label="Ways out">
            <ul className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {[footer.whatsapp, footer.home, footer.shop].map((action) => (
                <li key={action.href + action.label}>
                  <ActionLink action={action} className={FOOTER_CLASS} />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </main>
  );
}
