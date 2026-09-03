import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { CureLine, type CureMark } from "@/components/storefront/cure-line";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { SlotImage } from "@/components/storefront/slot-image";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE } from "@/lib/constants";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { fetchLargeFormatPieces } from "@/lib/large-format";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImages, getSiteImageRefs } from "@/lib/site-images-server";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LargeFormat.meta" });
  return {
    title: t("title"),
    description: t("description"),
    // Never a bare { canonical }: a page-level `alternates` shallow-overrides
    // the layout's, which would silently delete the nine-locale hreflang map.
    alternates: localeAlternates("/large-resin-art", locale),
  };
}

/** ISR so the WhatsApp number and any newly classified piece stay fresh. */
export const revalidate = 300;

/** The four shapes a large brief takes, and the picture that carries each. */
const KINDS = [
  { key: "k1", slot: "largeFormat.k1" },
  { key: "k2", slot: "largeFormat.k2" },
  { key: "k3", slot: "largeFormat.k3" },
  { key: "k4", slot: "largeFormat.k4" },
] as const;

/** The four stages of a large commission, in the order they happen. */
const STAGES = ["s1", "s2", "s3", "s4"] as const;

/** What to send so a quote can be quick. */
const BRIEF_ROWS = ["b1", "b2", "b3", "b4"] as const;

/**
 * /large-resin-art — the bespoke capability page for work at scale.
 *
 * This page sells a CONVERSATION, not a shelf. The catalogue holds no
 * large-format furniture (the two categories that would carry it hold five
 * small decor items, three of them drafts), so every section here stands up
 * with zero products behind it, and the one section that shows real pieces
 * renders an invitation instead of an empty grid when there are none. Nothing
 * on this page states a size, a weight, a load, a lead time or an installation
 * service, because none of those are recorded anywhere the site can read.
 */
export default async function LargeResinArtPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    t,
    tCommon,
    tFooter,
    tWa,
    settings,
    images,
    imageRefs,
    sections,
    pieces,
  ] = await Promise.all([
    getTranslations("LargeFormat"),
    getTranslations("Common"),
    getTranslations("Footer"),
    getTranslations("WhatsApp"),
    getSiteSettings(),
    getSiteImages(),
    getSiteImageRefs(),
    getPageSections("large-format"),
    fetchLargeFormatPieces(locale, 6),
  ]);

  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  /* The rail skips a tick for a section that renders nothing — CureMark.id is
     fed straight to getElementById, so a tick for a null section points at
     nothing at all. */
  const cureMarks: CureMark[] = sections
    .filter(
      (s) =>
        s.visible &&
        s.cureLabelKey &&
        (s.key !== "gallery" || pieces.length > 0),
    )
    .map((s) => ({
      id: s.key,
      label: t(s.cureLabelKey as "cure.scale"),
      ...(s.dark ? { dark: true } : {}),
    }));

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      // Mirrors the visible breadcrumb; position 2 was already localised.
      {
        "@type": "ListItem",
        position: 1,
        name: tCommon("home"),
        item: SITE.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("meta.title"),
        item: `${SITE.url}/large-resin-art`,
      },
    ],
  };

  /* A Service node, not a Product or an Offer: there is no product here and no
     price, and an Offer without one is invalid while an Offer with one would
     be fabricated. `provider` is an @id edge into the Organization the layout
     already emits on every page. */
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t("meta.title"),
    description: t("meta.description"),
    provider: { "@id": `${SITE.url}/#organization` },
    areaServed: { "@type": "Country", name: "India" },
    url: `${SITE.url}/large-resin-art`,
  };

  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Scale — the dark opening band ════════ */
    scale: (
      <section
        id="scale"
        data-theme="navy"
        aria-labelledby="large-format-heading"
        className="relative -mt-20 flex min-h-svh flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        <div aria-hidden className="absolute inset-0">
          {/* SlotImage, not MeniscusImage: this is the LCP and Part 14 forbids
              revealing or delaying it. SlotImage is also what makes the owner's
              mobile crop and focal point work, which a 16:9 hero needs. */}
          <SlotImage
            slot={imageRefs["largeFormat.hero"]}
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={80}
            sizes="100vw"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-obsidian/92 via-obsidian/60 to-obsidian/35" />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-24">
          {/* Inside the dark band, above the eyebrow — the idiom
              portfolio/[slug] uses. A separate light strip above a full-bleed
              hero is dead space and cancels the -mt-20 pull-under. The trail
              has to be visible: the BreadcrumbList JSON-LD below describes it. */}
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: t("meta.title") },
            ]}
          />
          {/* rule={false} and no index: the first viewport carries at most one
              champagne element (Part 3.1). */}
          <Eyebrow rule={false}>{t("hero.eyebrow")}</Eyebrow>
          <h1
            id="large-format-heading"
            className="max-w-[14ch] font-display text-hero leading-[0.95] tracking-display"
          >
            {t("hero.headline")}
          </h1>
          <p className="u-lede font-body text-body text-mist">
            {t("hero.lead")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="whatsapp" size="lg" asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                {t("hero.startCta")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
            <Button variant="premium" size="lg" asChild>
              <Link href="/custom-order">{t("hero.briefCta")}</Link>
            </Button>
          </div>
        </div>
      </section>
    ),

    /* ════════ 02 · Scope — four kinds of large work ════════ */
    scope: (
      <section
        id="scope"
        aria-labelledby="scope-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="scope-heading"
            eyebrow={t("scope.eyebrow")}
            title={t("scope.heading")}
            intro={t("scope.intro")}
          />
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {KINDS.map(({ key, slot }) => (
              <li key={key} className="flex flex-col gap-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-sand">
                  <MeniscusImage
                    src={images[slot]}
                    alt={t(`scope.${key}Alt` as "scope.k1Alt")}
                    fill
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
                    unoptimized={!isOptimizableImageSrc(images[slot])}
                    className="absolute inset-0"
                    imageClassName="object-cover"
                  />
                </div>
                <h3 className="font-display text-h3 text-ink">
                  {t(`scope.${key}Title` as "scope.k1Title")}
                </h3>
                <p className="font-body text-small text-graphite">
                  {t(`scope.${key}Copy` as "scope.k1Copy")}
                </p>
              </li>
            ))}
          </ul>
          <p className="u-prose font-body text-small text-graphite">
            {t("scope.materials")}
          </p>
        </div>
      </section>
    ),

    /* ════════ 03 · How it runs — the second dark band ════════ */
    how: (
      <section
        id="how"
        data-theme="navy"
        aria-labelledby="how-heading"
        className="section-standard bg-obsidian text-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="how-heading"
            eyebrow={t("how.eyebrow")}
            title={t("how.heading")}
            intro={t("how.intro")}
          />
          <ol className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((key, index) => (
              <li key={key} className="flex flex-col gap-3">
                {/* The only figure on the page, and it is mono — the audit
                    fails a bare numeral set in the body face. */}
                <span className="u-micro text-champagne">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-h3">
                  {t(`how.${key}Title` as "how.s1Title")}
                </h3>
                <p className="font-body text-small text-mist">
                  {t(`how.${key}Copy` as "how.s1Copy")}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    ),

    /* ════════ 04 · The brief — what to send ════════ */
    brief: (
      <section
        id="brief"
        aria-labelledby="brief-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading
              id="brief-heading"
              eyebrow={t("brief.eyebrow")}
              title={t("brief.heading")}
              intro={t("brief.intro")}
            />
          </div>
          <dl className="flex flex-col lg:col-span-6 lg:col-start-7">
            {BRIEF_ROWS.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-2 border-t border-hairline py-6 first:border-t-0 first:pt-0"
              >
                <dt className="u-micro text-graphite">
                  {t(`brief.${key}Label` as "brief.b1Label")}
                </dt>
                <dd className="font-body text-body text-ink">
                  {t(`brief.${key}Copy` as "brief.b1Copy")}
                </dd>
              </div>
            ))}
          </dl>
          {/* Outside the <dl>: a definition list may only directly contain
              dt/dd groups, div, script or template — a stray <p> is a serious
              axe violation, and this one shipped until the audit caught it. */}
          <p className="font-body text-small text-graphite lg:col-span-6 lg:col-start-7">
            {t("brief.disclaimer")}
          </p>
        </div>
      </section>
    ),

    /* ════════ 05 · Large pieces — conditional on real rows ════════
       Renders an invitation rather than an empty grid. The catalogue has no
       large-format work classified yet, and a wall of placeholders would be a
       claim the studio cannot back. */
    gallery: (
      <section
        id="gallery"
        aria-labelledby="gallery-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          {pieces.length > 0 ? (
            <>
              <SectionHeading
                id="gallery-heading"
                eyebrow={t("gallery.eyebrow")}
                title={t("gallery.heading")}
                intro={t("gallery.intro")}
              />
              <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {pieces.map((piece) => (
                  <li key={piece.id} className="flex flex-col gap-4">
                    <Link
                      href={`/product/${piece.slug}`}
                      className="group flex flex-col gap-4"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-mineral">
                        {isRenderableSrc(piece.image?.url) && piece.image ? (
                          <MeniscusImage
                            src={piece.image.url}
                            alt={piece.image.alt || piece.title}
                            fill
                            sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
                            unoptimized={
                              !isOptimizableImageSrc(piece.image.url)
                            }
                            className="absolute inset-0"
                            imageClassName="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="u-micro text-graphite">
                          {piece.categoryName}
                        </span>
                        <h3 className="font-display text-h3 text-ink">
                          {piece.title}
                        </h3>
                      </div>
                    </Link>
                    {/* Printed only where the owner recorded it. Free text,
                        rendered as typed and never parsed. */}
                    {piece.dimensions || piece.materials ? (
                      <dl className="flex flex-col gap-1 border-t border-hairline pt-3">
                        {piece.dimensions ? (
                          <div className="flex gap-2">
                            <dt className="u-micro text-graphite">
                              {t("gallery.sizeLabel")}
                            </dt>
                            <dd className="u-num text-small text-ink">
                              {piece.dimensions}
                            </dd>
                          </div>
                        ) : null}
                        {piece.materials ? (
                          <div className="flex gap-2">
                            <dt className="u-micro text-graphite">
                              {t("gallery.materialsLabel")}
                            </dt>
                            <dd className="font-body text-small text-ink">
                              {piece.materials}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                size="md"
                asChild
                className="self-start"
              >
                <Link href="/shop">{t("gallery.catalogCta")}</Link>
              </Button>
            </>
          ) : (
            <div className="u-prose flex flex-col gap-6">
              <SectionHeading
                id="gallery-heading"
                eyebrow={t("gallery.eyebrow")}
                title={t("gallery.emptyHeading")}
              />
              <p className="font-body text-body text-graphite">
                {t("gallery.emptyBody")}
              </p>
              <Button
                variant="primary"
                size="lg"
                asChild
                className="self-start"
              >
                <Link href="/custom-order">{t("gallery.emptyCta")}</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    ),

    /* ════════ 06 · Start the conversation ════════ */
    commission: (
      <section
        id="commission"
        aria-labelledby="commission-heading"
        className="section-major bg-mineral"
      >
        <div className="u-shell flex flex-col items-start gap-8">
          <h2
            id="commission-heading"
            className="max-w-[18ch] font-display text-h1 leading-[1.02] tracking-display text-ink"
          >
            {t("cta.heading")}
          </h2>
          <p className="u-lede font-body text-body text-graphite">
            {t("cta.body")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="whatsapp" size="lg" asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                {tFooter("chatOnWhatsApp")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/custom-order">
                {t("cta.formCta")}
                <ArrowRight aria-hidden strokeWidth={1.5} className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    ),
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={serviceJsonLd} />
      <CureLine marks={cureMarks} />
      {sections
        .filter((s) => s.visible)
        .map((s) => (
          <Fragment key={s.key}>{sectionNodes[s.key]}</Fragment>
        ))}
    </>
  );
}
