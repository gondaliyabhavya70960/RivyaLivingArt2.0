import { cache } from "react";
import type { Metadata } from "next";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { Eye, MessageCircle } from "lucide-react";

import {
  ProductGallery,
  type GalleryImage,
} from "@/components/product/gallery";
import {
  ProductOrderPanel,
  type OrderPanelProduct,
} from "@/components/product/order-panel";
import { ShareButtons } from "@/components/product/share-buttons";
import { SpecSheet, type SpecRow } from "@/components/product/spec-sheet";
import { StickyMobileCta } from "@/components/product/sticky-mobile-cta";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { TestimonialCard } from "@/components/storefront/testimonial-card";
import { JsonLd } from "@/components/seo/json-ld";
import type { Prisma } from "@/generated/prisma/client";
import { detailOpenGraph } from "@/app/shared-metadata";
import { SITE } from "@/lib/constants";
import { groupForCategorySlug } from "@/lib/catalog-taxonomy";
import { db } from "@/lib/db";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { editorialName } from "@/lib/product-name";
import {
  localize,
  localizeLexical,
  TRANSLATABLE_FIELDS,
} from "@/lib/localize";
import { fetchDuplicateTitleCounts, type ShopProductItem } from "@/lib/shop";
import { getSiteSettings } from "@/lib/site-settings";
import { getTestimonials } from "@/lib/testimonials";
import { formatPriceBand } from "@/lib/utils";
import { buildWaLink } from "@/lib/whatsapp";
import { localeAlternates } from "@/i18n/seo";
import { demoWhere, showDemoContent } from "@/lib/demo-content";

/** ISR: 24h TTL (audit M-P6) — a 39k-URL long tail sees < 1 visit per 5 min,
 *  so a short TTL gave a near-zero hit ratio; studio saves reach the page via
 *  on-demand revalidation instead. */
export const revalidate = 86400;
export const dynamicParams = true;

/**
 * ISR registration (audit C2): no PDP paths are prerendered at build time
 * (4,373 published products × 9 locales), but declaring generateStaticParams
 * marks the route static-capable — each slug is rendered on first request,
 * then cached and revalidated on the `revalidate` interval.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const products = await db.product.findMany({
      // Never prerender a fixture; a shown demo piece renders on request.
      where: { status: "PUBLISHED", featured: true, isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { slug: true },
    });
    return products.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/* ————————————————— module-level helpers ————————————————— */

/** Prefix site-relative paths (/uploads/…) with the canonical origin. */
function absoluteUrl(url: string): string {
  return url.startsWith("/") ? `${SITE.url}${url}` : url;
}

/** Coerce a Prisma Json column into a clean string array. */
function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
}

/**
 * §9.4's related rail: "same collection, price within ±60%." Unpriced pieces
 * (and unpriced neighbours) fall through to the category order rather than
 * being excluded — a made-to-order shelf where half the rows are "enquire"
 * would otherwise return an empty rail.
 */
const PRICE_WINDOW = 0.6;

/** Row shape shared by every card rail on this page. */
const RAIL_SELECT = {
  id: true,
  slug: true,
  title: true,
  displayName: true,
  shortTagline: true,
  priceMin: true,
  priceMax: true,
  showPrice: true,
  featured: true,
  tier: true,
  inStock: true,
  description: true,
  careNotes: true,
  seoTitle: true,
  seoDescription: true,
  translations: true,
  category: {
    select: { slug: true, name: true, description: true, translations: true },
  },
  images: {
    select: { url: true, alt: true },
    orderBy: { order: "asc" },
    take: 2,
  },
} satisfies Prisma.ProductSelect;

// cache() dedupes the fetch so generateMetadata + the page component share a
// single query per request instead of hitting Postgres twice (PERF-307).
const getProduct = cache(async (slug: string) => {
  const demo = await demoWhere();
  return db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { order: "asc" } },
      category: true,
      customFields: { orderBy: { order: "asc" } },
      // Gap 3 cross-tier provenance — both directions, published links only.
      madeWith: {
        where: { status: "PUBLISHED", ...demo },
        select: {
          slug: true,
          title: true,
          displayName: true,
          translations: true,
        },
      },
      usedIn: {
        where: { status: "PUBLISHED", ...demo },
        take: 6,
        select: {
          slug: true,
          title: true,
          displayName: true,
          translations: true,
        },
      },
    },
  });
});

/* ————————————————— metadata ————————————————— */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    const t = await getTranslations({ locale, namespace: "Product" });
    return { title: t("notFound") };
  }
  const p = localize(product, locale, TRANSLATABLE_FIELDS.product);

  const title = p.seoTitle || p.title;
  // Never ship a description-less share card: fall back to a trimmed body
  // (MKT-011). needsRewrite rows must not leak their scraped source copy.
  const description =
    p.seoDescription ||
    p.shortTagline ||
    (p.description && !product.needsRewrite
      ? p.description.replace(/\s+/g, " ").trim().slice(0, 200) || undefined
      : undefined);

  const rawOg = product.ogImage || product.images[0]?.url;
  let ogImages: string[] | undefined;
  if (rawOg?.startsWith("http")) ogImages = [rawOg];
  else if (rawOg?.startsWith("/")) ogImages = [`${SITE.url}${rawOg}`];

  return {
    title,
    description,
    alternates: localeAlternates(`/product/${product.slug}`, locale),
    // A draft reachable via a preview link must never be indexed (ENG-802).
    robots:
      product.status !== "PUBLISHED" || product.isDemo
        ? { index: false, follow: false }
        : undefined,
    openGraph: {
      ...detailOpenGraph(locale),
      title,
      description,
      url: `${SITE.url}/product/${product.slug}`,
      images: ogImages ?? [`${SITE.url}/opengraph-image`],
    },
  };
}

/* ————————————————— page —————————————————
 *
 * The PDP — REDESIGN.md Part 9.
 *
 * Desktop splits 60% gallery / 40% sticky information (§9.1–9.2). The
 * information column carries identity, price, the customization note, the
 * production chip and exactly two actions — **Customize this piece** and
 * **Ask on WhatsApp** — with the trust list moved BELOW them as a
 * hairline-divided mono list, "where it reassures rather than delays".
 *
 * Below the hero the page reads as an editorial article (§9.4): alternating
 * image/text blocks carrying the piece, its materials and dimensions, then
 * how it is made, its care and its delivery — and **only the panels that have
 * something to say**. §9.4 names the three empty accordion headings the
 * single most damaging detail on the old page; here every panel's body is
 * assembled first and a panel with nothing in it is never constructed, so the
 * whole section disappears when the row is bare.
 *
 * One related rail of four, not two near-identical ones. Ordering stays the
 * Server-Action → Inquiry → wa.me pipeline (Part 0) — no cart, no checkout.
 */
export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { isEnabled: preview } = await draftMode();

  const product = await getProduct(slug);
  if (!product) notFound();
  if (product.status !== "PUBLISHED" && !preview) notFound();
  // A demo piece is a 404 unless the owner shows demo content (or staff preview).
  if (product.isDemo && !preview && !(await showDemoContent())) notFound();

  const p = localize(product, locale, TRANSLATABLE_FIELDS.product);
  /* Editorial hero name (audit N-01): owner displayName, else derived from
     the owned title — the full title stays in metadata/JSON-LD/WhatsApp. */
  const heroName = editorialName(p.displayName, p.title);
  const category = localize(
    product.category,
    locale,
    TRANSLATABLE_FIELDS.category,
  );

  const [messages, tCommon, tNav, tWaOrder, tHome, tBlog] = await Promise.all([
    getMessages(),
    getTranslations("Common"),
    getTranslations("Nav"),
    getTranslations("WhatsAppOrder"),
    getTranslations("Home"),
    getTranslations("Blog"),
  ]);
  // The PDP's own namespace ships English-first: catalogs that don't carry
  // "Product" yet resolve against the default-locale catalog instead of
  // rendering raw key paths; real translations win the moment they land.
  const t =
    "Product" in messages
      ? await getTranslations("Product")
      : await getTranslations({ locale: "en", namespace: "Product" });
  const tEn =
    locale === "en"
      ? t
      : await getTranslations({ locale: "en", namespace: "Product" });
  const tp = (
    key: string,
    values?: Record<string, string | number | Date>,
  ): string => (t.has(key) ? t(key, values) : tEn(key, values));

  // Ecosystem group feeds the honest "Collection" spec row (audit H1 —
  // supplies and 3D print present as their own ecosystems).
  const group = groupForCategorySlug(product.category.slug);

  const [
    settings,
    careSettings,
    categoryRows,
    faqRows,
    testimonials,
    duplicateTitleCounts,
  ] = await Promise.all([
    getSiteSettings(),
    db.siteSettings.findUnique({
      where: { id: "main" },
      select: { defaultCareNotes: true },
    }),
    // One category query feeds the single related rail (§9.4).
    db.product.findMany({
      where: {
        categoryId: product.categoryId,
        status: "PUBLISHED",
        ...(await demoWhere()),
        id: { not: product.id },
      },
      // In-stock pieces lead (audit H2): the rail must not open with a wall
      // of out-of-stock cards; newest-first within each group.
      orderBy: [{ inStock: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: RAIL_SELECT,
    }),
    // PDP depth (trust at the decision moment): the top studio-managed
    // questions answered on the page itself.
    db.faq.findMany({
      where: { status: "PUBLISHED", ...(await demoWhere()) },
      orderBy: { order: "asc" },
      take: 3,
    }),
    // Social proof — real studio-curated rows only; [] hides the band.
    getTestimonials(3, locale),
    // M-S4: title → published count for duplicate groups.
    fetchDuplicateTitleCounts(await showDemoContent()),
  ]);

  // Per-locale FAQ overrides with English fallback (I3).
  const faqs = faqRows.map((faq) =>
    localize(faq, locale, TRANSLATABLE_FIELDS.faq),
  );

  // M-S4 sibling rail: only when this exact title genuinely has published
  // duplicates does the page pay a second query.
  const sameTitleCount = duplicateTitleCounts[product.title] ?? 0;
  const sameTitleRows =
    sameTitleCount > 1
      ? await db.product.findMany({
          where: {
            title: product.title,
            status: "PUBLISHED",
            ...(await demoWhere()),
            id: { not: product.id },
          },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: RAIL_SELECT,
        })
      : [];

  /* ——— serialize to plain props before crossing into client components ——— */

  const galleryImages: GalleryImage[] = product.images
    .filter((image) => isRenderableSrc(image.url))
    .map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt || p.title,
    }));

  const orderPanelProduct: OrderPanelProduct = {
    id: product.id,
    slug: product.slug,
    title: p.title,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    showPrice: product.showPrice,
    inStock: product.inStock,
    timeline: product.timeline,
    customFields: product.customFields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      options: jsonStringArray(field.options),
      required: field.required,
      helpText: field.helpText,
      order: field.order,
    })),
  };

  const toShopItem = (row: (typeof categoryRows)[number]): ShopProductItem => {
    const lp = localize(row, locale, TRANSLATABLE_FIELDS.productCard);
    const displayTitle = editorialName(lp.displayName, lp.title);
    const lc = localize(row.category, locale, TRANSLATABLE_FIELDS.category);
    const [image, hoverImage] = row.images;
    return {
      id: row.id,
      slug: row.slug,
      title: lp.title,
      displayTitle,
      shortTagline: lp.shortTagline,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      showPrice: row.showPrice,
      categoryName: lc.name,
      image: image ? { url: image.url, alt: image.alt || lp.title } : null,
      hoverImage: hoverImage
        ? { url: hoverImage.url, alt: hoverImage.alt || lp.title }
        : null,
      variantChips: [],
      tier: row.tier,
      inStock: row.inStock,
      featured: row.featured,
    };
  };

  const sameTitleItems: ShopProductItem[] = sameTitleRows.map(toShopItem);
  const sameTitleIds = new Set(sameTitleRows.map((row) => row.id));
  const relatedPool = categoryRows.filter((row) => !sameTitleIds.has(row.id));

  /* §9.4 — ONE rail of four: same collection, price within ±60%. The old
     second rail ("From the same shelf") is deleted outright. */
  const price = product.priceMin;
  const inWindow =
    price != null
      ? relatedPool.filter(
          (row) =>
            row.priceMin != null &&
            row.priceMin >= price * (1 - PRICE_WINDOW) &&
            row.priceMin <= price * (1 + PRICE_WINDOW),
        )
      : [];
  const relatedItems: ShopProductItem[] = [
    ...inWindow,
    // Top up from the rest of the shelf rather than shipping a rail of two.
    ...relatedPool.filter((row) => !inWindow.includes(row)),
  ]
    .slice(0, 4)
    .map(toShopItem);

  // L-S3: rows flagged needsRewrite carry scraped source-store copy that must
  // not read verbatim on the premium sheet — fall back to the tagline.
  const description = product.needsRewrite
    ? (p.shortTagline?.trim() ?? "")
    : p.description.trim();
  const careNotes =
    p.careNotes?.trim() || careSettings?.defaultCareNotes?.trim() || null;
  const productUrl = `${SITE.url}/product/${product.slug}`;

  /* ——— specification rows: only fields that actually exist ——— */
  const ecosystemLabel = {
    art: t("specs.ecosystemArt"),
    supplies: t("specs.ecosystemSupplies"),
    print: t("specs.ecosystemPrint"),
  }[group];
  const materials = product.materials?.trim();
  const dimensions = product.dimensions?.trim();
  const timeline = product.timeline?.trim();
  /* Owner-authored label/value pairs lead the sheet in the piece's own
     voice, in the reader's language. Resolved per row and per field, so a
     half-finished translation shows what was typed with English underneath
     rather than dropping the rows it did not reach. */
  const lexicalRows: SpecRow[] = localizeLexical(product, locale).map(
    (row, i) => ({ key: `lexical-${i}`, label: row.label, value: row.value }),
  );
  const provenanceLink = (row: {
    slug: string;
    title: string;
    displayName: string | null;
    translations: unknown;
  }) => {
    const lr = localize(row, locale, ["title", "displayName"]);
    return { slug: row.slug, name: editorialName(lr.displayName, lr.title) };
  };
  const madeWithLinks = product.madeWith.map(provenanceLink);
  const usedInLinks = product.usedIn.map(provenanceLink);

  const specRows: SpecRow[] = [
    ...lexicalRows,
    ...(materials
      ? [{ key: "materials", label: t("specs.materials"), value: materials }]
      : []),
    ...(dimensions
      ? [{ key: "dimensions", label: t("specs.dimensions"), value: dimensions }]
      : []),
    ...(timeline
      ? [{ key: "timeline", label: t("specs.timeline"), value: timeline }]
      : []),
    { key: "category", label: t("specs.category"), value: category.name },
    { key: "ecosystem", label: t("specs.ecosystem"), value: ecosystemLabel },
    {
      key: "availability",
      label: t("specs.availability"),
      value: product.inStock ? t("specs.availableNow") : t("specs.outOfStock"),
    },
  ];

  /* ——— §9.4's critical fix: a panel is BUILT only if it has a body ———
     Each panel's paragraphs are collected first and blank ones dropped, so an
     empty panel is never constructed, `AccordionItem`'s own empty guard has
     nothing to catch, and the section itself disappears when nothing is
     left. */
  const detailPanels = [
    {
      value: "production",
      title: t("production.title"),
      body: [
        t("production.body"),
        timeline ? t("production.timeline", { timeline }) : "",
      ],
    },
    {
      value: "delivery",
      title: t("delivery.title"),
      body: [t("delivery.body"), tWaOrder("replyHours")],
    },
    {
      value: "care",
      title: tp("careHeading"),
      body: [careNotes ?? ""],
    },
  ]
    .map((panel) => ({
      ...panel,
      body: panel.body.map((line) => line.trim()).filter(Boolean),
    }))
    .filter((panel) => panel.body.length > 0);

  const faqPanels = faqs.filter((faq) => faq.answer?.trim());
  const hasDetails = detailPanels.length > 0 || faqPanels.length > 0;

  /* ——— navigation + actions ——— */
  const breadcrumbs = [
    { label: tCommon("home"), href: "/" },
    { label: tNav("shop"), href: "/shop" },
    { label: category.name, href: `/shop/${product.category.slug}` },
  ];
  const breadcrumbItems = [
    ...breadcrumbs.map((crumb) => ({ label: crumb.label, href: crumb.href })),
    { label: p.title },
  ];

  const priceLabel = product.showPrice
    ? formatPriceBand(product.priceMin, product.priceMax)
    : tCommon("enquire");

  /* §9.2's secondary action. A pre-sale enquiry link — it never touches
     `buildOrderMessage`, which stays the sole author of the order message
     the Server Action persists (Part 0). */
  const askHref = buildWaLink(
    `${tp("waAsk", { title: p.title })}\n${productUrl}`,
    settings.whatsappNumber,
  );

  /* §9.4's alternating photography. The first frame is spoken for — it is
     the LCP inside the gallery — so the blocks take the next ones and fall
     back rather than repeating a frame twice in a row. */
  const blockImageA = galleryImages[1] ?? galleryImages[0] ?? null;
  const blockImageB =
    galleryImages[2] ?? (galleryImages.length > 1 ? galleryImages[0] : null);

  /* ——— schema.org: Product (+ AggregateOffer when priced) & breadcrumbs ——— */

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: description || p.shortTagline || undefined,
    ...(galleryImages.length > 0
      ? { image: galleryImages.map((image) => absoluteUrl(image.url)) }
      : {}),
    // Inline rather than an @id reference to the Organization: `brand` feeds
    // the Product rich result, and a consumer that does not resolve the graph
    // should still see a name. Settings are already loaded on this route.
    brand: { "@type": "Brand", name: settings.brandName },
    /* A merchant identifier so the Product rich result can be keyed to a
       single piece (RR-09). Deliberately the slug and NOT `importRef`: that
       column is a SCRAPER dedupe key (schema.prisma:96-100) holding the
       source site's own reference, and publishing it in structured data
       would put a supplier's internal id on a public page. The slug is
       unique, stable and already public in the canonical URL. */
    sku: product.slug,
    category: category.name,
    ...(product.showPrice && product.priceMin != null
      ? {
          offers: {
            "@type": "AggregateOffer",
            lowPrice: product.priceMin,
            highPrice: product.priceMax ?? product.priceMin,
            priceCurrency: "INR",
            availability: product.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url: productUrl,
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: `${SITE.url}${crumb.href === "/" ? "" : crumb.href}`,
      })),
      {
        "@type": "ListItem",
        position: breadcrumbs.length + 1,
        name: p.title,
        item: productUrl,
      },
    ],
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* pb reserves room for the sticky action bar above the mobile nav. */}
      <div data-theme="light" className="bg-mineral pb-36 text-ink lg:pb-0">
        {/* ═══ 9.1 / 9.2 · The commerce split — 60 / 40 ═══ */}
        <section className="section-compact">
          <div className="u-shell">
            {preview && product.status === "DRAFT" ? (
              <p className="mb-6 inline-flex min-h-11 items-center gap-2.5 border border-hairline bg-sand px-5 font-body text-14 text-ink">
                <Eye
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4 shrink-0"
                />
                {tp("draftPreview")}
              </p>
            ) : null}

            <Breadcrumb
              items={breadcrumbItems}
              ariaLabel={tCommon("breadcrumb")}
            />

            <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
              <div className="min-w-0">
                <ProductGallery
                  title={p.title}
                  morphName={`product-${product.slug}`}
                  images={galleryImages}
                  videoUrl={product.videoUrl}
                  model3dUrl={product.model3dUrl}
                />
              </div>

              {/* The information panel, in §9.2's order. */}
              <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                <p className="u-micro">{category.name}</p>

                {/* Long imported SEO titles step down a scale so the headline
                    never eats half a mobile viewport (audit M-M3). */}
                <h1
                  /* Plain concatenation, not cn(): the shared twMerge config
                     reads the numeric type-scale utilities as colors. */
                  className={`mt-4 font-display leading-[1.06] tracking-display text-ink ${
                    heroName.length > 60 ? "text-h3" : "text-h2"
                  }`}
                >
                  {heroName}
                </h1>

                <p className="u-num mt-5 text-20 text-ink">{priceLabel}</p>

                {p.shortTagline ? (
                  <p className="mt-5 font-body text-body leading-relaxed text-graphite">
                    {p.shortTagline}
                  </p>
                ) : null}

                {/* Customization note — what is still open, stated plainly. */}
                <p className="mt-5 font-body text-small leading-relaxed text-graphite">
                  {tp("customizationNote")}
                </p>

                {/* Production information: the lead-time chip and the two
                    other honest facts, all mono, never fake scarcity. */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="u-micro border border-hairline px-3 py-2 text-ink">
                    {timeline
                      ? tp("leadTimeChip", { timeline })
                      : tp("leadTimeMadeToOrder")}
                  </span>
                  {product.tier === 1 ? (
                    <span className="u-micro border border-champagne px-3 py-2 text-champagne-ink">
                      {t("badges.studioOriginal")}
                    </span>
                  ) : null}
                  {!product.inStock ? (
                    <span className="u-micro border border-hairline px-3 py-2 text-ink">
                      {t("badges.outOfStock")}
                    </span>
                  ) : null}
                </div>

                {/* The two actions. Nothing else lives here (§9.2: "do not
                    make the CTA area visually noisy"). */}
                <div id="pdp-actions" className="mt-8 flex flex-col gap-3">
                  <Button asChild variant="primary" size="lg">
                    <a href="#order-panel">{tp("ctaCustomize")}</a>
                  </Button>
                  <Button asChild variant="whatsapp" size="lg">
                    <a
                      href={askHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-wa-source="pdp_ask"
                    >
                      <MessageCircle
                        aria-hidden
                        strokeWidth={1.5}
                        className="size-4"
                      />
                      {tp("ctaWhatsApp")}
                      <span className="sr-only">
                        {" "}
                        {tCommon("openInNewTab")}
                      </span>
                    </a>
                  </Button>
                </div>

                {/* §9.2 — the trust list moves BELOW the CTA, as a
                    hairline-divided mono list, where it reassures rather
                    than delays. Voiced per ecosystem (audit H1). */}
                <ul className="mt-10 border-t border-hairline">
                  {(group === "art"
                    ? [
                        tp("trust.artHandmade"),
                        tp("trust.shipping"),
                        tp("trust.artConfirm"),
                      ]
                    : [
                        tp("trust.functionalQuality"),
                        tp("trust.shipping"),
                        tp("trust.functionalConfirm"),
                      ]
                  ).map((point) => (
                    <li
                      key={point}
                      className="u-micro border-b border-hairline py-4 leading-relaxed"
                    >
                      {point}
                    </li>
                  ))}
                </ul>

                {group === "art" ? (
                  <p className="u-micro mt-5 leading-relaxed">
                    {t("pourVariance")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Customize — the Part 0 conversion surface ═══ */}
        <section
          id="order-panel"
          aria-labelledby="order-heading"
          className="section-standard scroll-mt-24 bg-mineral"
        >
          <div className="u-shell flex flex-col gap-10">
            <SectionHeading
              id="order-heading"
              eyebrow={tp("order.eyebrow")}
              title={tp("ctaCustomize")}
              intro={tp("order.intro")}
            />
            <ProductOrderPanel
              product={orderPanelProduct}
              oosCopy={
                product.inStock
                  ? null
                  : {
                      cta: tp("oosCta"),
                      summaryNote: tp("oosSummaryNote"),
                      waIntro: tp("oosWaIntro"),
                    }
              }
            />
          </div>
        </section>

        {/* ═══ 9.4 · Alternating image / text blocks ═══ */}
        <section
          aria-labelledby="piece-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-20 md:gap-28">
            {/* IMAGE | THE PIECE · MATERIALS · DIMENSIONS */}
            <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-16">
              {blockImageA ? (
                <MeniscusImage
                  src={sizedExternalSrc(blockImageA.url, 1200)}
                  alt={blockImageA.alt}
                  width={1200}
                  height={1500}
                  sizes="(min-width:1024px) 45vw, 100vw"
                  unoptimized={!isOptimizableImageSrc(blockImageA.url)}
                  className="aspect-[4/5] lg:col-span-5"
                  imageClassName="object-cover"
                />
              ) : null}
              <div
                className={
                  blockImageA
                    ? "flex flex-col gap-8 lg:col-span-6 lg:col-start-7"
                    : "flex flex-col gap-8 lg:col-span-7"
                }
              >
                <Eyebrow>{tp("sections.pieceEyebrow")}</Eyebrow>
                <h2
                  id="piece-heading"
                  className="font-display text-h2 leading-[1.08] tracking-display"
                >
                  {t("aboutHeading")}
                </h2>
                {description ? (
                  <p className="u-prose font-body text-body leading-relaxed whitespace-pre-line text-graphite">
                    {description}
                  </p>
                ) : null}
                <SpecSheet heading={t("specs.heading")} rows={specRows} />

                {/* Cross-tier provenance: "Made with" names the actual
                    supplies; the supply's page answers with "What this
                    creates". */}
                {madeWithLinks.length > 0 || usedInLinks.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    {[
                      {
                        key: "madeWith",
                        heading: t("provenanceLinks.madeWith"),
                        links: madeWithLinks,
                      },
                      {
                        key: "creates",
                        heading: t("provenanceLinks.creates"),
                        links: usedInLinks,
                      },
                    ]
                      .filter((entry) => entry.links.length > 0)
                      .map((entry) => (
                        <div key={entry.key}>
                          <h3 className="u-micro">{entry.heading}</h3>
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {entry.links.map((link) => (
                              <li key={link.slug}>
                                <Link
                                  href={`/product/${link.slug}`}
                                  className="inline-flex min-h-11 items-center rounded-full border border-hairline px-4 font-body text-14 text-ink outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-ink/40 hover:text-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 motion-reduce:transition-none"
                                >
                                  {link.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* HOW IT'S MADE · CARE · DELIVERY | IMAGE — rendered ONLY when
                a panel actually has content (§9.4). */}
            {hasDetails ? (
              <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-16">
                {/* Block two mirrors block one: text on the inline-start, the
                    photograph on the end — §9.4's diagram alternates. */}
                <div className="flex flex-col gap-8 lg:order-1 lg:col-span-6">
                  <Eyebrow>{tp("sections.detailsEyebrow")}</Eyebrow>
                  <h2 className="font-display text-h2 leading-[1.08] tracking-display">
                    {tp("sections.detailsHeading")}
                  </h2>
                  <Accordion type="single" collapsible>
                    {detailPanels.map((panel) => (
                      <AccordionItem key={panel.value} value={panel.value}>
                        <AccordionTrigger>{panel.title}</AccordionTrigger>
                        <AccordionContent className="text-small leading-relaxed">
                          {panel.body.map((line, i) => (
                            <p
                              key={line}
                              className={
                                i > 0
                                  ? "mt-3 whitespace-pre-line"
                                  : "whitespace-pre-line"
                              }
                            >
                              {line}
                            </p>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                    {faqPanels.map((faq) => (
                      <AccordionItem key={faq.id} value={faq.id}>
                        <AccordionTrigger>{faq.question}</AccordionTrigger>
                        <AccordionContent className="text-small leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {faqPanels.length > 0 ? (
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="w-fit"
                    >
                      <Link href="/faq">{t("faqs.viewAll")}</Link>
                    </Button>
                  ) : null}

                  {/* Share row — the blog's own eyebrow; the span re-scopes
                      the shared button's semantic vars onto the v3 inks. */}
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-hairline pt-8">
                    <p className="u-micro">{tBlog("post.shareStory")}</p>
                    <span className="[--background:var(--mineral)] [--foreground:var(--ink)] [--ring:var(--focus)]">
                      <ShareButtons
                        slug={product.slug}
                        title={p.title}
                        url={productUrl}
                      />
                    </span>
                  </div>
                </div>

                {blockImageB ? (
                  <MeniscusImage
                    src={sizedExternalSrc(blockImageB.url, 1200)}
                    alt={blockImageB.alt}
                    width={1200}
                    height={900}
                    sizes="(min-width:1024px) 45vw, 100vw"
                    unoptimized={!isOptimizableImageSrc(blockImageB.url)}
                    className="aspect-[4/3] lg:order-2 lg:col-span-5 lg:col-start-8"
                    imageClassName="object-cover"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* ═══ 9.4 · ONE related rail of four ═══ */}
        {relatedItems.length > 0 || sameTitleItems.length > 0 ? (
          <section className="section-standard bg-mineral">
            <div className="u-shell flex flex-col gap-12">
              {sameTitleItems.length > 0 ? (
                <div className="flex flex-col gap-8">
                  <SectionHeading
                    as="h2"
                    size="h3"
                    title={tp("sameTitle.heading")}
                  />
                  <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
                    {sameTitleItems.map((item) => (
                      <CatalogProductCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ) : null}

              {relatedItems.length > 0 ? (
                <div className="flex flex-col gap-8">
                  <SectionHeading
                    id="related-heading"
                    eyebrow={tp("relatedEyebrow", { category: category.name })}
                    title={tp("relatedHeading")}
                    action={
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/shop/${product.category.slug}`}>
                          {tp("sections.viewCollection")}
                        </Link>
                      </Button>
                    }
                  />
                  <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
                    {relatedItems.map((item) => (
                      <CatalogProductCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ═══ Social proof — hidden until the studio publishes real rows ═══ */}
        {testimonials.length > 0 ? (
          <section
            aria-labelledby="pdp-testimonials-heading"
            className="section-standard bg-sand"
          >
            <div className="u-shell flex flex-col gap-10">
              <SectionHeading
                id="pdp-testimonials-heading"
                eyebrow={tHome("testimonials.eyebrow")}
                title={tHome("testimonials.heading")}
              />
              <div className="grid gap-6 md:grid-cols-3">
                {testimonials.map((testimonial) => (
                  <TestimonialCard
                    key={testimonial.id}
                    quote={testimonial.quote}
                    name={testimonial.name}
                    location={testimonial.location ?? undefined}
                    rating={testimonial.rating}
                    avatarUrl={testimonial.avatarUrl}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ═══ 9.5 · Mobile sticky action bar ═══ */}
        <StickyMobileCta
          title={heroName}
          priceLabel={priceLabel}
          whatsappHref={askHref}
          whatsappLabel={tp("ctaWhatsApp")}
          newTabLabel={tCommon("openInNewTab")}
        />
      </div>
    </>
  );
}
