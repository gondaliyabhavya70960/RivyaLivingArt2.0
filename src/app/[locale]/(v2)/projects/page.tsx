import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
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
import { localize } from "@/lib/localize";
import { cn } from "@/lib/utils";
import { getSiteImageRefs } from "@/lib/site-images-server";
import { SlotImage } from "@/components/storefront/slot-image";

import { PortfolioActiveFilters } from "./filter-bar";

/** ISR: new commission stories reach the page within 5 minutes. */
export const revalidate = 300;

/** 12 case studies per page (server pagination, no client JS). */
const PAGE_SIZE = 12;

type PortfolioSearchParams = {
  category?: string | string[];
  page?: string | string[];
};

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<PortfolioSearchParams>;
};

/* ————————————————— module-level helpers ————————————————— */

/** First non-empty string value of a search param. */
function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/** `?page=` → a positive integer, defaulting to 1 on anything else. */
function parsePage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(first(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Archive URL preserving the category filter; page 1 stays canonical. */
function portfolioHref({
  category,
  page,
}: {
  category?: string;
  page?: number;
}): string {
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (page && page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/projects?${qs}` : "/projects";
}

/**
 * One sentence of the commission's own story, for the hover reveal. Cut at a
 * word boundary — never mid-word, and never with a bare ellipsis standing in
 * for content that exists (§17: no "…" inside an accessible name; this line
 * is decorative and the link carries the full title).
 */
function teaser(story: string, max = 130): string | null {
  const flat = story.trim().replace(/\s+/g, " ");
  if (!flat) return null;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > 60 ? cut.slice(0, at) : cut).replace(/[,;:—-]$/, "")}…`;
}

/**
 * Paged views carry a self-referential canonical (`/projects?page=N`) so
 * crawlable pagination links don't fold every page onto `/projects` as a
 * duplicate — same recipe as the journal (SEO-503). Filter-only views still
 * canonicalise to `/projects`.
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Portfolio.meta" });
  const page = parsePage((await searchParams).page);

  if (page >= 2) {
    return {
      title: t("titlePaged", { page }),
      description: t("description"),
      alternates: localeAlternates(`/projects?page=${page}`, locale),
    };
  }

  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/projects", locale),
  };
}

/* ————————————————— the wall ————————————————— */

/**
 * §11.1: "Masonry grid with varied sizes for rhythm: large 2×2, small 1×1,
 * vertical 1×2." The pattern repeats every four tiles and tiles the grid
 * exactly — at four columns a group fills cols 1–2 (large), col 3 (vertical)
 * and col 4 twice (small), which is two full rows with no gaps; at two
 * columns the same spans fill four rows. Whatever is left over after the last
 * whole group renders small, so a category with three pieces is a tidy row
 * rather than a group with a hole punched in it.
 */
type TileSize = "large" | "tall" | "small";

function sizeFor(index: number, total: number): TileSize {
  const whole = Math.floor(total / 4) * 4;
  if (index >= whole) return "small";
  const slot = index % 4;
  if (slot === 0) return "large";
  if (slot === 1) return "tall";
  return "small";
}

const SPAN: Record<TileSize, string> = {
  large: "md:col-span-2 md:row-span-2",
  tall: "md:row-span-2",
  small: "",
};

/** Mobile has no row grid, so the rhythm is carried by aspect ratio instead. */
const RATIO: Record<TileSize, string> = {
  large: "aspect-[4/3]",
  tall: "aspect-[4/5]",
  small: "aspect-[4/3]",
};

const TILE_SIZES: Record<TileSize, string> = {
  large: "(min-width:1024px) 44vw, (min-width:768px) 92vw, 92vw",
  tall: "(min-width:1024px) 22vw, (min-width:768px) 46vw, 92vw",
  small: "(min-width:1024px) 22vw, (min-width:768px) 46vw, 92vw",
};

type ArchiveTile = {
  id: string;
  slug: string;
  title: string;
  /** Mono project number, zero-padded: "004". */
  number: string;
  category: string | null;
  story: string | null;
  cover: string | null;
  coverAlt: string;
  size: TileSize;
};

/**
 * One case in the wall — REDESIGN.md §11.1.
 *
 * "Card: image · project number (mono) · project name · category. Hover:
 * short story fades up, image scales 1.03, `View project →`."
 *
 * The metadata sits **on** the photograph rather than beneath it, the
 * `CollectionCard` grammar (§4.6): a case study is a doorway, and a caption
 * under a picture reads as a product. It is also what makes the audit's
 * empty-cell fix structural — the text block is the tile, and the photograph
 * is the ground behind it. A case with no cover renders the same block on a
 * deep-ocean ground with its story already open: a **text-only tile, never a
 * blank**.
 *
 * The link carries the full project name as its accessible name; the arrow
 * and the story are decorative additions revealed on hover and focus.
 */
function CaseTile({
  tile,
  viewLabel,
}: {
  tile: ArchiveTile;
  /** Pre-translated "View project" — decorative, `aria-hidden` in place. */
  viewLabel: string;
}) {
  const hasCover = tile.cover !== null;
  const display = tile.size === "large" ? "text-h3" : "text-20";

  return (
    <article className="group relative h-full">
      <div
        className={cn(
          "relative isolate overflow-hidden rounded-image md:h-full",
          RATIO[tile.size],
          "md:aspect-auto",
          hasCover ? "bg-sand" : "bg-deep-ocean",
        )}
      >
        {hasCover && tile.cover ? (
          <MeniscusImage
            src={sizedExternalSrc(tile.cover, 1400)}
            alt={tile.coverAlt}
            fill
            sizes={TILE_SIZES[tile.size]}
            unoptimized={!isOptimizableImageSrc(tile.cover)}
            className="absolute inset-0"
            imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}

        {/* A bottom-weighted scrim, stopped well short of the top edge so the
            photograph stays the subject. The stops are placed rather than
            evenly spaced: the metadata block starts around 55% up a small
            tile, and every line of it has to clear 4.5:1 there, whatever the
            photograph underneath happens to be doing (Part 17). A text-only
            tile gets no scrim — its ground is already deep ocean. */}
        {hasCover ? (
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-obsidian/95 from-10% via-obsidian/75 via-60% to-transparent"
          />
        ) : null}

        <div
          data-theme="navy"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 md:p-6"
        >
          <p className="u-micro text-mineral/85">{tile.number}</p>
          <h3
            className={cn("font-display leading-[1.12] text-mineral", display)}
          >
            <Link
              href={`/projects/${tile.slug}`}
              className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-image focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              {tile.title}
            </Link>
          </h3>
          {tile.category ? (
            <p className="u-micro text-mineral/85">{tile.category}</p>
          ) : null}

          {/* The hover reveal — a `0fr → 1fr` row (the accordion's motion,
              Part 14) so the story pushes nothing around when it is closed.
              A text-only tile has no photograph to protect, so its story and
              cue rest open. Both are decorative: the link above already
              carries the full project name. */}
          <div
            aria-hidden
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
              hasCover
                ? "grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100"
                : "grid-rows-[1fr] opacity-100",
            )}
          >
            <div className="flex flex-col gap-3 overflow-hidden pt-2">
              {tile.story ? (
                <p className="font-body text-14 leading-relaxed text-mineral/80">
                  {tile.story}
                </p>
              ) : null}
              <span className="inline-flex items-center gap-2 font-body text-14 font-medium text-champagne">
                {viewLabel}
                <ArrowRight
                  strokeWidth={1.5}
                  className="size-4 rtl:-scale-x-100"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ————————————————— page ————————————————— */

/**
 * The commission archive — REDESIGN.md §11.1, "an art-gallery experience,
 * not a list".
 *
 * Three sections, two of them the whole point: a dark hero carrying the index
 * line in mono, the wall itself, and a commission band. Two audit defects are
 * fixed here rather than papered over:
 *
 * 1. **No empty cells.** A case without a renderable cover is a text-only
 *    tile (see `CaseTile`), so a missing photograph costs the grid its
 *    picture and nothing else.
 * 2. **The empty state tells the truth.** It renders only when a filter
 *    returns nothing. The "yours could be first" line it used to carry —
 *    printed underneath twenty published case studies — now lives in the
 *    closing commission band, where it is a real invitation rather than a false
 *    claim about the studio's work.
 *
 * The index line (`20 COMMISSIONS · 2026 · 7 COLLECTIONS`) is read from the
 * database every request: the count of published pieces, the range of years
 * they carry, and the number of collections they actually fall into. Nothing
 * in it is a constant.
 */
export default async function PortfolioPage({
  params: localeParams,
  searchParams,
}: PageProps) {
  const { locale } = await localeParams;
  setRequestLocale(locale);

  const t = await getTranslations("Portfolio");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  const params = await searchParams;
  const activeCategory = first(params.category);
  const page = parsePage(params.page);

  const where = {
    status: "PUBLISHED" as const,
    ...(activeCategory ? { category: { slug: activeCategory } } : {}),
  };

  // Project numbers (audit CS-01): position in createdAt-asc order across
  // every published piece — stable per piece, category filters included.
  // The same rows carry the index line's raw material, so the archive reads
  // its own totals rather than restating a number written by hand.
  const numberRows = await db.portfolio.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, year: true, createdAt: true },
  });
  const projectNumbers = new Map(numberRows.map((row, i) => [row.id, i + 1]));

  const [portfolios, totalCount, categories, imageRefs] = await Promise.all([
    db.portfolio.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        story: true,
        location: true,
        year: true,
        translations: true,
        afterImageUrl: true,
        category: { select: { name: true, translations: true } },
        images: {
          select: { url: true, alt: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
    }),
    db.portfolio.count({ where }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: {
        slug: true,
        name: true,
        translations: true,
        _count: {
          select: { portfolios: { where: { status: "PUBLISHED" } } },
        },
      },
    }),
    getSiteImageRefs(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const filterChips = categories
    .filter((category) => category._count.portfolios > 0)
    .map((category) => ({
      slug: category.slug,
      name: localize(category, locale, ["name"]).name,
      count: category._count.portfolios,
    }));
  /* Resolved against EVERY category, not just the ones with published work:
     a bookmarked `?category=` for an empty collection must still name itself
     in the active-filter row, or the one control that can undo it is missing
     from exactly the view that needs it most (§7.5). */
  const activeCategoryRow = activeCategory
    ? (categories.find((category) => category.slug === activeCategory) ?? null)
    : null;
  const activeChipLabel = activeCategoryRow
    ? localize(activeCategoryRow, locale, ["name"]).name
    : null;

  /* The index line, entirely from data. `year` is the owner's field; where a
     piece has none, the year it entered the studio stands in, so the range is
     always real. A single year prints as one number, not "2026–2026". */
  const years = numberRows.map(
    (row) => row.year ?? row.createdAt.getUTCFullYear(),
  );
  const yearSpan = years.length
    ? Math.min(...years) === Math.max(...years)
      ? String(Math.min(...years))
      : `${Math.min(...years)}–${Math.max(...years)}`
    : null;

  const items: ArchiveTile[] = portfolios.map((portfolio, index) => {
    const lp = localize(portfolio, locale, ["title", "story"]);
    const categoryName = portfolio.category
      ? localize(portfolio.category, locale, ["name"]).name
      : null;
    // "Wedding keepsake · Surat · 2026" — whichever of the three the owner
    // actually filled; the line shrinks rather than inventing a placeholder.
    const caption =
      [categoryName, portfolio.location, portfolio.year]
        .filter(Boolean)
        .join(" · ") || null;
    const cover = portfolio.afterImageUrl ?? portfolio.images[0]?.url ?? null;

    return {
      id: portfolio.id,
      slug: portfolio.slug,
      title: lp.title,
      number: t("projectNumber", {
        number: String(projectNumbers.get(portfolio.id) ?? 0).padStart(3, "0"),
      }),
      category: caption,
      story: teaser(lp.story),
      cover: isRenderableSrc(cover) ? cover : null,
      coverAlt: portfolio.images[0]?.alt?.trim() || lp.title,
      size: sizeFor(index, portfolios.length),
    };
  });

  return (
    <>
      {/* ════════ 01 · Hero — dark band, the index line in mono ════════
          `/projects` is a transparent-navbar route, so the band pulls up
          under the 80px header slot. The banner is the LCP: `priority`,
          never revealed, never animated (Part 14). */}
      <section
        data-theme="navy"
        aria-labelledby="archive-heading"
        className="relative -mt-20 flex min-h-[70svh] flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        <div aria-hidden className="absolute inset-0">
          <SlotImage
            slot={imageRefs["portfolio.hero"]}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/55 to-obsidian/40" />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-20">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("portfolio") },
            ]}
          />

          <Eyebrow rule={false} className="text-champagne">
            {t("heroEyebrow")}
          </Eyebrow>

          <h1
            id="archive-heading"
            className="max-w-[14ch] font-display text-h1 leading-[1.02] tracking-display text-mineral"
          >
            {t("heroHeadline")}
          </h1>

          <p className="u-prose font-body text-body leading-relaxed text-mist">
            {t("heroLead")}
          </p>

          {/* §11.1's index line — every value read from the database. */}
          <p className="u-micro flex flex-wrap items-center gap-x-3 gap-y-2 text-mist">
            <span>{t("index.commissions", { count: numberRows.length })}</span>
            {yearSpan ? (
              <>
                <span aria-hidden>·</span>
                <span>{yearSpan}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>{t("index.collections", { count: filterChips.length })}</span>
          </p>
        </div>
      </section>

      {/* ════════ 02 · The wall — standard, on mineral ════════ */}
      <section
        aria-labelledby="wall-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-10">
          <h2 id="wall-heading" className="sr-only">
            {t("wallHeading")}
          </h2>

          {filterChips.length > 0 ? (
            <div className="flex flex-col gap-5">
              <nav aria-label={t("filterAria")}>
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <ChipLink href={portfolioHref({})} active={!activeCategory}>
                      {t("allCommissions")}
                    </ChipLink>
                  </li>
                  {filterChips.map((chip) => (
                    <li key={chip.slug}>
                      <ChipLink
                        href={portfolioHref({ category: chip.slug })}
                        active={activeCategory === chip.slug}
                        count={chip.count}
                      >
                        {chip.name}
                      </ChipLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <PortfolioActiveFilters
                label={activeChipLabel}
                clearHref={portfolioHref({})}
                count={totalCount}
                countLabel={t("countLabel", { count: totalCount })}
                clearAllLabel={t("clearAll")}
                // Raw template — ActiveFilters substitutes {filter} itself.
                removeLabel={String(t.raw("removeFilter"))}
              />
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul
              className={cn(
                "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6",
                "md:auto-rows-[15rem] lg:auto-rows-[13.5rem] lg:grid-cols-4",
              )}
            >
              {items.map((tile) => (
                <li key={tile.id} className={cn("min-w-0", SPAN[tile.size])}>
                  <CaseTile tile={tile} viewLabel={t("viewProject")} />
                </li>
              ))}
            </ul>
          ) : (
            /* §16 · §4.6 — conditionally rendered, and only ever true: this
               branch exists solely for a filter that matched nothing. */
            <EmptyState
              statement={t("filterEmpty.statement")}
              direction={t("filterEmpty.direction")}
              headingLevel="h3"
              action={
                <Button asChild variant="primary" size="lg">
                  <Link href={portfolioHref({})}>
                    {t("filterEmpty.action")}
                  </Link>
                </Button>
              }
            />
          )}

          {totalPages > 1 ? (
            <div className="flex justify-center pt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                hrefFor={(p) =>
                  portfolioHref({ category: activeCategory, page: p })
                }
                labels={{
                  label: tCommon("pagination.label"),
                  previous: tCommon("pagination.previous"),
                  next: tCommon("pagination.next"),
                  // Raw template — the component substitutes {number} itself.
                  page: String(tCommon.raw("pagination.page")),
                }}
                pageOfLabel={t("pageOf", { page, totalPages })}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* ════════ 03 · The commission band ════════
          Where "yours could be first" is true: an invitation, not a claim
          that the archive above is empty. Ordering stays Inquiry → WhatsApp
          (Part 0) through /custom-order.

          Sand, not obsidian: the chrome closes every page with its own dark
          commission band, and §3.1 forbids two dark bands touching. The
          hero is this page's one dark band. */}
      <section
        aria-labelledby="commission-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-8">
          <SectionHeading
            id="commission-heading"
            eyebrow={t("emptyEyebrow")}
            title={t("emptyHeading")}
            intro={t("emptyBody")}
          />
          <Button asChild variant="primary" size="lg" className="w-fit">
            <Link href="/custom-order">
              {t("emptyCta")}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

/**
 * A filter chip that is a link — the visual grammar of the shared
 * `FilterChip` (§4.6) with an `<a>` underneath, because the archive's
 * filters are bookmarkable, crawlable GET URLs and must survive with no
 * JavaScript. Selected state is a sand fill plus weight plus sapphire ink,
 * never colour alone (Part 17); `h-11` holds the 44px tap floor.
 */
function ChipLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-body text-small whitespace-nowrap outline-none",
        "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3",
        active
          ? "border-sand bg-sand font-medium text-sapphire"
          : "border-hairline bg-transparent text-ink hover:bg-sand",
      )}
    >
      {children}
      {count != null ? (
        <span className="u-num text-12 text-graphite">{count}</span>
      ) : null}
    </Link>
  );
}
