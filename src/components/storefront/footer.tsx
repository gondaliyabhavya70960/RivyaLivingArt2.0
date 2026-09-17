import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import {
  FacebookIcon,
  InstagramIcon,
  PinterestIcon,
  YoutubeIcon,
} from "@/components/icons/social";
import { Logo } from "@/components/layout/logo";
import { NewsletterForm } from "@/components/sections/newsletter-form";
import { Button } from "@/components/storefront/button";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* Underline reveal on a 1px champagne rule, grown 0% → 100% from the start
   edge via background-size — smoother than text-decoration, zero layout
   shift. py-3/-my-3 pads every link to a ≥44px hit area without shifting the
   visual rhythm; bg-origin-content keeps the rule under the text rather than
   the padding box. ring-focus resolves champagne inside this band's
   data-theme="navy" scope. */
const linkClass =
  "inline-flex items-center rounded-[2px] py-3 -my-3 text-mist bg-origin-content bg-linear-to-r from-champagne/60 to-champagne/60 bg-[length:0%_1px] bg-bottom-left bg-no-repeat transition-[background-size,color] duration-(--dur-fast) ease-(--ease-luxury) hover:bg-[length:100%_1px] hover:text-mineral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none pointer-coarse:min-h-11 pointer-coarse:min-w-11";

/* size-11 = the 44px touch minimum; the glyph stays 16px. */
const socialClass =
  "flex size-11 items-center justify-center rounded-full border border-hairline-dk text-mist transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:border-mineral/45 hover:text-mineral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none";

/** One rendered footer link — href + already-translated label. */
export type FooterNavLink = { label: string; href: string };

/** Studio Site Settings socials — only the URLs the owner filled render. */
export type FooterSocials = {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  pinterest?: string;
};

const SOCIAL_ORDER = ["instagram", "facebook", "youtube", "pinterest"] as const;
const SOCIAL_META: Record<
  (typeof SOCIAL_ORDER)[number],
  { Icon: typeof InstagramIcon; fallbackLabel: string }
> = {
  instagram: {
    Icon: InstagramIcon,
    fallbackLabel: "Rivya Living Art on Instagram (opens in new tab)",
  },
  facebook: {
    Icon: FacebookIcon,
    fallbackLabel: "Rivya Living Art on Facebook (opens in new tab)",
  },
  youtube: {
    Icon: YoutubeIcon,
    fallbackLabel: "Rivya Living Art on YouTube (opens in new tab)",
  },
  pinterest: {
    Icon: PinterestIcon,
    fallbackLabel: "Rivya Living Art on Pinterest (opens in new tab)",
  },
};

/**
 * The footer — REDESIGN.md §5.7.
 *
 * A CTA band ("Have something in mind? Let's make it real.") over a large
 * obsidian footer with **four columns, not a sitemap**: Explore · Studio ·
 * Journal · Contact. The old footer inlined every navigation item the header
 * had just shed, which put the whole IA back on the page it was removed from.
 *
 * Two audit fixes ride here:
 * - **No raw `wa.me` URL as visible link text.** WhatsApp is a labelled
 *   action, like every other contact method.
 * - **The studio address renders as real text**, not only as a Maps link. An
 *   address a visitor cannot copy is not an address.
 *
 * The language control lives here (§5.1 moves it out of the header), on the
 * legal rail where a utility control belongs.
 *
 * Presentational server component: the (v2) layout resolves studio Site
 * Settings and every translated string, then passes them down. The root
 * carries `data-theme="navy"`, so hairlines, secondary ink and the focus ring
 * all resolve for a dark ground.
 */
export function Footer({
  whatsappHref,
  exploreLinks,
  studioLinks,
  journalLinks,
  legalLinks,
  tagline = SITE.tagline,
  phoneDisplay = SITE.phoneDisplay,
  phoneTel = SITE.phoneTel,
  email = SITE.email,
  mapsUrl = SITE.mapsUrl,
  address,
  socials,
  socialLabels,
  ctaEyebrow = "bespoke commissions",
  ctaHeadline = "Have something in mind? Let's make it real.",
  ctaAction = "Start a commission",
  exploreLabel = "Explore",
  studioLabel = "Studio",
  journalLabel = "Journal",
  contactLabel = "Contact",
  newsletterLabel = "Get first access to new pieces.",
  newsletterHint = "Three or four letters a year",
  findStudioLabel = "Open in Maps",
  chatOnWhatsAppLabel = "WhatsApp",
  socialWhatsappLabel = "Rivya Living Art on WhatsApp (opens in new tab)",
  openInNewTabLabel = "(opens in new tab)",
  rightsLine = `© ${new Date().getFullYear()} Rivya Living Art`,
  madeInLabel = "Made in India",
  localeControl,
  className,
}: {
  /** wa.me deep link — the contact column's action AND the social icon. */
  whatsappHref: string;
  /** The four columns, labels already translated (Nav.*). */
  exploreLinks: FooterNavLink[];
  studioLinks: FooterNavLink[];
  journalLinks: FooterNavLink[];
  legalLinks: FooterNavLink[];
  /** Studio Site Settings tagline — the one-line brand statement. */
  tagline?: string;
  phoneDisplay?: string;
  phoneTel?: string;
  email?: string;
  mapsUrl?: string;
  /** Studio address as real, selectable text. Empty until the owner fills it. */
  address?: string;
  socials?: FooterSocials;
  socialLabels?: Partial<Record<keyof FooterSocials, string>>;
  ctaEyebrow?: string;
  ctaHeadline?: string;
  ctaAction?: string;
  exploreLabel?: string;
  studioLabel?: string;
  journalLabel?: string;
  contactLabel?: string;
  newsletterLabel?: string;
  newsletterHint?: string;
  findStudioLabel?: string;
  chatOnWhatsAppLabel?: string;
  socialWhatsappLabel?: string;
  openInNewTabLabel?: string;
  rightsLine?: string;
  madeInLabel?: string;
  /** The locale switcher, rendered on the legal rail (§5.1). */
  localeControl?: ReactNode;
  className?: string;
}) {
  const socialRow = SOCIAL_ORDER.flatMap((key) => {
    const href = socials?.[key];
    if (!href) return [];
    const { Icon, fallbackLabel } = SOCIAL_META[key];
    return [{ key, href, Icon, label: socialLabels?.[key] ?? fallbackLabel }];
  });

  const tCommon = useTranslations("Common");

  return (
    <footer
      data-slot="sf-footer"
      data-theme="navy"
      className={cn("bg-obsidian font-body text-mineral", className)}
    >
      {/* ————— CTA band (§5.7) — and this is also spec §3.1's S9 —————

          S9 asks the page to end on "obsidian, resin-mesh at 30% behind, a
          120px serif line, one champagne pill". That frame cannot be a
          fourteenth section on the homepage: §3.1 forbids two dark grounds
          edge to edge, and this band — obsidian, on every page — is what
          follows immediately. Adding a dark closing section above it would put
          two dark grounds against each other no matter how many of the three
          dark slots were still unspent. (The homepage's own comment says all
          three were spent by "the hero, the material story and the bespoke
          band"; the material story is `bg-mineral` now, so that count is out
          of date, but the adjacency it also cites is not and is the real
          constraint.)

          So S9 lands here, where the page already ends on obsidian: the
          resin-flow texture behind it, and the line stepped up from `text-h2`
          to `text-h1` (40 → 88px). NOT `text-hero`: 120px is S9's number for a
          homepage frame, and this band also closes /privacy and /terms, where
          a 120px line would shout over the page it is ending.

          Two things S9 lists are deliberately absent. The WhatsApp ghost —
          audit §2.4's complaint is that this site has too many competing
          actions, and this band renders on all thirteen routes; one champagne
          pill is the single ask. And the texture is a bundled reference rather
          than a site-image slot, for the same reason `sf-grain` and the
          pour-cure frames are not slots: it is a decorative ground, not
          editorial imagery, and it renders on every page including the ones
          that exist for things going wrong. */}
      <div className="relative overflow-hidden border-b border-hairline-dk">
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/redesign/texture-resin-flow.jpg"
            alt=""
            fill
            sizes="100vw"
            quality={65}
            className="object-cover opacity-30"
          />
          <span className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/80 to-obsidian/55" />
        </div>
        <div className="relative z-10 u-shell section-standard flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <p className="u-micro flex items-center gap-3 text-champagne">
              <span aria-hidden className="block h-px w-6 bg-champagne" />
              {ctaEyebrow}
            </p>
            <p className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display text-mineral">
              {ctaHeadline}
            </p>
          </div>
          <Button asChild variant="premium" size="lg" className="shrink-0">
            <Link href="/custom-order">{ctaAction}</Link>
          </Button>
        </div>
      </div>

      <div className="u-shell">
        {/* ————— Four columns, plus the wordmark and statement ————— */}
        <div className="grid gap-12 py-16 md:grid-cols-12 md:gap-8 md:py-20">
          <div className="flex flex-col gap-6 md:col-span-4">
            <Logo
              wordmarkClassName="h-10"
              className="h-10 text-mineral"
              ariaLabel={tCommon("logoHome")}
              LinkComponent={Link}
            />
            <p className="max-w-[34ch] font-body text-body text-mist">
              {tagline}
            </p>
          </div>

          <FooterColumn
            label={exploreLabel}
            links={exploreLinks}
            className="md:col-span-2"
          />
          <FooterColumn
            label={studioLabel}
            links={studioLinks}
            className="md:col-span-2"
          />
          <FooterColumn
            label={journalLabel}
            links={journalLinks}
            className="md:col-span-2"
          />

          {/* Contact — WhatsApp first, then the things a visitor copies. */}
          <div className="flex flex-col gap-4 md:col-span-2">
            <p className="u-micro text-champagne">{contactLabel}</p>
            <ul className="flex flex-col gap-3 font-body text-14">
              <li>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="footer_contact"
                  className={cn(linkClass, "gap-2.5")}
                >
                  <MessageCircle
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-4 shrink-0 text-whatsapp"
                  />
                  {chatOnWhatsAppLabel}
                  <span className="sr-only"> {openInNewTabLabel}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${phoneTel}`}
                  className={cn(linkClass, "gap-2.5")}
                >
                  <Phone
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-4 shrink-0 text-mist/60"
                  />
                  <span className="u-num">{phoneDisplay}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className={cn(linkClass, "gap-2.5 break-all")}
                >
                  <Mail
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-4 shrink-0 text-mist/60"
                  />
                  {email}
                </a>
              </li>
            </ul>

            {/* The studio, as real text — an address a visitor can select and
                paste, with the Maps link as a secondary affordance. */}
            {address ? (
              <address className="flex gap-2.5 font-body text-14 leading-relaxed text-mist not-italic">
                <MapPin
                  aria-hidden
                  strokeWidth={1.5}
                  className="mt-1 size-4 shrink-0 text-mist/60"
                />
                <span className="flex flex-col gap-1">
                  <span className="whitespace-pre-line">{address}</span>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(linkClass, "u-micro w-fit")}
                  >
                    {findStudioLabel}
                    <span className="sr-only"> {openInNewTabLabel}</span>
                  </a>
                </span>
              </address>
            ) : (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(linkClass, "gap-2.5 text-14")}
              >
                <MapPin
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4 shrink-0 text-mist/60"
                />
                {findStudioLabel}
                <span className="sr-only"> {openInNewTabLabel}</span>
              </a>
            )}
          </div>
        </div>

        {/* ————— Newsletter (§5.8) — one component, two placements ————— */}
        <div className="grid gap-6 border-t border-hairline-dk py-10 md:grid-cols-12 md:items-center">
          <div className="flex flex-col gap-2 md:col-span-5">
            <label
              htmlFor="newsletter-email-footer"
              className="font-body text-body text-mineral"
            >
              {newsletterLabel}
            </label>
            <p className="u-micro">{newsletterHint}</p>
          </div>
          <NewsletterForm
            source="footer"
            inputId="newsletter-email-footer"
            className="md:col-span-7"
          />
        </div>

        {/* ————— Socials + the single legal rail ————— */}
        <div className="flex flex-col gap-6 border-t border-hairline-dk py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            {socialRow.map(({ key, href, Icon, label }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={socialClass}
              >
                <Icon aria-hidden strokeWidth={1.5} className="size-4" />
              </a>
            ))}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="footer_social"
              aria-label={socialWhatsappLabel}
              className={socialClass}
            >
              <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {localeControl}
            <p className="u-micro">{rightsLine}</p>
            {legalLinks.map((link) => (
              <span key={link.href} className="flex items-center gap-3">
                <span aria-hidden className="u-micro">
                  ·
                </span>
                <Link href={link.href} className={cn(linkClass, "u-micro")}>
                  {link.label}
                </Link>
              </span>
            ))}
            <span aria-hidden className="u-micro">
              ·
            </span>
            <p className="u-micro">
              {madeInLabel}{" "}
              <span aria-hidden className="text-champagne">
                &#10022;
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  label,
  links,
  className,
}: {
  label: string;
  links: FooterNavLink[];
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-4", className)}>
      <p className="u-micro text-champagne">{label}</p>
      <ul className="flex flex-col gap-3 font-body text-14">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
