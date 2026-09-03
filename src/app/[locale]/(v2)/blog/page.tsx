import type { Metadata } from "next";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { NewsletterSignup } from "@/components/storefront/newsletter-signup";
import { Pagination } from "@/components/storefront/pagination";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { db } from "@/lib/db";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { localize, localizeName } from "@/lib/localize";
import { cn } from "@/lib/utils";
import { demoWhere } from "@/lib/demo-content";

/** ISR: studio edits reach the journal within 5 minutes. */
export const revalidate = 300;

/**
 * Page 2+ carries a self-referential canonical (`/blog?page=N`) so crawlable
 * pagination links don't fold every page onto `/blog` as a duplicate (SEO-503).
 * Filter-only views (?category=/?tag= with no page) still canonicalise to
 * `/blog` — only the `page` param changes the canonical.
 */
export async function generateMetadata({
  params: localeParams,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale } = await localeParams;
  const t = await getTranslations({ locale, namespace: "Blog.meta" });
  const params = await searchParams;
  const pageParam = Number.parseInt(first(params.page) ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  if (page >= 2) {
    return {
      title: t("titlePaged", { page }),
      description: t("description"),
      alternates: localeAlternates(`/blog?page=${page}`, locale),
    };
  }

  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/blog", locale),
  };
}

const PAGE_SIZE = 12;

/**
 * Dates are formatted on the server so no client re-render can shift them;
 * the formatter itself is built per request from the active locale.
 */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The card shape both the featured lead and the grid entries need. */
type PostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: Date | null;
  content: unknown;
  /** Per-locale overrides; localized into title/excerpt for the card. */
  translations: unknown;
  /** Already localized by the time a card renders — see `localizedPosts`. */
  blogCategory: { name: string; slug: string } | null;
};

/* ————————————————— module-level helpers ————————————————— */

/** First non-empty string value of a search param. */
function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Depth-first plain-text extraction from stored Tiptap JSON
 * (`{ type: "doc", content: [...] }`). Tolerates the Prisma default `{}`,
 * null and malformed nodes — anything unreadable contributes nothing.
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

/** /blog href preserving the active filters; page 1 stays clean. */
function blogHref(params: {
  category?: string;
  tag?: string;
  page?: number;
}): string {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

/* ————————————————— presentational pieces ————————————————— */

/* The pill grammar of `FilterChip` (§4.6 · §7.5), rendered as a link.
   The journal's filters are bookmarkable GET views — the footer ships
   `/blog?category=behind-the-studio` and `/blog?category=gift-guides` as real
   destinations — so these cannot be the client toggle button the shop's
   drawer uses. The classes are the chip's, deliberately: two visual
   grammars for one control would be worse than one shared string. */
const CHIP =
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-hairline px-4 font-body text-small whitespace-nowrap transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none";

function ChipLink({
  href,
  active,
  ariaLabel,
  children,
}: {
  href: string;
  active?: boolean;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      aria-current={active ? "true" : undefined}
      className={cn(
        CHIP,
        active
          ? "bg-sand font-medium text-sapphire"
          : "bg-transparent text-ink hover:bg-sand",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The journal card — §11.8: "category · image · title · short excerpt · date ·
 * read time. **No borders.**" The whole card is the target; the title carries
 * the full text so the accessible name never ends in an ellipsis (Part 17).
 */
function JournalCard({
  post,
  labels,
  dateFormatter,
  featured = false,
}: {
  post: PostCard;
  labels: { fallbackCategory: string; minRead: (m: number) => string };
  dateFormatter: Intl.DateTimeFormat;
  featured?: boolean;
}) {
  const cover = isRenderableSrc(post.coverImage) ? post.coverImage : null;
  const minutes = readMinutes(post.content);

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4",
        featured && "lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-12",
      )}
    >
      {cover ? (
        <MeniscusImage
          src={sizedExternalSrc(cover, featured ? 1600 : 900)}
          alt=""
          width={featured ? 1600 : 900}
          height={featured ? 1000 : 675}
          sizes={
            featured
              ? "(min-width:1024px) 58vw, 100vw"
              : "(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw"
          }
          /* The lead story is the page's LCP: `priority` mounts it plain and
             un-revealed (Part 14 forbids animating the LCP element). */
          priority={featured}
          unoptimized={!isOptimizableImageSrc(cover)}
          className={cn(
            "w-full",
            featured ? "aspect-[16/10] lg:col-span-7" : "aspect-[4/3]",
          )}
          imageClassName="object-cover"
        />
      ) : (
        /* A cover-less entry is still an entry — never a blank tile. */
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center bg-deep-ocean font-display text-mineral/60",
            featured
              ? "aspect-[16/10] text-61 lg:col-span-7"
              : "aspect-[4/3] text-39",
          )}
        >
          {post.blogCategory?.name.charAt(0) ?? "R"}
        </span>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-col gap-3",
          featured && "lg:col-span-4 lg:col-start-9",
        )}
      >
        <p className="u-micro">
          {post.blogCategory?.name ?? labels.fallbackCategory}
        </p>
        {featured ? (
          <h2 className="font-display text-h2 leading-[1.06] tracking-display text-ink">
            <Link
              href={`/blog/${post.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              {post.title}
            </Link>
          </h2>
        ) : (
          <h3 className="font-display text-h3 leading-[1.14] tracking-display text-ink">
            <Link
              href={`/blog/${post.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              {post.title}
            </Link>
          </h3>
        )}
        {post.excerpt ? (
          <p
            className={cn(
              "font-body text-body leading-relaxed text-graphite",
              featured ? "u-prose line-clamp-4" : "line-clamp-2",
            )}
          >
            {post.excerpt}
          </p>
        ) : null}
        <p className="u-micro flex flex-wrap items-center gap-x-2">
          {post.publishedAt ? (
            <>
              <span>{dateFormatter.format(post.publishedAt)}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span>{labels.minRead(minutes)}</span>
        </p>
      </div>
    </article>
  );
}

/* ————————————————— page —————————————————
 *
 * The journal index — REDESIGN.md §11.8.
 *
 * > "The blog currently exposes **195 tags**, which is substantial visual
 * > noise. Keep the data and functionality; simply do not expose all 195."
 *
 * So the 195-chip cloud and its "All tags" disclosure are gone from this
 * page, and nothing about the data or the query changed: `?tag=` still
 * filters exactly as it did, the footer's `?category=` deep links still land,
 * and every tag stays reachable — from the article that uses it, which is
 * where a reader actually picks a topic up. When a tag filter IS active it
 * renders as one removable chip, so the view is always legible and always
 * undoable (§7.5).
 *
 * Category navigation is the six real `BlogCategory` rows, read from the
 * database — §11.8's named list is the spec's guess at what those rows are,
 * and the rows win (Part 0: owner-fed content only).
 *
 * Band rhythm: mineral masthead → sand lead story → mineral archive →
 * obsidian newsletter. One dark band, none adjacent, no `section-major`.
 */
export default async function BlogPage({
  params: localeParams,
  searchParams,
}: PageProps) {
  const { locale } = await localeParams;
  setRequestLocale(locale);

  const [t, tNav, tCommon] = await Promise.all([
    getTranslations("Blog"),
    getTranslations("Nav"),
    getTranslations("Common"),
  ]);

  // Server-side date formatting in the request locale (the page stays SSR).
  const dateFormatter = new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS);

  const params = await searchParams;
  const activeCategory = first(params.category);
  const activeTag = first(params.tag);
  const pageParam = Number.parseInt(first(params.page) ?? "1", 10);
  const requestedPage =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const demo = await demoWhere();
  const where = {
    status: "PUBLISHED" as const,
    ...demo,
    ...(activeCategory && { blogCategory: { slug: activeCategory } }),
    ...(activeTag && { tags: { some: { slug: activeTag } } }),
  };

  const [total, categories, activeTagRow] = await Promise.all([
    db.blogPost.count({ where }),
    db.blogCategory.findMany({
      // A demo category is listed only while its (demo) posts are shown.
      where: { ...demo, posts: { some: { status: "PUBLISHED", ...demo } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, translations: true },
    }),
    // Only the ONE tag a visitor is filtering by is read — the other 194 are
    // never queried, let alone rendered.
    activeTag
      ? db.tag.findUnique({
          where: { slug: activeTag },
          select: { name: true, slug: true, translations: true },
        })
      : null,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const posts: PostCard[] =
    total === 0
      ? []
      : await db.blogPost.findMany({
          where,
          orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          // Card-shaped select — no full-row hydration (SEO fields, author,
          // timestamps). content + translations stay: readMinutes() and
          // localize() need them.
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            coverImage: true,
            publishedAt: true,
            content: true,
            translations: true,
            blogCategory: {
              select: { name: true, slug: true, translations: true },
            },
          },
        });

  // Localize card prose (title/excerpt) AND the category label for the active
  // locale. Content stays the base — the reading view on the detail page
  // localizes it.
  const localizedPosts = posts.map((post) => {
    const lp = localize(post, locale, ["title", "excerpt"]);
    return {
      ...post,
      title: lp.title,
      excerpt: lp.excerpt,
      blogCategory: post.blogCategory
        ? {
            ...post.blogCategory,
            name: localizeName(post.blogCategory, locale),
          }
        : null,
    };
  });

  // The first post of page 1 leads; deeper pages are all grid.
  const featured = page === 1 ? localizedPosts[0] : undefined;
  const gridPosts = page === 1 ? localizedPosts.slice(1) : localizedPosts;
  const filtered = Boolean(activeCategory || activeTag);

  const labels = {
    fallbackCategory: t("journalFallbackCategory"),
    minRead: (minutes: number) => t("minRead", { minutes }),
  };

  return (
    <>
      {/* ════════ 01 · Masthead — standard ════════
          Trail, eyebrow, the page's single h1, and the category rail. */}
      <section
        aria-labelledby="journal-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("blog") },
            ]}
          />

          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-5 lg:col-span-7">
              <Eyebrow>{t("heroEyebrow")}</Eyebrow>
              <h1
                id="journal-heading"
                className="max-w-[14ch] font-display text-h1 leading-[1.02] tracking-display"
              >
                {t("heroHeadline")}
              </h1>
            </div>
            <p className="u-lede font-body text-body leading-relaxed text-graphite lg:col-span-4 lg:col-start-9">
              {t("heroLead")}
            </p>
          </div>

          {/* §11.8 02 — "Category navigation: only the major ones." The six
              real BlogCategory rows, plus the way back to everything. */}
          {categories.length > 0 ? (
            <nav aria-label={tNav("journal")} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ChipLink
                  href={blogHref({ tag: activeTag })}
                  active={!activeCategory}
                >
                  {t("allPosts")}
                </ChipLink>
                {categories.map((category) => (
                  <ChipLink
                    key={category.id}
                    href={blogHref({
                      category: category.slug,
                      tag: activeTag,
                    })}
                    active={activeCategory === category.slug}
                  >
                    {localizeName(category, locale)}
                  </ChipLink>
                ))}
              </div>

              {/* The one place a tag is ever shown on this page: the one in
                  effect, with a way to drop it (§7.5). */}
              {activeTagRow ? (
                <div className="flex flex-wrap items-center gap-3">
                  <ChipLink
                    href={blogHref({ category: activeCategory })}
                    ariaLabel={t("removeTag", {
                      tag: localizeName(activeTagRow, locale),
                    })}
                  >
                    <span className="text-sapphire">
                      {t("taggedLabel", {
                        tag: localizeName(activeTagRow, locale),
                      })}
                    </span>
                    <X aria-hidden strokeWidth={1.5} className="-me-1 size-4" />
                  </ChipLink>
                  <p role="status" className="u-micro">
                    {t("entryCount", { count: total })}
                  </p>
                </div>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>

      {/* Part 16 · the empty state is conditionally rendered — never beside
          populated content. */}
      {localizedPosts.length === 0 ? (
        <section className="section-standard bg-sand">
          <div className="u-shell">
            <EmptyState
              statement={
                filtered ? t("emptyStatement") : t("emptyStatementUnfiltered")
              }
              direction={
                filtered ? t("emptyDirection") : t("emptyDirectionUnfiltered")
              }
              action={
                filtered ? (
                  <Button asChild variant="primary" size="lg">
                    <Link href="/blog">{t("viewAllPosts")}</Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        </section>
      ) : (
        <>
          {/* ════════ 02 · The lead story — standard ════════ */}
          {featured ? (
            <section className="section-standard bg-sand">
              <div className="u-shell flex flex-col gap-10">
                <Eyebrow>{t("featuredEyebrow")}</Eyebrow>
                <JournalCard
                  post={featured}
                  labels={labels}
                  dateFormatter={dateFormatter}
                  featured
                />
              </div>
            </section>
          ) : null}

          {/* ════════ 03 · The archive — standard ════════
              Three columns, no borders, then numbered pagination. */}
          {gridPosts.length > 0 || totalPages > 1 ? (
            <section
              aria-labelledby="archive-heading"
              className="section-standard bg-mineral"
            >
              <div className="u-shell flex flex-col gap-12">
                <SectionHeading
                  id="archive-heading"
                  eyebrow={t("archiveEyebrow")}
                  title={t("archiveHeading")}
                />

                {gridPosts.length > 0 ? (
                  <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                    {gridPosts.map((post) => (
                      <JournalCard
                        key={post.id}
                        post={post}
                        labels={labels}
                        dateFormatter={dateFormatter}
                      />
                    ))}
                  </div>
                ) : null}

                {totalPages > 1 ? (
                  <div className="flex justify-center border-t border-hairline pt-10">
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      hrefFor={(p) =>
                        blogHref({
                          category: activeCategory,
                          tag: activeTag,
                          page: p,
                        })
                      }
                      labels={{
                        label: tCommon("pagination.label"),
                        previous: tCommon("pagination.previous"),
                        next: tCommon("pagination.next"),
                        // Raw template — the component substitutes {number}.
                        page: String(tCommon.raw("pagination.page")),
                      }}
                      pageOfLabel={t("pageOf", { page, totalPages })}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* ════════ 04 · Newsletter — the second of §5.8's two placements ════════
          §5.8 calls for a dark section; §3.1 forbids two dark grounds touching,
          and the obsidian footer sits immediately below. The footer's own band
          carries the dark weight, one band lower — so this one is sand. */}
      <section className="bg-sand">
        <div className="u-shell section-standard">
          <NewsletterSignup source="journal" />
        </div>
      </section>
    </>
  );
}
