import type { ReactNode } from "react";
import Image from "next/image";
import { getLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Button } from "@/components/storefront/button";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { CollectionCard } from "@/components/storefront/collection-card";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import type {
  CollectionGridData,
  FaqPickerData,
  FinalCtaData,
  HeroData,
  ImageCtaData,
  ProductGridData,
  RichTextData,
} from "@/lib/custom-blocks";
import type { BlockGround } from "@/lib/custom-blocks";
import type { ResolvedBlock } from "@/lib/custom-pages-server";
import { db } from "@/lib/db";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import type { ShopProductItem } from "@/lib/shop";
import { cn } from "@/lib/utils";

/**
 * Rendering a custom landing page's blocks.
 *
 * These are the only components on the site that take their words from a
 * database row rather than a message key, and that licence is repaid by giving
 * them **no layout freedom at all**. The ground comes from
 * `resolveBlockGrounds`, the heading level from `resolveHeadingLevels`, the
 * spacing from the same `section-*` utilities every other page uses. An owner
 * assembling a lander picks what goes on it and in what order; they do not
 * pick how it looks, because that is how a page stops matching the site.
 *
 * Server components: the six original blocks take their extra data
 * (products, FAQs, rendered rich text) pre-resolved through
 * `resolveBlockExtras` — `custom-page-data.ts` batches every block's query
 * into one `Promise.all` per page so a six-block lander costs one round trip,
 * not six in series.
 *
 * The catalogue-growth blocks below (`collectionGrid` on) do NOT go through
 * that path — `custom-page-data.ts` and the route that calls it belong to no
 * batch in this wave's file-ownership table, so this batch cannot add a case
 * there without editing a file it does not own. Each of those blocks queries
 * the database directly inside its own render function instead: correct, and
 * every block still costs at most one query, but a page carrying several of
 * them runs those queries in series rather than in one batched round trip.
 * Folding them into `resolveBlockExtras` is a follow-up once that file's
 * ownership is open again.
 */

/** Everything a block might need beyond its own `data`. */
export type BlockExtras = {
  products?: ShopProductItem[];
  faqs?: { id: string; question: string; answer: string }[];
  /** Pre-rendered, href-sanitised HTML for a `richText` body. */
  html?: string;
};

/**
 * Prose styling for a `richText` body.
 *
 * The fourth copy of this list — `/terms`, `/privacy` and `/blog/[slug]` each
 * carry their own. They are not identical (the legal pages rule their h2s off,
 * an article does not), so consolidating them is its own change; this one is
 * the article shape without the article's drop cap.
 */
const PROSE_BLOCK = [
  "u-prose font-body text-body leading-[1.8] text-graphite",
  "[&_h2]:font-display [&_h2]:tracking-display [&_h2]:mt-10 [&_h2]:text-h3 [&_h2]:leading-snug [&_h2]:text-ink",
  "[&_h3]:font-display [&_h3]:tracking-display [&_h3]:mt-8 [&_h3]:text-25 [&_h3]:leading-snug [&_h3]:text-ink",
  "[&_p]:mt-4",
  "[&_li]:mt-2 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-6",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:ps-6",
  "[&_a]:rounded-input [&_a]:text-sapphire [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-sapphire-hi",
  "[&_blockquote]:mt-6 [&_blockquote]:border-t [&_blockquote]:border-champagne [&_blockquote]:pt-4 [&_blockquote]:font-display [&_blockquote]:text-h3 [&_blockquote]:leading-snug [&_blockquote]:text-ink",
  "[&_hr]:my-10 [&_hr]:border-hairline",
  "[&_img]:mt-6 [&_img]:max-w-full [&_img]:rounded-image",
  "[&_strong]:text-ink",
].join(" ");

const GROUND_CLASS: Record<BlockGround, string> = {
  obsidian: "bg-obsidian text-mineral",
  mineral: "bg-mineral",
  sand: "bg-sand",
};

/**
 * An owner's spacing choice, mapped to the site's two smaller section tiers.
 * `section-major` is never reachable from a block — it is reserved for the
 * two big moments a person actually designed into a page, not a menu pick.
 */
const SPACING_CLASS: Record<"compact" | "standard", string> = {
  compact: "section-compact",
  standard: "section-standard",
};

/** The shared shell: one ground, one rhythm, one rail. */
function Band({
  ground,
  major = false,
  spacing = "standard",
  labelledBy,
  className,
  children,
}: {
  ground: BlockGround;
  major?: boolean;
  /** Ignored when `major` is set — a major band keeps its own rhythm. */
  spacing?: "compact" | "standard";
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      data-theme={ground === "obsidian" ? "navy" : undefined}
      className={cn(
        major ? "section-major" : SPACING_CLASS[spacing],
        GROUND_CLASS[ground],
        className,
      )}
    >
      <div className="u-shell">{children}</div>
    </section>
  );
}

/** A button an owner configured, or nothing when they left it blank. */
function BlockCta({
  label,
  href,
  variant = "primary",
}: {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "premium" | "whatsapp";
}) {
  if (!label.trim() || !href.trim()) return null;
  const external = /^https?:\/\/|^mailto:|^tel:/i.test(href);
  return (
    <Button asChild variant={variant} size="lg">
      {external ? (
        <a href={href} rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        <Link href={href}>{label}</Link>
      )}
    </Button>
  );
}

/* ═══════════════════════ the six ═══════════════════════ */

function HeroBlock({
  id,
  data,
  heading,
  first,
}: {
  id: string;
  data: HeroData;
  heading: "h1" | "h2";
  /**
   * Only a hero at the top of the page pulls up under the sticky header. Moved
   * down the page it must not, or it eats 80px of the block above it — which
   * is exactly what an owner reordering blocks in the studio can do.
   */
  first: boolean;
}) {
  const Tag = heading;
  const image = isRenderableSrc(data.image) ? data.image : null;
  const headingId = `${id}-heading`;

  return (
    <section
      data-theme="navy"
      aria-labelledby={data.headline ? headingId : undefined}
      className={cn(
        "relative flex min-h-[70svh] flex-col justify-end overflow-hidden bg-obsidian text-mineral",
        first && "-mt-20",
      )}
    >
      {image ? (
        <div className="absolute inset-0">
          <Image
            src={sizedExternalSrc(image, 2400)}
            alt={data.imageAlt}
            fill
            priority
            sizes="100vw"
            unoptimized={!isOptimizableImageSrc(image)}
            className="object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-obsidian/92 via-obsidian/65 to-obsidian/20"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "u-shell relative flex flex-col gap-8 pb-20",
          first ? "pt-32" : "pt-20",
        )}
      >
        {data.eyebrow ? (
          <Eyebrow rule={false} className="text-champagne">
            {data.eyebrow}
          </Eyebrow>
        ) : null}
        {data.headline ? (
          <Tag
            id={headingId}
            className="max-w-[16ch] font-display text-hero leading-[0.95] tracking-display text-mineral"
          >
            {data.headline}
          </Tag>
        ) : null}
        {data.body ? (
          <p className="u-prose font-body text-body leading-relaxed text-mist">
            {data.body}
          </p>
        ) : null}
        {data.ctaLabel && data.ctaHref ? (
          <div className="flex flex-wrap items-center gap-4">
            <BlockCta label={data.ctaLabel} href={data.ctaHref} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RichTextBlock({
  id,
  data,
  ground,
  heading,
  html,
}: {
  id: string;
  data: RichTextData;
  ground: BlockGround;
  heading: "h1" | "h2";
  html?: string;
}) {
  const headingId = `${id}-heading`;
  return (
    <Band ground={ground} labelledBy={data.heading ? headingId : undefined}>
      <div className="flex flex-col gap-8">
        {data.heading ? (
          <SectionHeading
            id={headingId}
            as={heading}
            title={data.heading}
            size={heading === "h1" ? "h1" : "h2"}
          />
        ) : null}
        {html ? (
          <div
            className={PROSE_BLOCK}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    </Band>
  );
}

function ProductGridBlock({
  id,
  data,
  ground,
  heading,
  products,
}: {
  id: string;
  data: ProductGridData;
  ground: BlockGround;
  heading: "h1" | "h2";
  products: ShopProductItem[];
}) {
  // A grid with nothing in it renders nothing, rather than an empty shelf with
  // a heading over it. The owner sees the block in the studio either way.
  if (products.length === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <Band ground={ground} labelledBy={data.heading ? headingId : undefined}>
      <div className="flex flex-col gap-10">
        {data.heading ? (
          <SectionHeading
            id={headingId}
            as={heading}
            title={data.heading}
            intro={data.intro || undefined}
            size={heading === "h1" ? "h1" : "h2"}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {products.map((item) => (
            <CatalogProductCard key={item.id} item={item} variant="full" />
          ))}
        </div>
      </div>
    </Band>
  );
}

/**
 * The collections a `collectionGrid` block shows.
 *
 * Only visible categories, only the ones the owner picked, in the owner's
 * order — the same "no mode invents a product" discipline `fetchProductsForGrid`
 * follows for `productGrid`, applied to shelves instead of pieces.
 */
async function fetchCollectionsForGrid(
  slugs: readonly string[],
  locale: string,
) {
  if (slugs.length === 0) return [];
  const rows = await db.category.findMany({
    where: { visible: true, slug: { in: [...slugs] } },
    select: {
      slug: true,
      name: true,
      description: true,
      image: true,
      translations: true,
    },
  });
  const bySlug = new Map(
    rows.map((row) => [
      row.slug,
      localize(row, locale, TRANSLATABLE_FIELDS.category),
    ]),
  );
  // The owner's order, not the query's — `where … in` does not preserve it.
  return slugs.flatMap((slug) => {
    const category = bySlug.get(slug);
    return category ? [category] : [];
  });
}

async function CollectionGridBlock({
  id,
  data,
  ground,
  spacing,
  heading,
}: {
  id: string;
  data: CollectionGridData;
  ground: BlockGround;
  spacing: "compact" | "standard";
  heading: "h1" | "h2";
}) {
  const locale = await getLocale();
  const collections = await fetchCollectionsForGrid(data.slugs, locale);
  // Nothing picked, or every pick since hidden or deleted: no band at all,
  // same contract as the product grid.
  if (collections.length === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <Band
      ground={ground}
      spacing={spacing}
      labelledBy={data.heading ? headingId : undefined}
    >
      <div className="flex flex-col gap-10">
        {data.heading ? (
          <SectionHeading
            id={headingId}
            as={heading}
            title={data.heading}
            intro={data.intro || undefined}
            size={heading === "h1" ? "h1" : "h2"}
          />
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((category) => (
            <CollectionCard
              key={category.slug}
              href={`/shop/${category.slug}`}
              name={category.name}
              promise={category.description || category.name}
              image={category.image}
              imageAlt=""
              ratio="3/4"
            />
          ))}
        </div>
      </div>
    </Band>
  );
}

function ImageCtaBlock({
  id,
  data,
  ground,
  heading,
}: {
  id: string;
  data: ImageCtaData;
  ground: BlockGround;
  heading: "h1" | "h2";
}) {
  const Tag = heading;
  const image = isRenderableSrc(data.image) ? data.image : null;
  const headingId = `${id}-heading`;
  // Logical order, so Arabic mirrors the layout rather than fighting it.
  const imageFirst = data.imageSide === "start";

  return (
    <Band ground={ground} labelledBy={data.heading ? headingId : undefined}>
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        {image ? (
          <div
            className={cn(
              "lg:col-span-6",
              imageFirst ? "lg:order-1" : "lg:order-2",
            )}
          >
            <MeniscusImage
              src={sizedExternalSrc(image, 1400)}
              alt={data.imageAlt}
              width={1400}
              height={1050}
              sizes="(min-width:1024px) 45vw, 100vw"
              unoptimized={!isOptimizableImageSrc(image)}
              className="aspect-[4/3]"
              imageClassName="object-cover"
            />
          </div>
        ) : null}
        <div
          className={cn(
            "flex flex-col gap-6",
            image ? "lg:col-span-6" : "lg:col-span-8",
            imageFirst ? "lg:order-2" : "lg:order-1",
          )}
        >
          {data.heading ? (
            <Tag
              id={headingId}
              className="font-display text-h2 leading-tight tracking-display"
            >
              {data.heading}
            </Tag>
          ) : null}
          {data.body ? (
            <p className="u-prose font-body text-body leading-relaxed">
              {data.body}
            </p>
          ) : null}
          {data.ctaLabel && data.ctaHref ? (
            <div className="flex flex-wrap items-center gap-4">
              <BlockCta
                label={data.ctaLabel}
                href={data.ctaHref}
                variant="secondary"
              />
            </div>
          ) : null}
        </div>
      </div>
    </Band>
  );
}

function FaqPickerBlock({
  id,
  data,
  ground,
  heading,
  faqs,
}: {
  id: string;
  data: FaqPickerData;
  ground: BlockGround;
  heading: "h1" | "h2";
  faqs: { id: string; question: string; answer: string }[];
}) {
  if (faqs.length === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <Band ground={ground} labelledBy={data.heading ? headingId : undefined}>
      <div className="flex flex-col gap-8">
        {data.heading ? (
          <SectionHeading
            id={headingId}
            as={heading}
            title={data.heading}
            size={heading === "h1" ? "h1" : "h2"}
          />
        ) : null}
        <Accordion type="single" collapsible className="u-prose w-full">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Band>
  );
}

function FinalCtaBlock({
  id,
  data,
  ground,
  heading,
  waHref,
}: {
  id: string;
  data: FinalCtaData;
  ground: BlockGround;
  heading: "h1" | "h2";
  waHref: string;
}) {
  const Tag = heading;
  const headingId = `${id}-heading`;
  const dark = ground === "obsidian";

  return (
    <Band ground={ground} labelledBy={data.heading ? headingId : undefined}>
      <div className="flex flex-col gap-6">
        {data.heading ? (
          <Tag
            id={headingId}
            className={cn(
              "max-w-[18ch] font-display text-h1 leading-tight tracking-display",
              dark && "text-mineral",
            )}
          >
            {data.heading}
          </Tag>
        ) : null}
        {data.body ? (
          <p
            className={cn(
              "u-lede font-body text-body leading-relaxed",
              dark && "text-mist",
            )}
          >
            {data.body}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          {data.whatsapp ? (
            data.ctaLabel.trim() ? (
              <Button asChild variant="whatsapp" size="lg">
                <a href={waHref} target="_blank" rel="noopener noreferrer">
                  {data.ctaLabel}
                </a>
              </Button>
            ) : null
          ) : (
            <BlockCta
              label={data.ctaLabel}
              href={data.ctaHref}
              variant={dark ? "premium" : "primary"}
            />
          )}
        </div>
      </div>
    </Band>
  );
}

/* ═══════════════════════ the switch ═══════════════════════ */

export function CustomPageBlock({
  block,
  ground,
  heading,
  first,
  extras,
  waHref,
}: {
  block: ResolvedBlock;
  ground: BlockGround;
  heading: "h1" | "h2";
  /** True for the page's first block — only it may pull under the header. */
  first: boolean;
  extras: BlockExtras;
  waHref: string;
}) {
  switch (block.type) {
    case "hero":
      return (
        <HeroBlock
          id={block.id}
          data={block.data as HeroData}
          heading={heading}
          first={first}
        />
      );
    case "richText":
      return (
        <RichTextBlock
          id={block.id}
          data={block.data as RichTextData}
          ground={ground}
          heading={heading}
          html={extras.html}
        />
      );
    case "productGrid":
      return (
        <ProductGridBlock
          id={block.id}
          data={block.data as ProductGridData}
          ground={ground}
          heading={heading}
          products={extras.products ?? []}
        />
      );
    case "imageCta":
      return (
        <ImageCtaBlock
          id={block.id}
          data={block.data as ImageCtaData}
          ground={ground}
          heading={heading}
        />
      );
    case "faqPicker":
      return (
        <FaqPickerBlock
          id={block.id}
          data={block.data as FaqPickerData}
          ground={ground}
          heading={heading}
          faqs={extras.faqs ?? []}
        />
      );
    case "finalCta":
      return (
        <FinalCtaBlock
          id={block.id}
          data={block.data as FinalCtaData}
          ground={ground}
          heading={heading}
          waHref={waHref}
        />
      );
    case "collectionGrid": {
      const data = block.data as CollectionGridData;
      return (
        <CollectionGridBlock
          id={block.id}
          data={data}
          ground={ground}
          spacing={data.spacing}
          heading={heading}
        />
      );
    }
  }
}
