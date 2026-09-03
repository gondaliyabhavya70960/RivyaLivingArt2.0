import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localeUrlMap } from "@/i18n/seo";
import { SITE } from "@/lib/constants";
import { liveWhere } from "@/lib/custom-pages-server";
import { db } from "@/lib/db";

/** The sitemap hits the database — cache it for an hour between crawls. */
export const revalidate = 3600;

/** Static public routes (paths relative to the site root). */
const STATIC_ROUTES: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: "/shop", priority: 0.9 },
  { path: "/custom-order", priority: 0.8 },
  { path: "/portfolio", priority: 0.7 },
  { path: "/blog", priority: 0.7 },
  { path: "/workshops", priority: 0.6 },
  { path: "/about", priority: 0.6 },
  { path: "/process", priority: 0.6 },
  { path: "/large-resin-art", priority: 0.7 },
  { path: "/faq", priority: 0.6 },
  { path: "/contact", priority: 0.6 },
  // /search is intentionally omitted — it's a query-only, noindex route
  // (SEO-001); submitting it would invite thin ?q= index bloat.
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

/**
 * Public content only: PUBLISHED and never a demo fixture. Hard-coded rather
 * than `demoWhere()` on purpose — the owner's demo switch may show fixtures
 * on the page, but a sitemap entry invites crawlers to index them.
 */
const PUBLISHED_NOT_DEMO = {
  status: "PUBLISHED" as const,
  isDemo: false,
};

type Entry = MetadataRoute.Sitemap[number];

/**
 * One sitemap entry per locale per route, each carrying the full reciprocal
 * hreflang map (Google requires every variant's cluster to be reciprocal;
 * emitting each localized URL as its own <url> with the same xhtml:link set
 * satisfies that). Content slugs are shared across locales — only the path
 * prefix differs under `localePrefix: "as-needed"`.
 */
function localizedEntries(
  path: string,
  extra: Partial<Entry> & Pick<Entry, "priority">,
): Entry[] {
  const languages = localeUrlMap(path, SITE.url);
  return routing.locales.map((locale) => ({
    url: `${SITE.url}${getPathname({ href: path, locale })}`,
    alternates: { languages },
    ...extra,
  }));
}

/** The content half of the sitemap — everything that needs the database. */
type ContentSlugs = {
  products: { slug: string; updatedAt: Date }[];
  categories: { slug: string }[];
  posts: { slug: string; updatedAt: Date }[];
  portfolios: { slug: string; createdAt: Date }[];
  landers: { slug: string; updatedAt: Date }[];
};

const NO_CONTENT: ContentSlugs = {
  products: [],
  categories: [],
  posts: [],
  portfolios: [],
  landers: [],
};

async function readContentSlugs(): Promise<ContentSlugs> {
  const [products, categories, posts, portfolios, landers] = await Promise.all([
    db.product.findMany({
      where: PUBLISHED_NOT_DEMO,
      select: { slug: true, updatedAt: true },
    }),
    // Only categories that actually have a published, non-DEMO product —
    // empty category pages are thin content and shouldn't be submitted (SEO-008).
    db.category.findMany({
      where: { products: { some: PUBLISHED_NOT_DEMO } },
      select: { slug: true },
    }),
    db.blogPost.findMany({
      where: PUBLISHED_NOT_DEMO,
      select: { slug: true, updatedAt: true },
    }),
    db.portfolio.findMany({
      where: PUBLISHED_NOT_DEMO,
      select: { slug: true, createdAt: true },
    }),
    // Custom landing pages. `liveWhere` enforces the schedule, so a page set
    // to go live tomorrow is not submitted today; `noindex` pages are left out
    // entirely, because a sitemap entry for a page that tells crawlers not to
    // index it is a contradiction Google reports as an error.
    db.customPage.findMany({
      where: { ...liveWhere(), noindex: false, isDemo: false },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return { products, categories, posts, portfolios, landers };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Total, like the CMS resolvers (site-copy-server.ts): the sitemap is
  // prerendered by `next build`, and a transient database error there used
  // to fail the whole deploy — the Phase 0 PR's own Vercel preview died on
  // this read with a docs-only diff (P2037, the preview database's connection
  // limit). A sitemap of static routes for one revalidate window beats no
  // deploy at all; the error is logged, never swallowed silently.
  const { products, categories, posts, portfolios, landers } =
    await readContentSlugs().catch((error: unknown) => {
      console.error(
        "Sitemap content unavailable — serving static routes only:",
        error,
      );
      return NO_CONTENT;
    });

  return [
    // Static routes carry NO lastModified: stamping new Date() each hourly
    // revalidation claimed /privacy, /terms etc. changed within the hour,
    // and consistently inaccurate lastmod makes Google ignore the field
    // site-wide — devaluing the accurate dates on the product/blog entries
    // below (Part 0 audit A3-006). lastmod is optional per the spec.
    ...STATIC_ROUTES.flatMap(({ path, priority }) =>
      localizedEntries(path, {
        changeFrequency: "weekly" as const,
        priority,
      }),
    ),
    // Products are the catalog-scale set (~4,400 with the full tier import):
    // ONE entry each, default-locale URL, no per-entry hreflang cluster —
    // product pages already declare their full alternates in generateMetadata
    // (SEO-510), and 4,400 × 9 locales × 9 alternates would blow through the
    // 50 MB single-sitemap ceiling.
    ...products.map(
      (product): Entry => ({
        url: `${SITE.url}${getPathname({
          href: `/product/${product.slug}`,
          locale: routing.defaultLocale,
        })}`,
        lastModified: product.updatedAt,
        priority: 0.8,
      }),
    ),
    ...categories.flatMap((category) =>
      localizedEntries(`/shop/${category.slug}`, { priority: 0.7 }),
    ),
    ...posts.flatMap((post) =>
      localizedEntries(`/blog/${post.slug}`, {
        lastModified: post.updatedAt,
        priority: 0.6,
      }),
    ),
    ...portfolios.flatMap((portfolio) =>
      localizedEntries(`/portfolio/${portfolio.slug}`, {
        lastModified: portfolio.createdAt,
        priority: 0.6,
      }),
    ),
    ...landers.flatMap((lander) =>
      localizedEntries(`/p/${lander.slug}`, {
        lastModified: lander.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }),
    ),
  ];
}
