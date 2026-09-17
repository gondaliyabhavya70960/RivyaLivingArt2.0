import type { Metadata } from "next";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { Button } from "@/components/storefront/button";
import { CureLine, type CureMark } from "@/components/storefront/cure-line";
import { DemoMark } from "@/components/storefront/demo-mark";
import { HeroMedia } from "@/components/storefront/hero-media";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { Reveal } from "@/components/motion/reveal";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { TestimonialWall } from "@/components/storefront/testimonial-wall";
import { JsonLd } from "@/components/seo/json-ld";
import { db } from "@/lib/db";
import { demoClause } from "@/lib/demo-clause";
import { showDemoContent } from "@/lib/demo-content";
import { FURNITURE_KINDS } from "@/lib/furniture-kinds";
import { SITE } from "@/lib/constants";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { fetchLargeFormatPieces } from "@/lib/large-format";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImages, getSiteImageRefs } from "@/lib/site-images-server";
import { getSiteSettings } from "@/lib/site-settings";
import { getTestimonials } from "@/lib/testimonials";
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

/** The four materials, reusing `Process.materials.*` and its four slots —
 *  see `materials` in the section manifest. */
const MATERIAL_SLOTS = [
  "process.material1",
  "process.material2",
  "process.material3",
  "process.material4",
] as const;

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
    tProcess,
    tHome,
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
    getTranslations("Process"),
    getTranslations("Home"),
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

  // All three are empty-safe (Part 0: no fabricated proof) — a section
  // renders nothing until real studio content exists, exactly like
  // `/custom-order`'s equivalent bands.
  const includeDemo = await showDemoContent();
  const demo = demoClause(includeDemo);
  const [work, words, faqRows] = await Promise.all([
    db.portfolio.findMany({
      where: { status: "PUBLISHED", ...demo },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        title: true,
        translations: true,
        afterImageUrl: true,
        images: {
          orderBy: { order: "asc" },
          take: 1,
          select: { url: true, alt: true },
        },
      },
    }),
    getTestimonials({ take: 3, category: "large-format", locale, includeDemo }),
    db.faq.findMany({
      where: { status: "PUBLISHED", ...demo },
      orderBy: { order: "asc" },
      take: 6,
    }),
  ]);

  const workPieces = work
    .map((piece) => {
      const cover = piece.afterImageUrl ?? piece.images[0]?.url;
      return {
        id: piece.id,
        slug: piece.slug,
        title: localize(piece, locale, ["title"]).title,
        cover: isRenderableSrc(cover) ? cover : null,
        alt: piece.images[0]?.alt?.trim() || null,
      };
    })
    .filter(
      (piece): piece is typeof piece & { cover: string } =>
        piece.cover !== null,
    );

  const faqs = faqRows.map((faq) =>
    localize(faq, locale, TRANSLATABLE_FIELDS.faq),
  );

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
          {/* HeroMedia, not MeniscusImage: this is the LCP and Part 14
              forbids revealing or delaying it. The `poster` form is what
              carries the owner's mobile crop and focal point, which a 16:9
              hero needs. `drift` (F2 reconciliation): `.sf-hero-drift` is now
              an ambient `infinite alternate` loop, which
              `redesign-audit.mjs`'s duration rule exempts the same way it
              already exempts every other looping animation — see the
              globals.css comment above the keyframe. */}
          <HeroMedia poster={imageRefs["largeFormat.hero"]} drift />
          <span className="absolute inset-0 bg-gradient-to-t from-obsidian/92 via-obsidian/60 to-obsidian/35" />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-24">
          {/* Inside the dark band, above the eyebrow — the idiom
              portfolio/[slug] uses. A separate light strip above a full-bleed
              hero is dead space and cancels the -mt-20 pull-under. The trail
              has to be visible: the BreadcrumbList JSON-LD below describes it.
              Text entrance only — the poster above is the LCP and is never
              animated or delayed (Part 14). */}
          <div
            className="sf-hero-rise w-fit"
            style={{ "--i": 0 } as CSSProperties}
          >
            <Breadcrumb
              ariaLabel={tCommon("breadcrumb")}
              items={[
                { label: tCommon("home"), href: "/" },
                { label: t("meta.title") },
              ]}
            />
          </div>
          {/* rule={false} and no index: the first viewport carries at most one
              champagne element (Part 3.1). */}
          <div
            className="sf-hero-rise w-fit"
            style={{ "--i": 1 } as CSSProperties}
          >
            <Eyebrow rule={false}>{t("hero.eyebrow")}</Eyebrow>
          </div>
          <h1
            id="large-format-heading"
            className="sf-hero-rise max-w-[14ch] font-display text-hero leading-hero tracking-display"
            style={{ "--i": 2 } as CSSProperties}
          >
            {t("hero.headline")}
          </h1>
          <p
            className="sf-hero-rise u-lede font-body text-body text-mist"
            style={{ "--i": 3 } as CSSProperties}
          >
            {t("hero.lead")}
          </p>
          <div
            className="sf-hero-rise flex flex-wrap items-center gap-4"
            style={{ "--i": 4 } as CSSProperties}
          >
            {/* ONE hero CTA (audit §3.6: "Two CTAs … do the same job — keep
                one (the form)"). Both opened a commission; a visitor choosing
                between two ways to start the same thing is deciding about US
                rather than about the piece. The WhatsApp route is not lost —
                it is the primary action of this page's own closing band, at
                the point where someone has actually read the page. */}
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
                    blurDataURL={imageRefs[slot].blurDataUrl}
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

    /* ════════ new · Philosophy — copy only, standard ════════ */
    philosophy: (
      <section
        id="philosophy"
        aria-labelledby="philosophy-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell">
          <Reveal className="flex flex-col gap-8 lg:max-w-[68ch]">
            <SectionHeading
              id="philosophy-heading"
              eyebrow={t("philosophy.eyebrow")}
              title={t("philosophy.heading")}
            />
            <div className="flex flex-col gap-5">
              <p className="u-prose font-body text-body text-graphite">
                {t("philosophy.p1")}
              </p>
              <p className="u-prose font-body text-body text-graphite">
                {t("philosophy.p2")}
              </p>
              <p className="u-prose font-body text-body text-graphite">
                {t("philosophy.p3")}
              </p>
            </div>
          </Reveal>
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

    /* ════════ new · Materials — standard ════════
    Reuses `Process.materials.*` and the four `process.material*` slots
    rather than a second copy of the same four materials (About describes
    them the same way, for the same reason). */
    materials: (
      <section
        id="materials"
        aria-labelledby="materials-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              id="materials-heading"
              eyebrow={tProcess("materials.eyebrow")}
              title={tProcess("materials.headingEndure")}
              intro={tProcess("materials.intro")}
            />
          </Reveal>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MATERIAL_SLOTS.map((slot, index) => (
              <li key={slot} className="flex flex-col gap-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-sand">
                  <MeniscusImage
                    src={images[slot]}
                    blurDataURL={imageRefs[slot].blurDataUrl}
                    alt={tProcess(
                      `materials.alt${index + 1}` as "materials.alt1",
                    )}
                    fill
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
                    className="absolute inset-0"
                    imageClassName="object-cover"
                  />
                </div>
                <h3 className="font-body text-16 font-medium text-ink">
                  {tProcess(
                    `materials.m${index + 1}Title` as "materials.m1Title",
                  )}
                </h3>
                <p className="font-body text-14 leading-relaxed text-graphite">
                  {tProcess(
                    `materials.m${index + 1}Copy` as "materials.m1Copy",
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),

    /* ════════ new · Pieces we commission — standard, off by default ════════
    Reuses the homepage's own six furniture tiles rather than a second set
    of concept photography. Concept imagery only (D5) — no prices, no
    product rows. */
    pieces: (
      <section
        id="pieces"
        aria-labelledby="pieces-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="pieces-heading"
            eyebrow={t("pieces.eyebrow")}
            title={t("pieces.heading")}
            intro={t("pieces.intro")}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/custom-order">{tHome("furniture.cta")}</Link>
              </Button>
            }
          />
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FURNITURE_KINDS.map((kind) => (
              <li key={kind.key} className="flex flex-col gap-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-mineral">
                  <MeniscusImage
                    src={images[kind.slot]}
                    blurDataURL={imageRefs[kind.slot].blurDataUrl}
                    alt={tHome(
                      `furniture.kinds.${kind.key}.alt` as "furniture.kinds.dining.alt",
                    )}
                    fill
                    sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
                    className="absolute inset-0"
                    imageClassName="object-cover"
                  />
                </div>
                <DemoMark label={tHome("furniture.conceptLabel")} />
                <h3 className="font-body text-16 font-medium text-ink">
                  {tHome(
                    `furniture.kinds.${kind.key}.title` as "furniture.kinds.dining.title",
                  )}
                </h3>
                <p className="font-body text-14 leading-relaxed text-graphite">
                  {tHome(
                    `furniture.kinds.${kind.key}.lead` as "furniture.kinds.dining.lead",
                  )}
                </p>
                <p className="u-micro border-t border-hairline pt-3">
                  {tProcess("timelines.e2Value")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),

    /* ════════ new · Commissioned before — conditional, standard ════════ */
    work:
      workPieces.length > 0 ? (
        <section
          id="work"
          aria-labelledby="work-heading"
          className="section-standard bg-mineral"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="work-heading"
              eyebrow={t("work.eyebrow")}
              title={t("work.heading")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/portfolio">{t("work.cta")}</Link>
                </Button>
              }
            />
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {workPieces.map((piece, index) => (
                <article key={piece.id} className="group relative">
                  <MeniscusImage
                    src={piece.cover}
                    alt={piece.alt ?? piece.title}
                    width={900}
                    height={1125}
                    sizes="(min-width:1024px) 30vw, 45vw"
                    unoptimized={!isOptimizableImageSrc(piece.cover)}
                    className="aspect-[4/5] rounded-image bg-sand"
                    imageClassName="object-cover"
                  />
                  <p className="u-micro mt-4">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 font-body text-16 leading-snug font-medium text-ink">
                    <Link
                      href={`/portfolio/${piece.slug}`}
                      className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
                    >
                      {piece.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    /* ════════ new · In their words — conditional, standard ════════ */
    words:
      words.length > 0 ? (
        <section
          id="words"
          aria-labelledby="lf-words-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="lf-words-heading"
              eyebrow={t("words.eyebrow")}
              title={t("words.heading")}
            />
            <TestimonialWall testimonials={words} editorialFirst />
          </div>
        </section>
      ) : null,

    /* ════════ new · Questions — conditional, standard ════════ */
    faq:
      faqs.length > 0 ? (
        <section
          id="faq"
          aria-labelledby="lf-faq-heading"
          className="section-standard bg-mineral"
        >
          <div className="u-shell grid gap-12 lg:grid-cols-12">
            <SectionHeading
              id="lf-faq-heading"
              eyebrow={t("faq.eyebrow")}
              title={t("faq.heading")}
              className="lg:col-span-4 md:items-start"
            />
            <div className="flex flex-col gap-8 lg:col-span-7 lg:col-start-6">
              <Accordion type="single" collapsible>
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Button asChild variant="secondary" size="sm" className="w-fit">
                <Link href="/faq">{tCommon("viewAll")}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null,

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
                {/* The collectible card, passed by CONTEXT rather than read
                    off `piece.sizeTier`: this band is tier-homogeneous by
                    its where-clause (large-format.ts), and keying off the
                    column would render the full card for the untiered
                    backlog. A mixed grid (the shop) is where
                    `cardVariantFor` decides. The hand-rolled tile that used
                    to live here was a second copy of the card. */}
                {pieces.map((piece) => (
                  <li key={piece.id}>
                    <CatalogProductCard item={piece} variant="collectible" />
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
            className="max-w-[18ch] font-display text-h1 leading-h1 tracking-display text-ink"
          >
            {t("cta.heading")}
          </h2>
          <p className="u-lede font-body text-body text-graphite">
            {t("cta.body")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" asChild>
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

  /**
   * The rail skips a tick for a section that renders NOTHING — `CureMark.id`
   * is fed straight to `getElementById`, and when the lookup misses `CureLine`
   * falls back to even division, so a stale tick does not break, it lies.
   *
   * Asked of the built nodes rather than of the data, which is why this sits
   * below them. It used to be a hand-written list of four `s.key !== "x" ||
   * rows.length > 0` clauses, and that list had already drifted: `gallery`
   * renders an INVITATION when there are no large pieces — a real
   * `<section id="gallery">` — so the clause suppressed a tick for a section
   * that is on the page. `work`, `words` and `faq` are ternaries that really
   * do collapse to null. Asking `sectionNodes` answers all four correctly and
   * cannot be forgotten when a fifth conditional section is added.
   */
  const cureMarks: CureMark[] = sections
    .filter((s) => s.visible && s.cureLabelKey && sectionNodes[s.key] != null)
    .map((s) => ({
      id: s.key,
      label: t(s.cureLabelKey as "cure.scale"),
      ...(s.dark ? { dark: true } : {}),
    }));

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
