import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { detailOpenGraph } from "@/app/shared-metadata";
import { localeAlternates } from "@/i18n/seo";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { CustomPageBlock } from "@/components/storefront/custom-page-blocks";
import { resolveBlockGrounds, resolveHeadingLevels } from "@/lib/custom-blocks";
import { resolveBlockExtras } from "@/lib/custom-page-data";
import { getCustomPage, liveWhere } from "@/lib/custom-pages-server";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

/**
 * A custom landing page — /p/<slug>.
 *
 * The one route on this site whose content comes out of a row rather than a
 * message key, because the page did not exist until the owner invented it
 * (docs/studio-cms §4.8). Everything that keeps it looking like the rest of
 * the site is decided here and in `custom-blocks.ts`, not by the owner: the
 * grounds alternate, the heading levels are assigned, the spacing is the same
 * `section-*` rhythm every other page uses.
 *
 * ISR at 300s is also the scheduling mechanism. A page set to go live at 06:00
 * has `publishAt` in the future, `isLive()` says no, and the route 404s; at
 * 06:00 the same query starts saying yes and the next revalidation serves it.
 * No cron has to have fired for that to be true.
 */
export const revalidate = 300;
export const dynamicParams = true;

/**
 * ISR registration: listing any real path flips on-demand ISR on for every
 * other slug. Empty DB → empty list → the route stays dynamic until content
 * exists, which is the correct degradation.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const pages = await db.customPage.findMany({
      // Never prerender a fixture; getCustomPage gates it at request time.
      where: { ...liveWhere(), isDemo: false },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { slug: true },
    });
    return pages.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getCustomPage(slug, locale);
  if (!page) return { title: "Not found", robots: { index: false } };

  const href = `/p/${slug}` as const;
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription ?? undefined,
    alternates: localeAlternates(href, locale),
    // A campaign lander is often deliberately unindexed — a page that exists
    // for one email blast should not compete with /shop in search.
    robots: page.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      ...detailOpenGraph(locale),
      title: page.seoTitle || page.title,
      description: page.seoDescription ?? undefined,
      images: page.ogImage ? [{ url: page.ogImage }] : undefined,
    },
  };
}

export default async function CustomLandingPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const page = await getCustomPage(slug, locale);
  if (!page) notFound();

  const [tNav, tCommon, tWa, settings, extras] = await Promise.all([
    getTranslations("Nav"),
    getTranslations("Common"),
    getTranslations("WhatsApp"),
    getSiteSettings(),
    resolveBlockExtras(page.blocks, locale),
  ]);

  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  const grounds = resolveBlockGrounds(page.blocks);
  const headings = resolveHeadingLevels(page.blocks);
  const leadsWithHero = page.blocks[0]?.type === "hero";

  return (
    <>
      {/* A hero is full-bleed and pulls up under the header, so the crumb
          trail cannot sit above it. Without one the page needs the trail —
          a lander reached from an email is often the visitor's first page. */}
      {leadsWithHero ? null : (
        <div className="u-shell pt-28">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[{ label: tNav("home"), href: "/" }, { label: page.title }]}
          />
        </div>
      )}

      {page.blocks.map((block, index) => (
        <CustomPageBlock
          key={block.id}
          block={block}
          ground={grounds[index]}
          heading={headings[index]}
          first={index === 0}
          extras={extras[block.id] ?? {}}
          waHref={waHref}
        />
      ))}
    </>
  );
}
