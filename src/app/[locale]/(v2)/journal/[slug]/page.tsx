import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Eye } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { ArticleToc } from "@/components/blog/article-toc";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { ShareButtons } from "@/components/product/share-buttons";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { detailOpenGraph } from "@/app/shared-metadata";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import { withHeadingAnchors } from "@/lib/document-toc";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { localize, localizeName, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { buildProductWhere, fetchProductsPage } from "@/lib/shop";
import { renderTiptapToHtml } from "@/lib/tiptap-render";

/** ISR: editorial fixes reach the page within 5 minutes. */
export const revalidate = 300;
export const dynamicParams = true;

/**
 * ISR registration (audit C2): no paths are prerendered at build time, but
 * declaring generateStaticParams marks the route static-capable — each slug
 * is rendered on first request, then cached and revalidated on the
 * `revalidate` interval.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Next 16 keeps a dynamic segment fully dynamic while generateStaticParams
  // is EMPTY; listing any real path flips on-demand ISR for every other slug
  // (verified: unlisted slugs then serve s-maxage=300). A handful of recent
  // posts prerender at build; the rest cache on first request. Empty DB →
  // empty list → graceful degradation to dynamic until content exists.
  try {
    const posts = await db.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: { slug: true },
    });
    return posts.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/**
 * Dates are formatted on the server so no client re-render can shift them;
 * the formatter itself is built per request from the active locale.
 */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

/**
 * The reading column — REDESIGN.md §11.9: "body (68ch) … Pull-quotes in
 * Instrument Serif with a champagne hairline above."
 *
 * `u-prose` is the 68ch measure (Part 3.2). Everything below it is the same
 * document grammar the legal pages use, plus the two things an article has
 * that a policy does not:
 *
 * - **The pull-quote.** A blockquote is not indented behind a left bar here;
 *   it is set in Instrument Serif at display scale, opened by a champagne
 *   hairline above it. That hairline is one of the two champagne elements
 *   this page is allowed per viewport (Part 3.1), which is why the article's
 *   other champagne — the eyebrow rule — sits in the masthead, screens away.
 * - **`scroll-mt-32` on every heading**, so a TOC jump or a pasted fragment
 *   lands the heading below the sticky header rather than under it.
 */
const PROSE_ARTICLE = [
  "u-prose font-body text-body leading-[1.85] text-graphite",
  /* No display-faced opening paragraph: the masthead standfirst already
     carries that register, and two serif intros in a row read as an error. */
  "[&>p:first-child]:mt-0",
  "[&_h2]:font-display [&_h2]:tracking-display [&_h2]:mt-14 [&_h2]:scroll-mt-32 [&_h2]:text-h3 [&_h2]:leading-snug [&_h2]:text-ink",
  "[&_h3]:font-display [&_h3]:tracking-display [&_h3]:mt-10 [&_h3]:scroll-mt-32 [&_h3]:text-25 [&_h3]:leading-snug [&_h3]:text-ink",
  "[&_p]:mt-5",
  "[&_li]:mt-2 [&_ul]:mt-5 [&_ul]:list-disc [&_ul]:ps-6",
  "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:ps-6",
  "[&_a]:rounded-input [&_a]:text-sapphire [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-sapphire-hi",
  /* The pull-quote (§11.9). */
  "[&_blockquote]:mt-12 [&_blockquote]:border-t [&_blockquote]:border-champagne [&_blockquote]:pt-6 [&_blockquote]:font-display [&_blockquote]:text-h3 [&_blockquote]:leading-[1.25] [&_blockquote]:tracking-display [&_blockquote]:text-ink",
  "[&_blockquote_p]:mt-0",
  "[&_hr]:my-12 [&_hr]:border-hairline",
  "[&_img]:mt-8 [&_img]:max-w-full [&_img]:rounded-image",
  "[&_strong]:text-ink",
].join(" ");

/* ————————————————— module-level helpers ————————————————— */

/**
 * Depth-first plain-text extraction from stored Tiptap JSON — feeds the
 * read-time estimate. Tolerates the Prisma default `{}` and bad nodes.
 */
function textFromTiptap(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(textFromTiptap).join(" ");
  const record = node as { text?: unknown; content?: unknown };
  const own = typeof record.text === "string" ? record.text : "";
  const children = Array.isArray(record.content)
    ? record.content.map(textFromTiptap).join(" ")
    : "";
  return own && children ? `${own} ${children}` : own || children;
}

/** Read-time estimate at ~220 wpm, never below 1 minute. */
function readMinutes(content: unknown): number {
  const words = textFromTiptap(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Product slugs the article itself links to.
 *
 * §11.9 asks for "contextual product CTA cards mid-article". Contextual means
 * *this* article already sends the reader to *that* piece — a relation the
 * data model does not carry and that this pass may not add (build contract
 * §1). So the association is read out of the author's own prose: a
 * `/product/<slug>` link the owner wrote is a real association; anything
 * inferred from a category or a tag would be a guess dressed as one.
 *
 * Nothing here invents a match, and where a post links no products the whole
 * block simply does not render (Part 16: never an empty rail).
 */
function linkedProductSlugs(html: string): string[] {
  const slugs = new Set<string>();
  for (const match of html.matchAll(
    /href=["'](?:https?:\/\/[^/"']+)?(?:\/[a-z]{2})?\/product\/([a-z0-9-]+)["']/gi,
  )) {
    slugs.add(match[1].toLowerCase());
  }
  return [...slugs].slice(0, 3);
}

/**
 * Split a rendered document in two at the section break nearest its middle,
 * so a contextual card can sit *between* sections rather than interrupting a
 * paragraph. Returns a single part when the document has no interior break —
 * the card then follows the body instead of splitting it.
 */
function splitAtMiddleSection(html: string): [string, string] {
  const breaks = [...html.matchAll(/<h2[\s>]/gi)]
    .map((match) => match.index)
    .filter((index): index is number => index !== undefined && index > 0);
  if (breaks.length === 0) return [html, ""];
  const middle = html.length / 2;
  const at = breaks.reduce((best, index) =>
    Math.abs(index - middle) < Math.abs(best - middle) ? index : best,
  );
  return [html.slice(0, at), html.slice(at)];
}

// cache() dedupes the query between generateMetadata and the page render.
const getPost = cache((slug: string) =>
  db.blogPost.findUnique({
    where: { slug },
    include: { blogCategory: true, tags: true },
  }),
);

type RelatedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: Date | null;
  content: unknown;
  translations: unknown;
  blogCategory: { name: string; translations: unknown } | null;
};

/**
 * Tile-shaped select for the related grid — no full-row hydration (SEO
 * fields, author, timestamps). content + translations stay: readMinutes()
 * and localize() need them.
 */
const RELATED_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  publishedAt: true,
  content: true,
  translations: true,
  blogCategory: { select: { name: true, translations: true } },
} as const;

/** The translatable fields the related tiles actually carry and render. */
const RELATED_LOCALIZED_FIELDS = ["title", "excerpt", "content"] as const;

/**
 * Up to 3 published posts from the same category (newest first), topped up
 * with the latest posts overall when the category runs short. Always
 * excludes the post itself.
 */
async function getRelated(post: {
  id: string;
  blogCategoryId: string | null;
}): Promise<RelatedPost[]> {
  const sameCategory: RelatedPost[] = post.blogCategoryId
    ? await db.blogPost.findMany({
        where: {
          status: "PUBLISHED",
          blogCategoryId: post.blogCategoryId,
          id: { not: post.id },
        },
        orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
        take: 3,
        select: RELATED_SELECT,
      })
    : [];

  if (sameCategory.length >= 3) return sameCategory;

  const fill: RelatedPost[] = await db.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      id: { notIn: [post.id, ...sameCategory.map((p) => p.id)] },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
    take: 3 - sameCategory.length,
    select: RELATED_SELECT,
  });

  return [...sameCategory, ...fill];
}

/* ————————————————— metadata ————————————————— */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    const t = await getTranslations({ locale, namespace: "Blog" });
    return { title: t("post.notFoundTitle") };
  }
  const lp = localize(post, locale, TRANSLATABLE_FIELDS.blogPost);

  const title = lp.seoTitle || lp.title;
  const description = lp.seoDescription || lp.excerpt || undefined;

  let ogImages: string[] | undefined;
  if (post.coverImage?.startsWith("http")) ogImages = [post.coverImage];
  else if (post.coverImage?.startsWith("/"))
    ogImages = [`${SITE.url}${post.coverImage}`];

  return {
    title,
    description,
    alternates: localeAlternates(`/blog/${post.slug}`, locale),
    robots:
      post.status !== "PUBLISHED" ? { index: false, follow: false } : undefined,
    openGraph: {
      ...detailOpenGraph(locale),
      title,
      description,
      type: "article",
      url: `${SITE.url}/blog/${post.slug}`,
      // Cover-less posts need the branded Satori card EXPLICITLY — an absent
      // key ships no share image at all (Part 0 audit A3-001; MKT-204).
      images: ogImages ?? [`${SITE.url}/opengraph-image`],
    },
  };
}

/* ————————————————— page —————————————————
 *
 * The article — REDESIGN.md §11.9.
 *
 * > "Large editorial layout: hero image · category · title · date · reading
 * > time · body (68ch) · related products · related articles · final
 * > commission CTA. Sticky reading progress bar (2px sapphire at the top of
 * > the viewport) and a floating table of contents in cols 9–12 with
 * > scroll-spy. Pull-quotes in Instrument Serif with a champagne hairline
 * > above. Contextual product CTA cards mid-article."
 *
 * Two of those are conditional by design rather than by accident:
 *
 * - **The TOC does not render under three headings.** A two-line contents
 *   list is furniture, not navigation, and it would take a whole column to
 *   say nothing.
 * - **The product blocks render only where the author linked a product.**
 *   `BlogPost` has no product relation, and inventing one from a shared
 *   category would put a candle holder under an article about cure times.
 *   What is real is a `/product/<slug>` link the owner wrote; that is the
 *   only association this page will act on.
 *
 * Band rhythm: mineral rail and masthead → the cover → sand reading sheet →
 * mineral related → obsidian commission close. One dark band, none adjacent,
 * no `section-major`.
 */
export default async function BlogPostPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // Staff-gated draft preview rides Next's draft-mode cookie, minted only by
  // the auth-checked /api/draft route handler (ENG-802). Reading draftMode()
  // — unlike searchParams — keeps this route ISR-cacheable (audit C2).
  const { isEnabled: preview } = await draftMode();

  const post = await getPost(slug);
  if (!post) notFound();
  // Drafts are visible only with the staff preview link.
  if (post.status !== "PUBLISHED" && !preview) notFound();

  const [t, tNav, tCommon, tCustom] = await Promise.all([
    getTranslations("Blog"),
    getTranslations("Nav"),
    getTranslations("Common"),
    getTranslations("CustomOrder.page"),
  ]);

  // Localized view (no-op for English / when nothing stored). `post` keeps the
  // non-translatable data (coverImage, dates, author, tags, slug, status).
  const lp = localize(post, locale, TRANSLATABLE_FIELDS.blogPost);

  const { html, headings } = withHeadingAnchors(
    renderTiptapToHtml(lp.content),
    [2, 3],
  );

  const productSlugs = linkedProductSlugs(html);
  const [related, linkedProducts] = await Promise.all([
    getRelated(post),
    productSlugs.length > 0
      ? fetchProductsPage({
          where: { ...buildProductWhere({}), slug: { in: productSlugs } },
          sort: "featured",
          take: 3,
          locale,
          withTotal: false,
        })
      : null,
  ]);
  const pieces = linkedProducts?.items ?? [];

  // §11.9 "contextual product CTA cards mid-article" — between sections, and
  // only when the author actually pointed at a piece.
  const [bodyStart, bodyRest] =
    pieces.length > 0 ? splitAtMiddleSection(html) : [html, ""];

  const minutes = readMinutes(lp.content);
  // Server-side date formatting in the request locale (no client hydration).
  const dateFormatter = new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS);
  const dateLabel = dateFormatter.format(post.publishedAt ?? post.createdAt);
  const cover = isRenderableSrc(post.coverImage) ? post.coverImage : null;
  const postUrl = `${SITE.url}/blog/${post.slug}`;

  /* ——— schema.org: Article + breadcrumbs ——— */

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: lp.title,
    description: lp.excerpt || undefined,
    author: { "@type": "Person", name: post.authorName },
    // Reference the Organization the root layout emits on every page rather
    // than restating its name here. It used to hardcode SITE.name, so an owner
    // who rebranded in Settings got a new footer and a stale publisher; a
    // pointer cannot drift, and it costs this route no extra query.
    publisher: { "@id": `${SITE.url}/#organization` },
    datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    ...(cover
      ? { image: [cover.startsWith("/") ? `${SITE.url}${cover}` : cover] }
      : {}),
    mainEntityOfPage: postUrl,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${SITE.url}/blog`,
      },
      { "@type": "ListItem", position: 3, name: lp.title, item: postUrl },
    ],
  };

  return (
    <>
      <ReadingProgress />
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* ════════ 01 · Trail — compact ════════ */}
      <section className="section-compact bg-mineral">
        <div className="u-shell flex flex-col gap-6">
          {preview && post.status === "DRAFT" ? (
            <p className="inline-flex w-fit items-center gap-2.5 rounded-full border border-hairline bg-sand px-5 py-2.5 font-body text-14 text-ink">
              <Eye aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
              {t("post.draftPreview")}
            </p>
          ) : null}
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("blog"), href: "/blog" },
              { label: lp.title },
            ]}
          />
        </div>
      </section>

      {/* ════════ 02 · The cover ════════
          Full-bleed, cinematic, and the page's LCP: `priority`, never
          revealed, never animated (Part 14). */}
      {cover ? (
        <div className="relative aspect-[16/10] max-h-[72svh] w-full overflow-hidden bg-obsidian sm:aspect-[21/9]">
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized={!isOptimizableImageSrc(cover)}
            className="object-cover"
          />
        </div>
      ) : null}

      {/* ════════ 03 · Masthead — standard ════════
          Category · title · standfirst · the mono byline row. */}
      <section
        aria-labelledby="article-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-6">
          <Eyebrow>
            {post.blogCategory
              ? localizeName(post.blogCategory, locale)
              : t("journalFallbackCategory")}
          </Eyebrow>
          <h1
            id="article-heading"
            className="max-w-[20ch] font-display text-h1 leading-[1.03] tracking-display"
          >
            {lp.title}
          </h1>
          {lp.excerpt ? (
            <p className="u-prose font-display text-h3 leading-[1.35] text-ink">
              {lp.excerpt}
            </p>
          ) : null}
          <p className="u-micro flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-5">
            <span className="text-ink">{post.authorName}</span>
            <span aria-hidden>·</span>
            <span>{dateLabel}</span>
            <span aria-hidden>·</span>
            <span>{t("minRead", { minutes })}</span>
          </p>
        </div>
      </section>

      {/* ════════ 04 · The reading sheet — standard ════════
          Body in cols 1–7 at 68ch; the floating contents in cols 9–12. */}
      <section className="section-standard bg-sand">
        <div className="u-shell grid gap-12 lg:grid-cols-12 lg:gap-x-16">
          {/* §11.9 puts the TOC in cols 9–12; it leads in the DOM so a phone
              gets the outline before the article, and explicit row/column
              placement returns it to the right rail on desktop. Under three
              headings there is nothing worth a column. */}
          {headings.length >= 3 ? (
            <ArticleToc
              headings={headings}
              label={t("post.contentsLabel")}
              title={t("post.contents")}
              className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start"
            />
          ) : null}

          <div className="flex flex-col gap-10 lg:col-span-7 lg:col-start-1 lg:row-start-1">
            <div
              className={PROSE_ARTICLE}
              dangerouslySetInnerHTML={{ __html: bodyStart }}
            />

            {/* The contextual piece — a card between two sections, never a
                banner over the prose. */}
            {pieces.length > 0 ? (
              <aside className="u-prose flex flex-col gap-6 border-t border-hairline pt-8">
                <Eyebrow rule={false}>{t("post.inlineProductEyebrow")}</Eyebrow>
                <div className="grid gap-8 sm:grid-cols-2">
                  {pieces.slice(0, 2).map((item) => (
                    <CatalogProductCard key={item.id} item={item} />
                  ))}
                </div>
              </aside>
            ) : null}

            {bodyRest ? (
              <div
                className={PROSE_ARTICLE}
                dangerouslySetInnerHTML={{ __html: bodyRest }}
              />
            ) : null}

            {/* Topics. This is where the journal's 195 tags live: on the
                article that earned them, one filter click from the index —
                not as a wall of chips on the index itself (§11.8). */}
            {post.tags.length > 0 ? (
              <div className="u-prose flex flex-col gap-4 border-t border-hairline pt-8">
                <p className="u-micro">{t("post.topics")}</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                      className="inline-flex h-11 shrink-0 items-center rounded-full border border-hairline px-4 font-body text-small whitespace-nowrap text-ink transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-mineral hover:text-sapphire motion-reduce:transition-none"
                    >
                      {localizeName(tag, locale)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="u-prose flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-hairline pt-8">
              <p className="u-micro">{t("post.shareStory")}</p>
              {/* The share row keeps its existing behaviour (analytics +
                  clipboard); the span re-scopes the semantic vars its
                  ui/button consumes to the v3 palette, the same pattern the
                  (v2) layout uses for the LocaleSwitcher. */}
              <span className="[--background:var(--sand)] [--foreground:var(--ink)] [--ring:var(--focus)]">
                <ShareButtons
                  slug={post.slug}
                  title={lp.title}
                  url={postUrl}
                  kind="post"
                />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ 05 · Pieces mentioned here — standard ════════
          Only ever the pieces the article itself points at. */}
      {pieces.length > 0 ? (
        <section
          aria-labelledby="article-pieces-heading"
          className="section-standard bg-mineral"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="article-pieces-heading"
              eyebrow={t("post.relatedProductsEyebrow")}
              title={t("post.relatedProductsHeading")}
            />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {pieces.map((item) => (
                <CatalogProductCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ════════ 06 · More from the journal — standard ════════ */}
      {related.length > 0 ? (
        <section
          aria-labelledby="article-related-heading"
          className={
            pieces.length > 0
              ? "section-standard bg-sand"
              : "section-standard bg-mineral"
          }
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="article-related-heading"
              eyebrow={t("heroEyebrow")}
              title={t("post.moreFromJournal")}
            />
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedPost) => {
                const lr = localize(
                  relatedPost,
                  locale,
                  RELATED_LOCALIZED_FIELDS,
                );
                const relatedCover = isRenderableSrc(relatedPost.coverImage)
                  ? relatedPost.coverImage
                  : null;
                return (
                  <article
                    key={relatedPost.id}
                    className="group relative flex flex-col gap-4"
                  >
                    {relatedCover ? (
                      <MeniscusImage
                        src={sizedExternalSrc(relatedCover, 900)}
                        alt=""
                        width={900}
                        height={675}
                        sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw"
                        unoptimized={!isOptimizableImageSrc(relatedCover)}
                        className="aspect-[4/3] w-full"
                        imageClassName="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex aspect-[4/3] items-center justify-center bg-deep-ocean font-display text-39 text-mineral/60"
                      >
                        {relatedPost.blogCategory
                          ? localizeName(relatedPost.blogCategory, locale).charAt(0)
                          : "R"}
                      </span>
                    )}
                    <p className="u-micro">
                      {relatedPost.blogCategory
                        ? localizeName(relatedPost.blogCategory, locale)
                        : t("journalFallbackCategory")}
                    </p>
                    <h3 className="font-display text-h3 leading-[1.14] tracking-display text-ink">
                      <Link
                        href={`/blog/${relatedPost.slug}`}
                        className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
                      >
                        {lr.title}
                      </Link>
                    </h3>
                    {lr.excerpt ? (
                      <p className="line-clamp-2 font-body text-body leading-relaxed text-graphite">
                        {lr.excerpt}
                      </p>
                    ) : null}
                    <p className="u-micro flex flex-wrap items-center gap-x-2">
                      {relatedPost.publishedAt ? (
                        <>
                          <span>
                            {dateFormatter.format(relatedPost.publishedAt)}
                          </span>
                          <span aria-hidden>·</span>
                        </>
                      ) : null}
                      <span>
                        {t("minRead", { minutes: readMinutes(lr.content) })}
                      </span>
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ════════ 07 · Commission close — light band ════════
          Part 0: ordering stays Inquiry → WhatsApp, via /custom-order.

          Light, not dark. §3.1 forbids adjacent dark bands and the footer is
          obsidian, so a dark band here runs straight into it — the same close
          every other page uses: the cover is this page's dark band, the footer
          is its dark close. */}
      <section
        aria-labelledby="article-cta-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-8">
          <Eyebrow rule={false}>{tCustom("heroEyebrow")}</Eyebrow>
          <h2
            id="article-cta-heading"
            className="max-w-[14ch] font-display text-h2 leading-[1.04] tracking-display text-ink"
          >
            {tCustom("heroHeadline")}
          </h2>
          <p className="u-lede font-body text-body leading-relaxed text-graphite">
            {tCustom("heroLead")}
          </p>
          <Button variant="secondary" size="lg" asChild className="w-fit">
            <Link href="/custom-order">{tNav("customOrder")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
