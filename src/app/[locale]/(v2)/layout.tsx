import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { DraftRibbon } from "@/components/storefront/draft-ribbon";
import { Footer, type FooterNavLink } from "@/components/storefront/footer";
import { MobileBottomBar } from "@/components/storefront/mobile-bottom-bar";
import { SearchOverlay } from "@/components/storefront/search-overlay";
import { SiteHeader } from "@/components/storefront/site-header";
import { SfToaster } from "@/components/storefront/toast";
import { WhatsAppFab } from "@/components/storefront/whatsapp-fab";
import { getCatalogNav } from "@/lib/catalog-nav";
import { getNavMenus } from "@/lib/nav-menus-server";
import { getSiteImages } from "@/lib/site-images-server";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

/**
 * Storefront chrome — REDESIGN.md Part 5.
 *
 * The announcement strip scrolls away in flow; the header sticks and morphs;
 * the mobile bottom bar and the desktop WhatsApp button split the persistent
 * order affordance by breakpoint (decisions log #8 — never both at once);
 * the search overlay mounts once here and is opened from anywhere through
 * the module signal; the footer closes with a commission CTA band.
 *
 * Studio Site Settings, the catalog nav and the localised WhatsApp greeting
 * all resolve server-side. Part 0 stands: no cart, no customer auth — every
 * persistent action opens WhatsApp.
 */
export default async function V2Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [settings, catalogNav, images, tNav, tFooter, tCommon, tWa] =
    await Promise.all([
      getSiteSettings(),
      getCatalogNav(locale),
      getSiteImages(),
      getTranslations({ locale, namespace: "Nav" }),
      getTranslations({ locale, namespace: "Footer" }),
      getTranslations({ locale, namespace: "Common" }),
      getTranslations({ locale, namespace: "WhatsApp" }),
    ]);
  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  // Menus resolve from NavItem rows with the bundled arrays as the fallback.
  // Labels still come from the `Nav.*` catalogue — the copy layer owns those
  // in nine languages, and duplicating them here would give one word two
  // owners — so the resolver is handed the translator rather than the strings.
  const nav = await getNavMenus(locale, (key) =>
    tNav(key as Parameters<typeof tNav>[0]),
  );

  const toFooterLinks = (links: typeof nav.header): FooterNavLink[] =>
    links.map((link) => ({ label: link.label, href: link.href }));

  return (
    <div data-theme="light" className="flex flex-1 flex-col bg-mineral">
      <DraftRibbon />
      {/* Part 14 opens with "motion should communicate craftsmanship, not a
          technology demo", and its budget forbids anything that delays the LCP.
          Two ornaments failed both tests: the first-visit brand preloader (a
          deliberate delay in front of the hero) and the cursor follower
          (decoration with no informational job). They were unmounted, and
          D18 deleted them outright in 2026-09 — keeping the files while
          promising "remounting is one line" was the ambiguity that decision
          was approved to remove. `git log --diff-filter=D` has them.

          The static film-grain wash stays: it is texture, not motion, and it
          serves the "contemporary craft" register §2.4 asks for. */}
      <div aria-hidden className="sf-grain" />
      {/* §5.1: a fact, not a slogan. The settings field holds one message per
          line — the owner's own rotation set; the stock line pads a single
          owner message into a rotation, and the bar's pause control engages
          only for 2+ messages. */}
      <AnnouncementBar
        /* The owner's own destination when they set one — it is stored
           (`SiteSettings.announcementHref`), resolved behind the same
           schedule window as the message itself (`site-settings.ts:214-217`)
           and was being collected and discarded here. `/shop` stays the
           fallback so an unset field behaves exactly as before. */
        href={settings.announcementHref || "/shop"}
        messages={[
          ...new Set(
            [
              ...(settings.announcement ?? "")
                .split(/\r?\n+/)
                .map((m) => m.trim())
                .filter(Boolean),
              // The stock line is OUR copy, so it is translated; the owner's
              // own lines come from Site Settings and stay in whatever
              // language they wrote them.
              tCommon("announcementDefault"),
            ].filter((m): m is string => Boolean(m)),
          ),
        ]}
      />
      <SiteHeader
        navLinks={nav.header}
        secondaryNavLinks={nav["header-secondary"]}
        catalog={catalogNav}
        waHref={waHref}
        navImages={{
          art: images["nav.art"],
          print: images["nav.print"],
          supplies: images["nav.supplies"],
        }}
        transparentRoutes={[
          "/",
          "/about",
          "/custom-order",
          "/process",
          "/large-resin-art",
          "/workshops",
          "/portfolio",
        ]}
        localeControl={<LocaleSwitcher />}
      />
      <main
        id="main-content"
        data-theme="light"
        className="flex-1 bg-mineral font-body text-ink"
      >
        {children}
      </main>
      <Footer
        whatsappHref={waHref}
        exploreLinks={toFooterLinks(nav["footer-explore"])}
        studioLinks={toFooterLinks(nav["footer-studio"])}
        journalLinks={toFooterLinks(nav["footer-journal"])}
        legalLinks={toFooterLinks(nav["footer-legal"])}
        tagline={tFooter("tagline")}
        phoneDisplay={settings.phoneDisplay}
        phoneTel={settings.phoneTel}
        email={settings.email}
        mapsUrl={settings.mapsUrl}
        address={settings.address}
        socials={settings.socials}
        socialLabels={{
          instagram: tFooter("socialInstagram"),
          facebook: tFooter("socialFacebook"),
          youtube: tFooter("socialYoutube"),
          pinterest: tFooter("socialPinterest"),
        }}
        ctaEyebrow={tFooter("ctaEyebrow")}
        ctaHeadline={tFooter("ctaHeadline")}
        ctaAction={tFooter("ctaAction")}
        exploreLabel={tFooter("explore")}
        studioLabel={tFooter("studio")}
        journalLabel={tFooter("journal")}
        contactLabel={tFooter("contact")}
        newsletterLabel={tFooter("newsletterLabel")}
        newsletterHint={tFooter("newsletterHint")}
        findStudioLabel={tFooter("findStudio")}
        chatOnWhatsAppLabel={tFooter("chatOnWhatsApp")}
        socialWhatsappLabel={tFooter("socialWhatsapp")}
        openInNewTabLabel={tCommon("openInNewTab")}
        rightsLine={tFooter("rights", {
          year: String(new Date().getFullYear()),
        })}
        madeInLabel={tFooter("madeIn")}
        localeControl={<LocaleSwitcher />}
      />
      <MobileBottomBar waHref={waHref} />
      <WhatsAppFab waHref={waHref} />
      <SearchOverlay />
      <SfToaster />
    </div>
  );
}
