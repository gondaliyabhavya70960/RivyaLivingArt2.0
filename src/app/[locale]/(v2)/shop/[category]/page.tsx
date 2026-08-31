import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BeforeAfter } from "@/components/portfolio/before-after";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { CollectionCard } from "@/components/storefront/collection-card";
import { Pagination } from "@/components/storefront/pagination";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { ShopExplorer } from "@/components/storefront/shop-explorer";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { CATALOG_GROUPS, groupForCategorySlug } from "@/lib/catalog-taxonomy";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { getSiteImages } from "@/lib/site-images-server";
import type { SiteImageKey } from "@/lib/site-images";
import {
  buildProductWhere,
  DEFAULT_SORT,
  fetchProductsPage,
  fetchProductsPageAt,
  isSortKey,
  parseShopPage,
  resolveAfterCursor,
  type ShopFilters,
  type ShopOffsetPage,
  type ShopPage,
  type SortKey,
} from "@/lib/shop";

/** ISR per category; unseeded slugs render on demand. */
export const revalidate = 300;
export const dynamicParams = true;

/** Collection-hero fallbacks when the category carries no image. */
const GROUP_HERO_SLOT: Record<
  ReturnType<typeof groupForCategorySlug>,
  SiteImageKey
> = {
  art: "shop.group.art",
  supplies: "shop.group.supplies",
  print: "shop.group.print",
};

type CategoryParams = { locale: string; category: string };

type CategorySearchParams = {
  q?: string | string[];
  occasion?: string | string[];
  band?: string | string[];
  stock?: string | string[];
  sort?: string | string[];
  /** §7.7's numbered pager — 1-based. Absent and `1` are the same page. */
  page?: string | string[];
  /** Browse depth — last-seen product id; the grid resumes AFTER it. */
  after?: string | string[];
};

/** First non-empty string value of a search param. */
function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The href behind every numbered page link on a collection page — the same
 * contract as /shop's: every filter, sort and search term survives the page
 * change, page 1 is the bare collection URL, and `?after=` is dropped because
 * jumping to a numbered page is a fresh start. The category itself lives in
 * the path, so it never appears as a param here.
 */
function categoryHref(
  slug: string,
  filters: ShopFilters,
  sort: SortKey,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.occasion) params.set("occasion", filters.occasion);
  if (filters.band) params.set("band", filters.band);
  if (filters.stock) params.set("stock", filters.stock);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/shop/${slug}?${qs}#pieces` : `/shop/${slug}#pieces`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<CategoryParams>;
}): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const t = await getTranslations({ locale, namespace: "Shop" });
  const row = await db.category.findUnique({
    where: { slug },
    select: { name: true, description: true, translations: true },
  });
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  if (!row) return { title: tNav("shop") };
  const category = localize(row, locale, TRANSLATABLE_FIELDS.category);
  return {
    title: category.name,
    description:
      category.description ??
      t("categoryMetaDescription", { category: category.name }),
    // Collapse ?occasion/?band/?stock/?sort/?q filter permutations onto the
    // clean category URL so ranking signals don't split.
    alternates: localeAlternates(`/shop/${slug}`, locale),
  };
}

/**
 * /shop/[category] — REDESIGN.md Part 8.
 *
 * "Every collection behaves like a mini editorial landing page." Six blocks,
 * in the spec's order: full-bleed hero with a text overlay → a short unique
 * explanation in cols 1–7 → the before/after slider where the collection is
 * transformation-led → the product grid → related collections → the
 * commission CTA.
 *
 * **The before/after slider** is where source B's "preservation page" lands
 * without adding a route (§8.3). It is drawn from the studio's own published
 * commissions — a Portfolio row filed under this collection that carries BOTH
 * a before and an after image — and simply does not render when that data
 * does not exist. Nothing here invents a transformation.
 *
 * The v2.0 page's "Featured from this collection" row is gone: Part 8 has no
 * slot for it, and on anything but the deepest shelves it re-shuffled pieces
 * the grid was already showing. Its `excludeIds` plumbing goes with it.
 */
export default async function ShopCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<CategoryParams>;
  searchParams: Promise<CategorySearchParams>;
}) {
  const { locale, category: slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Shop");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  const categoryRow = await db.category.findUnique({ where: { slug } });
  if (!categoryRow) notFound();
  const category = localize(categoryRow, locale, TRANSLATABLE_FIELDS.category);

  const sp = await searchParams;
  const sortParam = first(sp.sort);
  const sort: SortKey = isSortKey(sortParam) ? sortParam : DEFAULT_SORT;
  const filters = {
    q: first(sp.q),
    category: slug,
    occasion: first(sp.occasion),
    band: first(sp.band),
    stock: first(sp.stock),
  };
  const requestedPage = parseShopPage(first(sp.page));
  const after = requestedPage > 1 ? undefined : first(sp.after);

  const group = groupForCategorySlug(slug);
  const gridWhere = buildProductWhere(filters);
  const categoryOnlyWhere = buildProductWhere({ category: slug });
  const siblingSlugs = (
    CATALOG_GROUPS[group].slugs as readonly string[]
  ).filter((sibling) => sibling !== slug);

  const [
    page,
    collectionTotal,
    siblings,
    transformation,
    allInCategoryRows,
    images,
  ] = await Promise.all([
      (async (): Promise<ShopPage | ShopOffsetPage> => {
        // ?after resumes a shared/reloaded URL at its mirrored browse depth
        // (resolveAfterCursor degrades a bad/stale id to page 1); ?page asks
        // §7.7's numbered pager for one exact window. Exactly one of the two
        // drives a request — the explicit page wins.
        if (requestedPage > 1 || !after) {
          return fetchProductsPageAt({
            where: gridWhere,
            sort,
            page: requestedPage,
            locale,
          });
        }
        const cursor = await resolveAfterCursor(after, gridWhere);
        return fetchProductsPage({ where: gridWhere, sort, cursor, locale });
      })(),
      db.product.count({ where: categoryOnlyWhere }),
      // Sibling shelves of the same ecosystem — only ones that actually
      // hold published pieces.
      siblingSlugs.length > 0
        ? db.category.findMany({
            where: {
              slug: { in: siblingSlugs },
              products: {
                some: {
                  status: "PUBLISHED",
                  NOT: { title: { startsWith: "DEMO" } },
                },
              },
            },
            orderBy: { order: "asc" },
            take: 6,
            select: { slug: true, name: true, image: true, translations: true },
          })
        : Promise.resolve([]),
      // §8.3 — the transformation, only where one is documented: a published
      // commission in this collection carrying both frames.
      db.portfolio.findFirst({
        where: {
          status: "PUBLISHED",
          categoryId: categoryRow.id,
          beforeImageUrl: { not: null },
          afterImageUrl: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          slug: true,
          title: true,
          translations: true,
          beforeImageUrl: true,
          afterImageUrl: true,
        },
      }),
      // Every published product URL in this category for the CollectionPage
      // ItemList, so crawlers discover pieces beyond the first SSR'd page.
      db.product.findMany({
        where: categoryOnlyWhere,
        select: { slug: true, title: true, translations: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      getSiteImages(),
    ]);

  /** Numbered-pager position — null while `Load more` is driving the view. */
  const pager =
    "totalPages" in page
      ? { page: page.page, totalPages: page.totalPages }
      : null;

  const allInCategory = allInCategoryRows.map((item) => ({
    slug: item.slug,
    title: localize(item, locale, ["title"]).title,
  }));

  const relatedCollections = siblings.map((sibling) => ({
    slug: sibling.slug,
    name: localize(sibling, locale, ["name"]).name,
    image: sibling.image,
  }));

  const heroImage = isRenderableSrc(category.image)
    ? category.image
    : images[GROUP_HERO_SLOT[group]];
  const categoryUrl = `${SITE.url}/shop/${slug}`;

  // Both frames must be renderable before the slider earns its place — a
  // half-populated comparison is worse than none (§8.3).
  const beforeAfter =
    transformation &&
    isRenderableSrc(transformation.beforeImageUrl) &&
    isRenderableSrc(transformation.afterImageUrl)
      ? {
          slug: transformation.slug,
          title: localize(transformation, locale, ["title"]).title,
          before: transformation.beforeImageUrl as string,
          after: transformation.afterImageUrl as string,
        }
      : null;

  const groupLabels = {
    art: t("tabArt"),
    supplies: t("tabSupplies"),
    print: t("tabPrint"),
  } as const;

  /* ——— schema.org: breadcrumbs + the category collection ——— */
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { label: "Home", href: "" },
      { label: "Shop", href: "/shop" },
      { label: category.name, href: `/shop/${slug}` },
    ].map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: `${SITE.url}${crumb.href}`,
    })),
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description ?? undefined,
    url: categoryUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: allInCategory.length,
      itemListElement: allInCategory.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE.url}/product/${item.slug}`,
        name: item.title,
      })),
    },
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionJsonLd} />

      {/* ═══ 8.1 · Hero — full-width image, text overlay ═══
          The photograph is the LCP: `priority`, never revealed, never
          animated (Part 14). */}
      <section
        data-theme="navy"
        aria-labelledby="collection-heading"
        className="relative flex min-h-[62svh] items-end overflow-hidden bg-obsidian text-mineral"
      >
        <div className="absolute inset-0">
          <Image
            src={sizedExternalSrc(heroImage, 2000)}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized={!isOptimizableImageSrc(heroImage)}
            className="object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/50 to-obsidian/30"
          />
        </div>

        <div className="u-shell relative flex flex-col gap-6 pt-16 pb-16 md:pt-20 md:pb-20">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("shop"), href: "/shop" },
              { label: category.name },
            ]}
          />
          <p className="u-micro text-champagne">{groupLabels[group]}</p>
          <h1
            id="collection-heading"
            className="max-w-[16ch] font-display text-hero leading-[0.98] tracking-display text-mineral"
          >
            {category.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="primary" size="lg">
              <a href="#pieces">{t("collection.explore")}</a>
            </Button>
            <p className="u-micro text-mist">
              {t("collection.count", { count: collectionTotal })}
            </p>
          </div>
        </div>
      </section>

      {/* ═══ 8.2 · Short explanation — cols 1–7, unique per collection ═══ */}
      {category.description ? (
        <section className="section-standard bg-mineral">
          <div className="u-shell grid gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-7">
              <Eyebrow>{t("collection.aboutEyebrow")}</Eyebrow>
              <p className="u-prose font-body text-h3 leading-[1.35] text-ink">
                {category.description}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ 8.3 · Before / after — transformation-led collections only ═══ */}
      {beforeAfter ? (
        <section
          aria-labelledby="collection-transformation-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-10">
            <SectionHeading
              id="collection-transformation-heading"
              eyebrow={t("collection.beforeAfterEyebrow")}
              title={t("collection.beforeAfterHeading")}
              intro={t("collection.beforeAfterIntro")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/portfolio/${beforeAfter.slug}`}>
                    {t("collection.beforeAfterCta")}
                  </Link>
                </Button>
              }
            />
            <BeforeAfter
              before={{
                url: beforeAfter.before,
                alt: t("collection.beforeAlt", { title: beforeAfter.title }),
              }}
              after={{
                url: beforeAfter.after,
                alt: t("collection.afterAlt", { title: beforeAfter.title }),
              }}
              className="rounded-image"
            />
          </div>
        </section>
      ) : null}

      {/* ═══ 8.4 · The grid — §7.6, category pinned server-side ═══ */}
      <div
        id="pieces"
        className="scroll-mt-24 bg-mineral pt-6 pb-20 md:pt-10 md:pb-28"
      >
        <ShopExplorer
          initialItems={page.items}
          initialCursor={page.nextCursor}
          total={page.total}
          categories={[]}
          activeFilters={{
            q: filters.q,
            occasion: filters.occasion,
            band: filters.band,
            stock: filters.stock,
          }}
          sort={sort}
          lockedCategory={slug}
          pagination={
            /* §7.7 — numbered, mono, prev/next. Server-rendered slot: the
               pager is built from `hrefFor`, and a function cannot cross the
               client boundary. Null on a resumed `?after=` slice (no page
               number) and when everything fits on one page. */
            pager && pager.totalPages > 1 ? (
              <Pagination
                currentPage={pager.page}
                totalPages={pager.totalPages}
                hrefFor={(target) => categoryHref(slug, filters, sort, target)}
                labels={{
                  label: tCommon("pagination.label"),
                  previous: tCommon("pagination.previous"),
                  next: tCommon("pagination.next"),
                  // Raw template — the component substitutes {number}.
                  page: String(tCommon.raw("pagination.page")),
                }}
              />
            ) : null
          }
        />
      </div>

      {/* ═══ 8.5 · Related collections ═══ */}
      {relatedCollections.length > 0 ? (
        <section
          aria-labelledby="related-collections-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-10">
            <SectionHeading
              id="related-collections-heading"
              eyebrow={t("strip.eyebrow")}
              title={t("collection.relatedHeading")}
            />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCollections.slice(0, 3).map((sibling) => (
                <li key={sibling.slug}>
                  <CollectionCard
                    href={`/shop/${sibling.slug}`}
                    name={groupLabels[group]}
                    promise={sibling.name}
                    image={sibling.image}
                    imageAlt=""
                    ratio="4/5"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ═══ 8.6 · Commission CTA ═══
          Part 8 asks for one, and the footer already carries the site-wide
          "Have something in mind?" band directly below — so this is a
          compact, collection-specific strip on the light ground rather than
          a second obsidian block. Two dark bands may never touch (Part 3.1)
          and no two headings on a page may read the same (Part 17). */}
      <section
        aria-labelledby="collection-commission-heading"
        className="bg-mineral"
      >
        <div className="u-shell section-compact flex flex-col gap-6 border-t border-hairline lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="flex flex-col gap-4">
            <Eyebrow>{t("collection.commissionEyebrow")}</Eyebrow>
            <h2
              id="collection-commission-heading"
              className="max-w-[18ch] font-display text-h3 leading-[1.1] tracking-display text-ink"
            >
              {t("collection.commissionHeading", { collection: category.name })}
            </h2>
            <p className="u-lede font-body text-small text-graphite">
              {t("collection.commissionBody")}
            </p>
          </div>
          <Button asChild variant="primary" size="md" className="shrink-0">
            <Link href="/custom-order">{t("collection.commissionCta")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
