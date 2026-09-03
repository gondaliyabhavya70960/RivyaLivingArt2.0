import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Content gaps" };
export const dynamic = "force-dynamic";

type Gap = {
  key: string;
  title: string;
  why: string;
  count: number;
  href: string;
  hrefLabel: string;
  samples: { label: string; href: string }[];
  /**
   * Which way is good. Nearly every card counts something MISSING, so zero is
   * the healthy end — but testimonials count what EXISTS, and the storefront
   * band stays hidden until some do. That inversion used to be a per-key
   * ternary at the render site, which is the wrong place for it: the card
   * knows what it counts, the renderer does not.
   */
  healthyWhen?: "zero" | "some";
};

const SAMPLE_TAKE = 6;

/**
 * Content-gaps worklist: the owner-content queue (photography aside) turned
 * into one actionable surface. Every card is a live count with sample deep
 * links straight into the editor that fixes it — the studio equivalent of
 * the audit's "the containers are built; only you can fill them".
 */
export default async function ContentGapsPage() {
  const published = { status: "PUBLISHED" as const };

  /**
   * Named rather than a positional `Promise.all` destructure. The list was
   * already twelve entries long and this pass adds more: one transposed pair
   * in a positional read is a card quietly counting the wrong thing, and
   * nothing type-checks it because every count is a number.
   */
  const q = {
    noDescription: db.product.count({
      where: { ...published, description: "" },
    }),
    noDescriptionSamples: db.product.findMany({
      where: { ...published, description: "" },
      take: SAMPLE_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    noImages: db.product.count({
      where: { ...published, images: { none: {} } },
    }),
    noImagesSamples: db.product.findMany({
      where: { ...published, images: { none: {} } },
      take: SAMPLE_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    needsRewrite: db.product.count({
      where: { ...published, needsRewrite: true },
    }),
    needsRewriteSamples: db.product.findMany({
      where: { ...published, needsRewrite: true },
      take: SAMPLE_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    longTitleNoDisplay: db.$queryRaw<[{ n: bigint }]>`
      SELECT count(*)::bigint n FROM "Product"
      WHERE status = 'PUBLISHED' AND length(title) > 60 AND "displayName" IS NULL
    `.then((r) => Number(r[0].n)),
    longTitleSamples: db.$queryRaw<{ id: string; title: string }[]>`
      SELECT id, title FROM "Product"
      WHERE status = 'PUBLISHED' AND length(title) > 60 AND "displayName" IS NULL
      ORDER BY length(title) DESC LIMIT ${SAMPLE_TAKE}
    `,
    untaggedOccasions: db.$queryRaw<[{ n: bigint }]>`
      SELECT count(*)::bigint n FROM "Product"
      WHERE status = 'PUBLISHED' AND jsonb_array_length(occasions) = 0
    `.then((r) => Number(r[0].n)),
    portfolioBare: db.portfolio.count({
      where: { ...published, brief: null, clientNote: null },
    }),
    portfolioBareSamples: db.portfolio.findMany({
      where: { ...published, brief: null, clientNote: null },
      take: SAMPLE_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    testimonialCount: db.testimonial.count(),

    /* ——— the fields the last two phases added, which nobody can be
       expected to fill without being told they are empty ——— */

    // The before/after slider (§4.6, §20.5) is built and wired, and renders
    // only when BOTH sides exist. A piece with an after shot and no before is
    // one upload away from turning it on.
    halfTransformations: db.portfolio.count({
      where: { ...published, afterImageUrl: { not: null }, beforeImageUrl: null },
    }),
    halfTransformationSamples: db.portfolio.findMany({
      where: { ...published, afterImageUrl: { not: null }, beforeImageUrl: null },
      take: SAMPLE_TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),

    // Gallery frames carry a plate number alone until the owner writes one.
    uncaptionedFrames: db.portfolioImage.count({
      where: { caption: null, portfolio: published },
    }),
    // Ordered by how many frames are uncaptioned, not by date: the three
    // portfolio cards otherwise sample the same six newest pieces and read
    // like a repeated list. Most work first is also the more useful queue.
    uncaptionedFrameSamples: db.$queryRaw<{ id: string; title: string }[]>`
      SELECT p.id, p.title
      FROM "Portfolio" p
      JOIN "PortfolioImage" i ON i."portfolioId" = p.id AND i.caption IS NULL
      WHERE p.status = 'PUBLISHED'
      GROUP BY p.id, p.title
      ORDER BY count(i.id) DESC, p.title ASC
      LIMIT ${SAMPLE_TAKE}
    `,

    // A category or tag with no translations renders its English name in the
    // other eight locales.
    untranslatedCategories: db.blogCategory.count({
      where: { translations: { equals: Prisma.DbNull } },
    }),

    // Alt text is the one content gap that is also an accessibility defect.
    // The media library already filters for it; this is the count nobody sees
    // unless they go looking.
    mediaWithoutAlt: db.media.count({ where: { alt: null, type: "IMAGE" } }),
  };

  const {
    noDescription,
    noDescriptionSamples,
    noImages,
    noImagesSamples,
    needsRewrite,
    needsRewriteSamples,
    longTitleNoDisplay,
    longTitleSamples,
    untaggedOccasions,
    portfolioBare,
    portfolioBareSamples,
    testimonialCount,
    halfTransformations,
    halfTransformationSamples,
    uncaptionedFrames,
    uncaptionedFrameSamples,
    untranslatedCategories,
    mediaWithoutAlt,
  } = Object.fromEntries(
    await Promise.all(
      Object.entries(q).map(async ([key, value]) => [key, await value]),
    ),
  ) as { [K in keyof typeof q]: Awaited<(typeof q)[K]> };

  const productSamples = (rows: { id: string; title: string }[]) =>
    rows.map((row) => ({
      label: row.title,
      href: `/studio/products/${row.id}`,
    }));

  const portfolioSamples = (rows: { id: string; title: string }[]) =>
    rows.map((row) => ({
      label: row.title,
      href: `/studio/portfolio/${row.id}`,
    }));

  const gaps: Gap[] = [
    {
      key: "descriptions",
      title: "Products without a description",
      why: "An empty description ships a thin PDP and a weak meta description.",
      count: noDescription,
      href: "/studio/products",
      hrefLabel: "Products",
      samples: productSamples(noDescriptionSamples),
    },
    {
      key: "images",
      title: "Published products with no images",
      why: "Imageless cards fall back to the monogram tile on every rail.",
      count: noImages,
      href: "/studio/products",
      hrefLabel: "Products",
      samples: productSamples(noImagesSamples),
    },
    {
      key: "rewrite",
      title: "Awaiting editorial rewrite",
      why: "needsRewrite rows hide their scraped copy until rewritten — the PDP shows tagline + specs only.",
      count: needsRewrite,
      href: "/studio/products",
      hrefLabel: "Products",
      samples: productSamples(needsRewriteSamples),
    },
    {
      key: "display-names",
      title: "Marketplace-length titles without a display name",
      why: "Cards derive a short name automatically; an owner-set Display name always reads better.",
      count: longTitleNoDisplay,
      href: "/studio/products",
      hrefLabel: "Products",
      samples: productSamples(longTitleSamples),
    },
    {
      key: "occasions",
      title: "Products with no occasion tags",
      why: "The home shop-by-occasion doorways stay hidden until pieces are tagged.",
      count: untaggedOccasions,
      href: "/studio/products",
      hrefLabel: "Products",
      samples: [],
    },
    {
      key: "case-studies",
      title: "Portfolio pieces without case-study fields",
      why: "The brief / process / client's words sections render only when filled.",
      count: portfolioBare,
      href: "/studio/portfolio",
      hrefLabel: "Portfolio",
      samples: portfolioSamples(portfolioBareSamples),
    },
    {
      key: "testimonials",
      title: "Testimonials",
      why: "The storefront band stays hidden until real curated rows exist (no-invented-content rule).",
      count: testimonialCount,
      href: "/studio/testimonials",
      hrefLabel: "Testimonials",
      samples: [],
      healthyWhen: "some",
    },
    {
      key: "before-after",
      title: "Transformations missing their before shot",
      why: "The before/after slider is built and wired, and renders only when BOTH sides exist. These pieces have the after — one upload each turns the slider on.",
      count: halfTransformations,
      href: "/studio/portfolio",
      hrefLabel: "Portfolio",
      samples: portfolioSamples(halfTransformationSamples),
    },
    {
      key: "frame-captions",
      title: "Gallery frames without a caption",
      why: "A frame shows its plate number alone until you write one. Alt text is a different job — it describes the picture for someone who cannot see it.",
      count: uncaptionedFrames,
      href: "/studio/portfolio",
      hrefLabel: "Portfolio",
      samples: portfolioSamples(uncaptionedFrameSamples),
    },
    {
      key: "taxonomy-translations",
      title: "Journal categories in English only",
      why: "An untranslated name renders its English text in the other eight languages, beside prose that IS translated. Counts the handful of categories in the journal nav, not the long tail of tags — those are translated on the same screen, and folding them in would bury this number under a few hundred.",
      count: untranslatedCategories,
      href: "/studio/blog?tab=categories",
      hrefLabel: "Journal categories",
      samples: [],
    },
    {
      key: "media-alt",
      title: "Images with no description",
      why: "The one content gap that is also an accessibility defect: a screen reader announces nothing for these.",
      count: mediaWithoutAlt,
      href: "/studio/media?filter=missing-alt",
      hrefLabel: "Media library",
      samples: [],
    },
  ];

  return (
    <>
      <PageHeader
        title="Content gaps"
        description="The catalog's plumbing is built — these are the places waiting on owner words, tags and images. Every count is live; sample links open the editor that fixes it."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {gaps.map((gap) => {
          const healthy =
            gap.healthyWhen === "some" ? gap.count > 0 : gap.count === 0;
          return (
            <section
              key={gap.key}
              className="rounded-card border border-border bg-card p-5 shadow-e1"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium text-foreground">{gap.title}</h2>
                <p
                  className={`text-25 font-semibold tabular-nums ${
                    healthy ? "text-success" : "text-foreground"
                  }`}
                >
                  {gap.count.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{gap.why}</p>
              {gap.samples.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {gap.samples.map((sample) => (
                    <li key={sample.href}>
                      <Link
                        href={sample.href}
                        className="block truncate rounded text-sm text-sapphire-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {sample.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={gap.href}
                className="mt-3 inline-flex min-h-9 items-center gap-1 rounded text-sm font-medium text-sapphire-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {gap.hrefLabel} <ArrowRight className="size-3.5" />
              </Link>
            </section>
          );
        })}
      </div>
    </>
  );
}
