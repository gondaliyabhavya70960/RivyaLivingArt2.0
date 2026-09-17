import { detailOpenGraph } from "@/app/shared-metadata";
import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Eye } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { BeforeAfter } from "@/components/portfolio/before-after";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { LightboxGallery } from "@/components/portfolio/lightbox-gallery";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink } from "@/lib/whatsapp";
import { demoWhere, showDemoContent } from "@/lib/demo-content";

/** ISR: studio edits reach the page within 5 minutes. */
export const revalidate = 300;
export const dynamicParams = true;

/**
 * ISR registration (audit C2): no paths are prerendered at build time, but
 * declaring generateStaticParams marks the route static-capable — each slug
 * is rendered on first request, then cached and revalidated on the
 * `revalidate` interval.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Non-empty static params flip Next 16's on-demand ISR for all slugs
  // (see blog/[slug]); recent cases prerender, the rest cache on demand.
  try {
    const cases = await db.portfolio.findMany({
      // Never prerender a fixture; a shown demo case renders on request.
      where: { status: "PUBLISHED", isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { slug: true },
    });
    return cases.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/* ————————————————— module-level helpers ————————————————— */

/** Pull a non-empty string out of the resultsMeta Json column. */
function metaString(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Pull a non-empty string array (e.g. tags) out of resultsMeta. */
function metaStringList(meta: unknown, key: string): string[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const value = (meta as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim() !== "",
    )
    .map((entry) => entry.trim());
}

/**
 * Seeded case stories are multi-paragraph, separated by blank lines. Split on
 * double newlines so each becomes a real <p>; single newlines survive inside
 * a paragraph via `whitespace-pre-line`.
 */
function splitParagraphs(story: string): string[] {
  return story
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * Dates are formatted on the server so hydration stays deterministic; the
 * formatter itself is built per request from the active locale.
 */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

// cache() dedupes the fetch so generateMetadata + the page component share a
// single query per request instead of hitting Postgres twice (PERF-307).
const getPortfolio = cache((slug: string) =>
  db.portfolio.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { order: "asc" } },
      category: true,
    },
  }),
);

const RELATED_INCLUDE = {
  images: { orderBy: { order: "asc" as const }, take: 1 },
  category: true,
};

/** 3 other published portfolios — same category first, filled with latest. */
async function getRelated(portfolioId: string, categoryId: string | null) {
  const demo = await demoWhere();
  const sameCategory = categoryId
    ? await db.portfolio.findMany({
        where: {
          status: "PUBLISHED",
          ...demo,
          id: { not: portfolioId },
          categoryId,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: RELATED_INCLUDE,
      })
    : [];

  if (sameCategory.length >= 3) return sameCategory;

  const fill = await db.portfolio.findMany({
    where: {
      status: "PUBLISHED",
      ...demo,
      id: { notIn: [portfolioId, ...sameCategory.map((p) => p.id)] },
    },
    orderBy: { createdAt: "desc" },
    take: 3 - sameCategory.length,
    include: RELATED_INCLUDE,
  });

  return [...sameCategory, ...fill];
}

const TILE_SIZES = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw";

type RelatedItem = {
  id: string;
  slug: string;
  title: string;
  categoryName: string | null;
  image: { url: string; alt: string } | null;
};

/**
 * A neighbouring commission. The archive's tile grammar at a quieter weight:
 * photograph, then the piece's name and its collection in mono. A piece with
 * no photograph still renders its name — the same no-blank-cells rule the
 * archive follows (§11.1).
 */
function RelatedTile({ item }: { item: RelatedItem }) {
  return (
    <article className="group relative flex flex-col gap-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-sand">
        {item.image ? (
          <MeniscusImage
            src={sizedExternalSrc(item.image.url, 900)}
            alt={item.image.alt}
            fill
            sizes={TILE_SIZES}
            unoptimized={!isOptimizableImageSrc(item.image.url)}
            className="absolute inset-0"
            imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-end bg-deep-ocean p-5"
          />
        )}
      </div>
      <h3 className="font-body text-16 leading-snug font-medium text-ink">
        <Link
          href={`/portfolio/${item.slug}`}
          className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
        >
          {item.title}
        </Link>
      </h3>
      {item.categoryName ? (
        <p className="u-micro">{item.categoryName}</p>
      ) : null}
    </article>
  );
}

/* ————————————————— metadata ————————————————— */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const portfolio = await getPortfolio(slug);
  if (!portfolio) {
    const t = await getTranslations({ locale, namespace: "Portfolio.meta" });
    return { title: t("notFound") };
  }
  // Metadata runs before the page body, so the body's demo gate alone let a
  // hidden fixture's title reach the not-found page's <title>.
  if (portfolio.isDemo && !(await draftMode()).isEnabled && !(await showDemoContent())) {
    notFound();
  }
  const lp = localize(portfolio, locale, TRANSLATABLE_FIELDS.portfolio);

  const condensed = lp.story.trim().replace(/\s+/g, " ");
  const description = condensed
    ? condensed.length > 160
      ? `${condensed.slice(0, 157)}…`
      : condensed
    : undefined;
  const ogSource = portfolio.afterImageUrl || portfolio.images[0]?.url;

  return {
    title: lp.title,
    description,
    alternates: localeAlternates(`/portfolio/${portfolio.slug}`, locale),
    robots:
      portfolio.status !== "PUBLISHED" || portfolio.isDemo
        ? { index: false, follow: false }
        : undefined,
    openGraph: {
      ...detailOpenGraph(locale),
      title: lp.title,
      description,
      url: `${SITE.url}/portfolio/${portfolio.slug}`,
      // Widen the source chain to the gallery, and leave the key absent when
      // there's nothing so the branded Satori card takes over (MKT-204).
      ...(ogSource && isRenderableSrc(ogSource)
        ? {
            images: [
              ogSource.startsWith("/") ? `${SITE.url}${ogSource}` : ogSource,
            ],
          }
        : {}),
    },
  };
}

/* ————————————————— page —————————————————
 *
 * The case study — REDESIGN.md §11.2.
 *
 * "Hero image → project title → category → short story, then THE BRIEF · THE
 * MATERIAL · THE PROCESS · THE FINAL PIECE · COMMISSION SIMILAR."
 *
 * The story runs in columns 1–7 with a **sticky mono spec rail in 9–12** —
 * Type · Material · Technique · Complexity · Timeline · Completed — so the
 * commission's vitals stay beside the prose instead of flashing past as a
 * strip at the top. Every named section renders only when the owner actually
 * filled it: an empty panel must not render (§4.6), and Part 0 forbids
 * writing one to fill the gap.
 *
 * Two audit fixes ride along:
 *
 * - **Duplicate gallery frames are gone.** Five seeded cases —
 *   `case-seaside-shell-candle` among them — repeat their first image, and
 *   `LightboxGallery` now de-duplicates by URL, so THE FINAL PIECE shows each
 *   photograph once and the lightbox counter states a true total.
 * - **Every frame is captioned in mono.** Captions are where craft
 *   credibility lives (§11.2): each frame carries its plate number, plus the
 *   row's own description whenever that says more than the title already does.
 *
 * Band rhythm (§3.1): dark hero → story → dark material → final piece →
 * related → dark commission. Three dark bands, none adjacent.
 * The per-case WhatsApp prefill is untouched (Part 0).
 */
export default async function PortfolioDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // Staff-gated draft preview rides Next's draft-mode cookie, minted only by
  // the auth-checked /api/draft route handler (ENG-802). Reading draftMode()
  // — unlike searchParams — keeps this route ISR-cacheable (audit C2).
  const { isEnabled: preview } = await draftMode();

  const portfolio = await getPortfolio(slug);
  if (!portfolio) notFound();
  // Drafts are visible only with the staff preview link.
  if (portfolio.status !== "PUBLISHED" && !preview) notFound();
  // A demo case is a 404 unless the owner shows demo content (or staff preview).
  if (portfolio.isDemo && !preview && !(await showDemoContent())) notFound();

  const t = await getTranslations("Portfolio.case");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  // Localized view (no-op for English / when nothing stored). `portfolio` keeps
  // the non-translatable data (images, dates, resultsMeta, slug, status);
  // `category` localizes just the displayed category name.
  const lp = localize(portfolio, locale, TRANSLATABLE_FIELDS.portfolio);
  const category = portfolio.category
    ? localize(portfolio.category, locale, TRANSLATABLE_FIELDS.category)
    : null;

  const related = await getRelated(portfolio.id, portfolio.categoryId);

  /* ——— serialize/derive plain values on the server ——— */

  // Server-side date formatting in the request locale (no client hydration).
  const dateFormatter = new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS);
  const createdLabel = dateFormatter.format(portfolio.createdAt);

  /* The sticky spec rail — §11.2's six rows, in the spec's own order, and
     only the ones this commission carries. `Completed` is always true: it is
     the row's own timestamp, not an owner field that can be missing. */
  const specs: { key: string; label: string; value: string }[] = (
    [
      ["type", t("specType")],
      ["material", t("specMaterial")],
      ["technique", t("specTechnique")],
      ["complexity", t("specComplexity")],
      ["timeline", t("specTimeline")],
    ] as const
  )
    .map(([key, label]) => ({
      key: key as string,
      label,
      value: metaString(portfolio.resultsMeta, key),
    }))
    .filter(
      (spec): spec is { key: string; label: string; value: string } =>
        !!spec.value,
    );
  specs.push({
    key: "completed",
    label: t("specCompleted"),
    value: createdLabel,
  });

  /* The stat row — the bench figures, in mono, where the owner recorded
     them. §11.2's example (`LAYERS 4 · CURE 96 H · GRIT 400→3000 · BUILD 11
     DAYS`) maps onto four optional resultsMeta keys plus the piece's size;
     nothing here is computed, guessed or padded, so a case that records none
     of them simply has no stat row. */
  const stats = (
    [
      ["layers", t("statLayers")],
      ["cure", t("statCure")],
      ["grit", t("statGrit")],
      ["build", t("statBuild")],
      ["size", t("specSize")],
    ] as const
  )
    .map(([key, label]) => ({
      key: key as string,
      label,
      value: metaString(portfolio.resultsMeta, key),
    }))
    .filter(
      (stat): stat is { key: string; label: string; value: string } =>
        !!stat.value,
    );

  const tags = metaStringList(portfolio.resultsMeta, "tags");
  const paragraphs = splitParagraphs(lp.story);
  // Case-study narrative (audit CS-01) — each renders only when the owner
  // filled it; clientNote is real client words only (no-invented-content).
  const briefParagraphs = splitParagraphs(lp.brief ?? "");
  const processParagraphs = splitParagraphs(lp.process ?? "");
  const clientNote = lp.clientNote?.trim() ?? "";

  const material = metaString(portfolio.resultsMeta, "material");
  const technique = metaString(portfolio.resultsMeta, "technique");

  // The finished piece leads the page: full-bleed cover from the after shot,
  // falling back through the gallery. Decorative (alt="") — the h1 names it.
  const coverUrl =
    [
      portfolio.afterImageUrl,
      ...portfolio.images.map((image) => image.url),
    ].find((url) => isRenderableSrc(url)) ?? null;

  /* A transformation, not a pair of stills: the slider only exists when the
     owner recorded BOTH sides of it (§11.2). */
  const beforeAfter =
    isRenderableSrc(portfolio.beforeImageUrl) &&
    isRenderableSrc(portfolio.afterImageUrl)
      ? {
          before: {
            url: portfolio.beforeImageUrl,
            alt: t("beforeAlt", { title: lp.title }),
          },
          after: {
            url: portfolio.afterImageUrl,
            alt: t("afterAlt", { title: lp.title }),
          },
        }
      : null;

  /* Frames carry a mono plate number always, plus the frame's own caption
     when the owner wrote one. Before the caption column existed this fell
     back to `alt`, which is a different job — alt describes the picture for
     someone who cannot see it, a caption tells everyone something the picture
     does not — so the fallback is kept for the frames captioned that way
     rather than blanking them. Either way a line that merely repeats the
     heading above it is noise, not craft credibility, and is dropped.

     Duplicate URLs are dropped HERE rather than only inside LightboxGallery
     (audit CS-02: five seeded cases repeat their first image), because the
     plate numbers have to count the frames a reader can actually see — a wall
     that runs 01 · 03 · 04 looks like a defect of its own. */
  const seenFrames = new Set<string>();
  const galleryImages = portfolio.images
    .filter((image) => {
      if (!isRenderableSrc(image.url) || seenFrames.has(image.url))
        return false;
      seenFrames.add(image.url);
      return true;
    })
    .map((image, index) => {
      const alt = image.alt?.trim() || "";
      const plate = t("frameCaption", {
        index: String(index + 1).padStart(2, "0"),
      });
      const written = localize(image, locale, ["caption"]).caption?.trim() || "";
      const line = written || alt;
      const adds =
        line && line.toLowerCase() !== lp.title.trim().toLowerCase()
          ? line
          : null;
      return {
        url: image.url,
        alt: alt || lp.title,
        caption: adds ? `${plate} · ${adds}` : plate,
      };
    });

  const videoPoster = isRenderableSrc(portfolio.afterImageUrl)
    ? portfolio.afterImageUrl
    : galleryImages[0]?.url;

  const relatedItems: RelatedItem[] = related.map((row) => {
    const lrp = localize(row, locale, TRANSLATABLE_FIELDS.portfolio);
    const lrc = row.category
      ? localize(row.category, locale, TRANSLATABLE_FIELDS.category)
      : null;
    const cover = row.images[0];
    return {
      id: row.id,
      slug: row.slug,
      title: lrp.title,
      categoryName: lrc?.name ?? null,
      image:
        cover && isRenderableSrc(cover.url)
          ? { url: cover.url, alt: cover.alt || lrp.title }
          : null,
    };
  });

  const { whatsappNumber } = await getSiteSettings();
  // Localized prefill (S-01) — same precedent as WhatsApp.greeting.
  const waMessage = t("commissionWhatsappMessage", {
    title: lp.title,
    site: SITE.url.replace(/^https?:\/\//, ""),
  });

  /* ——— schema.org: VisualArtwork case study + breadcrumbs ——— */

  // Commission case studies are the site's richest answer-engine material —
  // give them a machine-readable entity to attribute/surface (SEO-509).
  const artworkSource = portfolio.afterImageUrl || portfolio.images[0]?.url;
  const artworkImage =
    artworkSource && isRenderableSrc(artworkSource)
      ? artworkSource.startsWith("/")
        ? `${SITE.url}${artworkSource}`
        : artworkSource
      : undefined;
  const storyExcerpt =
    lp.story.trim().replace(/\s+/g, " ").slice(0, 300) || undefined;
  const caseType = metaString(portfolio.resultsMeta, "type");
  const portfolioJsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: lp.title,
    ...(storyExcerpt ? { description: storyExcerpt } : {}),
    creator: { "@type": "Organization", "@id": `${SITE.url}/#organization` },
    ...(category?.name ? { genre: category.name } : {}),
    ...(caseType ? { about: caseType } : {}),
    ...(material ? { artMedium: material } : {}),
    ...(tags.length > 0 ? { keywords: tags.join(", ") } : {}),
    ...(artworkImage ? { image: artworkImage } : {}),
    url: `${SITE.url}/portfolio/${portfolio.slug}`,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      // Mirrors the visible breadcrumb — see the blog PDP for why.
      {
        "@type": "ListItem",
        position: 1,
        name: tCommon("home"),
        item: SITE.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: tNav("portfolio"),
        item: `${SITE.url}/portfolio`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: lp.title,
        item: `${SITE.url}/portfolio/${portfolio.slug}`,
      },
    ],
  };

  return (
    <>
      {/* A case study runs story → brief → process → gallery at the same
          length as a journal article, so it gets the same affordance
          (§11.9). Pure scroll mapping — nothing to collapse under reduced
          motion, and `aria-hidden`, so it adds no announcement. */}
      <ReadingProgress />
      {/* A Content Lab fixture never presents itself as a real work in
          structured data — the product and journal detail routes already
          withhold theirs. The BreadcrumbList stays: it mirrors navigation the
          visitor can see, and says nothing about the piece. */}
      {!portfolio.isDemo ? <JsonLd data={portfolioJsonLd} /> : null}
      <JsonLd data={breadcrumbJsonLd} />

      {/* ════════ 01 · The finished piece — dark hero ════════
          `/portfolio/[slug]` is not a transparent-navbar route, so the band
          starts under a solid header. The cover is the LCP: `priority`,
          never revealed, never animated (Part 14). */}
      <section
        data-theme="navy"
        aria-labelledby="case-heading"
        className="relative flex min-h-[74svh] flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        {coverUrl ? (
          <div aria-hidden className="absolute inset-0">
            <Image
              src={coverUrl}
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              unoptimized={!isOptimizableImageSrc(coverUrl)}
              className="object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-obsidian/92 via-obsidian/55 to-obsidian/35" />
          </div>
        ) : null}

        <div className="u-shell relative flex flex-col gap-6 pt-16 pb-20">
          {preview && portfolio.status === "DRAFT" ? (
            <p className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-full border border-hairline-dk bg-deep-ocean/80 px-5 font-body text-14 text-mineral">
              <Eye aria-hidden strokeWidth={1.5} className="size-4" />
              {t("draftPreview")}
            </p>
          ) : null}

          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("portfolio"), href: "/portfolio" },
              { label: lp.title },
            ]}
          />

          <h1
            id="case-heading"
            className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display text-mineral"
          >
            {lp.title}
          </h1>

          <p className="u-micro text-champagne">
            {category?.name ?? t("fallbackCategory")}
          </p>
        </div>
      </section>

      {/* ════════ 02 · The story, and the vitals beside it ════════
          §11.2's editorial split: story in columns 1–7, the sticky mono spec
          rail in 9–12. */}
      <section
        aria-labelledby="story-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Eyebrow>{t("eyebrowStory")}</Eyebrow>
            <h2
              id="story-heading"
              className="font-display text-h2 leading-h2 tracking-display text-balance"
            >
              {t("storyHeading")}
            </h2>
            {paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="u-prose font-body text-body leading-relaxed whitespace-pre-line text-graphite"
              >
                {paragraph}
              </p>
            ))}

            {stats.length > 0 ? (
              <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-5 border-t border-hairline pt-6">
                {stats.map((stat) => (
                  <div key={stat.key} className="flex items-baseline gap-2">
                    <dt className="u-micro">{stat.label}</dt>
                    <dd className="u-num text-14 text-ink">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {specs.length > 0 ? (
            <aside className="lg:col-span-4 lg:col-start-9">
              <dl
                aria-label={t("specAria")}
                className="flex flex-col gap-5 border-t border-hairline pt-6 lg:sticky lg:top-28"
              >
                {specs.map((spec) => (
                  <div key={spec.key} className="flex flex-col gap-1">
                    <dt className="u-micro">{spec.label}</dt>
                    <dd className="font-body text-14 leading-relaxed text-ink">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : null}
        </div>
      </section>

      {/* ════════ 03 · The brief — only where the owner wrote one ════════ */}
      {briefParagraphs.length > 0 ? (
        <section
          aria-labelledby="brief-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-8">
            <SectionHeading
              id="brief-heading"
              eyebrow={t("eyebrowBrief")}
              title={t("caseStudy.briefHeading")}
            />
            {briefParagraphs.map((paragraph, i) => (
              <p
                key={i}
                className="u-prose font-display text-h3 leading-statement whitespace-pre-line text-ink"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* ════════ 04 · The material — dark band ════════
          The one place the piece's substance is named rather than listed.
          Renders only when the commission records a material. */}
      {material ? (
        <section
          data-theme="navy"
          aria-labelledby="material-heading"
          className="section-standard bg-obsidian text-mineral"
        >
          <div className="u-shell flex flex-col gap-8">
            {/* Rule off: the champagne text is the accent here, and §3.1 caps a
                viewport at two champagne elements — a rule AND a champagne
                label in one eyebrow spends both on a single line. */}
            <Eyebrow rule={false} className="text-champagne">
              {t("eyebrowMaterial")}
            </Eyebrow>
            <h2
              id="material-heading"
              className="max-w-[18ch] font-display text-h2 leading-h2 tracking-display text-mineral"
            >
              {material}
            </h2>
            {technique ? (
              <p className="u-lede font-body text-body leading-relaxed text-mist">
                {technique}
              </p>
            ) : null}
            {tags.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline-dk pt-6">
                {tags.map((tag) => (
                  <li key={tag} className="u-micro text-mist">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ════════ 05 · The process — the owner's account, then the film and
          the transformation, whichever of the three exist ════════ */}
      {processParagraphs.length > 0 ||
      clientNote ||
      beforeAfter ||
      portfolio.videoUrl ? (
        <section
          aria-labelledby="process-heading"
          className="section-standard bg-mineral"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="process-heading"
              eyebrow={t("eyebrowProcess")}
              title={t("caseStudy.processHeading")}
            />

            {processParagraphs.length > 0 ? (
              <div className="flex flex-col gap-5">
                {processParagraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="u-prose font-body text-body leading-relaxed whitespace-pre-line text-graphite"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}

            {beforeAfter ? (
              <figure className="flex flex-col gap-4">
                <BeforeAfter
                  before={beforeAfter.before}
                  after={beforeAfter.after}
                />
                <figcaption className="u-micro">
                  {t("beforeAfterHint")}
                </figcaption>
              </figure>
            ) : null}

            {portfolio.videoUrl ? (
              <figure className="flex flex-col gap-4">
                <video
                  src={portfolio.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  poster={videoPoster}
                  className="aspect-video w-full rounded-image bg-sand object-cover"
                />
                <figcaption className="u-micro">{t("videoHeading")}</figcaption>
              </figure>
            ) : null}

            {clientNote ? (
              <figure className="flex flex-col gap-4 border-t border-hairline pt-8">
                <figcaption className="u-micro">
                  {t("caseStudy.clientHeading")}
                </figcaption>
                <blockquote className="u-prose font-display text-h3 leading-statement whitespace-pre-line text-ink">
                  {clientNote}
                </blockquote>
              </figure>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ════════ 06 · The final piece — the captioned wall ════════ */}
      {galleryImages.length > 0 ? (
        <section
          aria-labelledby="final-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="final-heading"
              eyebrow={t("eyebrowFinal")}
              title={t("galleryHeading")}
            />
            <LightboxGallery images={galleryImages} />
          </div>
        </section>
      ) : null}

      {/* ════════ 07 · Other commissions ════════ */}
      {relatedItems.length > 0 ? (
        <section
          aria-labelledby="related-heading"
          className="section-standard bg-mineral"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="related-heading"
              eyebrow={t("eyebrowRelated")}
              title={t("relatedHeading")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/portfolio">{t("viewArchive")}</Link>
                </Button>
              }
            />
            <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {relatedItems.map((item) => (
                <li key={item.id} className="min-w-0">
                  <RelatedTile item={item} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ════════ 08 · Commission similar ════════
          The page's one WhatsApp action. The prefill is unchanged (Part 0:
          every order finalizes through WhatsApp, with the message the studio
          already expects).

          Sand, not obsidian: the footer is dark on every page, so a dark
          closing band would put two dark bands and two competing calls to
          action back to back — the one §3.1 boundary a scan inside `main`
          cannot see. The hero and the material band are this page's dark
          bands; the footer is its dark close. */}
      <section
        aria-labelledby="commission-heading"
        className="section-major bg-sand"
      >
        <div className="u-shell flex flex-col gap-8">
          <SectionHeading
            id="commission-heading"
            eyebrow={t("eyebrowCommission")}
            title={t("ctaHeading")}
            intro={t("ctaBody")}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" asChild>
              <a
                href={buildWaLink(waMessage, whatsappNumber)}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="portfolio_commission"
              >
                {t("ctaWhatsApp")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/custom-order">
                {t("ctaCustomOrder")}
                <ArrowRight
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4 rtl:-scale-x-100"
                />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
