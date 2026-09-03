import type { Metadata } from "next";
import type { ReactNode } from "react";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { ViewTransitions } from "next-view-transitions";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { routing } from "@/i18n/routing";
import { getDir } from "@/i18n/config";
import { instrumentSerif, inter, jetbrainsMono } from "@/app/fonts";
import { scriptFontClass } from "@/app/fonts-scripts";
import { OG_LOCALES, SHARED_METADATA } from "@/app/shared-metadata";
import { cn } from "@/lib/utils";
import "../globals.css";
import { getPathname } from "@/i18n/navigation";
import { ConsentGate } from "@/components/analytics/consent-gate";
import { WhatsAppTracker } from "@/components/analytics/whatsapp-tracker";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";
import { WaNumberProvider } from "@/components/providers/wa-number-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE } from "@/lib/constants";
import { toOpeningHours } from "@/lib/opening-hours";
import { getSiteSettings } from "@/lib/site-settings";

/** Site-wide Organization + LocalBusiness schema — emitted once per page. */
const BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icon.svg`,
      telephone: SITE.phoneTel,
      email: SITE.email,
      areaServed: "IN",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: SITE.phoneTel,
        email: SITE.email,
        areaServed: "IN",
        availableLanguage: ["en", "hi"],
      },
      sameAs: [] as string[], // populated from Site Settings socials below (ENG-001)
    },
    {
      "@type": "LocalBusiness",
      "@id": `${SITE.url}/#localbusiness`,
      name: SITE.name,
      url: SITE.url,
      image: `${SITE.url}/icon.svg`,
      telephone: SITE.phoneTel,
      email: SITE.email,
      address: { "@type": "PostalAddress", addressCountry: "IN" },
      areaServed: "IN",
      priceRange: "₹₹–₹₹₹",
      hasMap: SITE.mapsUrl,
    },
    // WebSite node so Google resolves the SERP "site name" and the site is
    // eligible for the sitelinks search box against the live /search (SEO-506).
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      publisher: { "@id": `${SITE.url}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE.url}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/**
 * Emit the nine supported locales at build time so every language variant is
 * statically rendered. Combined with `setRequestLocale` below, this keeps the
 * public tree in the static-render path under next-intl.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * hreflang alternates (SEO). Maps each supported locale to its localized root
 * URL (resolved against `metadataBase` from the root layout) plus an
 * `x-default`.
 *
 * Every indexable public page now ships its own full `alternates` via
 * `localeAlternates` (I4 sweep), and the noindex routes (/search,
 * /whatsapp-order) deliberately set a canonical-only block — so this baseline
 * only reaches routes with no metadata at all (e.g. not-found).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = getPathname({ href: "/", locale: l });
  }
  languages["x-default"] = getPathname({
    href: "/",
    locale: routing.defaultLocale,
  });

  // Site-wide defaults (metadataBase, title template, OG/Twitter) now live
  // here since this IS the public tree's root layout. Only the hreflang
  // languages map beyond that — NOT a blanket canonical, which would mislabel
  // any page that doesn't set its own alternates as the homepage.
  // The studio's SEO defaults (Settings → defaultSeo, previously written but
  // never read) override the shipped baseline when set: description and OG
  // image cascade to every page that doesn't set its own (Phase 7).
  const { defaultSeo, faviconUrl, appIconUrl } = await getSiteSettings();
  // Brand marks: the owner's uploads win, and the files bundled in src/app
  // stay as the fallback so an environment that has never opened Settings
  // still has an icon. Setting `icons` at all replaces Next's file-convention
  // discovery wholesale, so both entries are listed explicitly.
  const icons = {
    icon: faviconUrl ?? "/icon.svg",
    apple: appIconUrl ?? "/apple-icon.png",
  };
  return {
    ...SHARED_METADATA,
    icons,
    ...(defaultSeo.description ? { description: defaultSeo.description } : {}),
    openGraph: {
      ...SHARED_METADATA.openGraph,
      locale: OG_LOCALES[locale] ?? "en_IN",
      ...(defaultSeo.ogImage ? { images: [{ url: defaultSeo.ogImage }] } : {}),
    },
    alternates: {
      languages,
    },
  };
}

/**
 * Public tree ROOT: html/body, providers, structured data, analytics — no
 * page chrome. `(v2)/layout.tsx` is the sole chrome owner: every public
 * route lives in the (v2) Midnight Gild group since Phase 7 retired the
 * v7 "Sapphire Atelier" group entirely.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // 404 unknown locales; enable static rendering for the resolved one.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const settings = await getSiteSettings();
  const sameAs = [
    settings.socials.instagram,
    settings.socials.facebook,
    settings.socials.youtube,
    settings.socials.pinterest,
  ].filter((v): v is string => Boolean(v));

  // Populate the Organization/LocalBusiness sameAs from real social profiles,
  // and fill the LocalBusiness PostalAddress street line from the studio
  // Settings address once the owner sets it (ENG-007).
  const openingHours = toOpeningHours(settings.businessHours);

  const logoUrl = settings.logoUrl
    ? settings.logoUrl.startsWith("/")
      ? `${SITE.url}${settings.logoUrl}`
      : settings.logoUrl
    : null;

  const address = settings.address
    ? {
        "@type": "PostalAddress",
        streetAddress: settings.address,
        addressCountry: "IN",
      }
    : null;
  // Build the Org/LocalBusiness structured data from the RESOLVED settings so
  // the schema can never drift from the visible footer when the owner edits
  // the WhatsApp/phone/email/map values in Studio (UIUX-601 / ENG-007).
  const businessJsonLd = {
    ...BUSINESS_JSONLD,
    "@graph": BUSINESS_JSONLD["@graph"].map((node) => {
      const isContactEntity =
        node["@type"] === "Organization" || node["@type"] === "LocalBusiness";
      const isLocal = node["@type"] === "LocalBusiness";
      return {
        ...node,
        // The NAME goes on every node, not just the contact entities: the
        // WebSite node is what Google reads for the SERP site name, so an
        // owner who rebrands in Settings and saw the footer change while the
        // search result kept the old name was looking at this.
        name: settings.brandName,
        ...(sameAs.length && isContactEntity ? { sameAs } : {}),
        ...(isContactEntity
          ? {
              telephone: settings.phoneTel,
              email: settings.email,
              // `logoUrl` was written by Settings and read by nothing at all.
              // This is the one place schema.org actually wants it — as an
              // ABSOLUTE url. Blob returns one; the local driver returns
              // "/uploads/…", and a relative logo is not a logo.
              ...(logoUrl ? { [isLocal ? "image" : "logo"]: logoUrl } : {}),
            }
          : {}),
        ...(isLocal
          ? {
              hasMap: settings.mapsUrl,
              ...(address ? { address } : {}),
              // Only rows that parse cleanly reach the schema. A malformed
              // openingHours is reported as an error against the whole node,
              // so an omitted line beats a guessed one.
              ...(openingHours.length ? { openingHours } : {}),
            }
          : {}),
      };
    }),
  };

  const tCommon = await getTranslations({ locale, namespace: "Common" });

  return (
    // ViewTransitions: MorphLink navigations (shop card → PDP) run through
    // document.startViewTransition so paired view-transition-name elements
    // morph (guide Phase 2). Wraps <html> per the library's contract.
    <ViewTransitions>
      <html
        lang={locale}
        dir={getDir(locale)}
        // No root `dark` class: every public page grounds on mineral and
        // scopes its own dark bands with data-theme="navy". The v3 trio is
        // the whole type system — Instrument Serif for display, Inter for
        // body and --font-sans, JetBrains Mono for every number.
        className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          <NextIntlClientProvider>
            <SmoothScrollProvider>
              <div
                id="rr-site-root"
                className={cn(
                  // `font-sans` re-declares the family HERE so the per-locale
                  // `--font-script` variable (defined by scriptFontClass) is in scope
                  // when the stack resolves — a var() in an ancestor's computed
                  // font-family would not re-evaluate for this subtree.
                  "flex min-h-svh flex-col bg-background font-sans text-foreground",
                  scriptFontClass(locale),
                )}
              >
                <JsonLd data={businessJsonLd} />
                {/* Skip link — the first focusable element, so keyboard users can jump
            past the announcement bar + nav straight to content (A11Y-005). */}
                <a
                  href="#main-content"
                  className="sr-only rounded-full focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-(--z-skip) focus:bg-background focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-e3 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {tCommon("skipToContent")}
                </a>
                <WaNumberProvider number={settings.whatsappNumber}>
                  {children}
                </WaNumberProvider>
                <WhatsAppTracker />
                {/* Pixel/GA load only after opt-in when configured (MKT-205). */}
                <ConsentGate />
              </div>
            </SmoothScrollProvider>
          </NextIntlClientProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ViewTransitions>
  );
}
