import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

import { WishlistButton } from "@/components/shop/wishlist-button";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { MorphLink } from "@/components/storefront/morph-link";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import type { ShopProductItem } from "@/lib/shop";
import { cn, formatPriceBand, monogram } from "@/lib/utils";

const CARD_SIZES = "(min-width:1024px) 30vw, (min-width:640px) 45vw, 50vw";
const COMPACT_SIZES = "(min-width:1024px) 18vw, (min-width:640px) 25vw, 45vw";

/**
 * Below this the piece is a part, not a piece — REDESIGN.md §4.6: "Compact
 * variant for items under ₹1,000 … This is what stops a ₹8 part sharing
 * visual furniture with a ₹16,499 frame."
 */
export const COMPACT_PRICE_CEILING = 1000;

/**
 * The variant for a WHOLE grid, decided by what is in it.
 *
 * §4.6 asks for two things that pull against each other: a compact card for
 * items under ₹1,000, and "never mix random aspect ratios in one grid".
 * Deriving the variant per card satisfies the first and breaks the second —
 * a 1:1 tile beside a 4:5 one makes every row ragged. So the *shelf* picks:
 * when most of what is on it is parts rather than pieces, the whole grid goes
 * compact (and denser, 4–6 up, as the spec's own note says); otherwise every
 * card is full. One ratio per context, which is the rule the image-discipline
 * paragraph actually turns on.
 */
export function shelfVariant(
  items: readonly Pick<ShopProductItem, "showPrice" | "priceMin">[],
): "full" | "compact" {
  const priced = items.filter(
    (item) => item.showPrice && item.priceMin != null,
  );
  if (priced.length < 4) return "full";
  const parts = priced.filter(
    (item) => (item.priceMin as number) < COMPACT_PRICE_CEILING,
  ).length;
  return parts / priced.length >= 0.7 ? "compact" : "full";
}

/**
 * The PLP / rail card — REDESIGN.md §4.6 `ProductCard`.
 *
 *   4:5 image · mono collection · name (Inter 500, two lines) · mono price ·
 *   mono production line · ghost "View piece →"
 *
 * Three rules the old card broke:
 *
 * **No box.** The card has no fill, no shadow and no lift. Separation comes
 * from whitespace and the image edge (§3.5). The old card was a sand tile that
 * rose 6px and dropped a shadow on hover — the SaaS grammar the spec removes.
 *
 * **No button inside the card.** The whole card is the target; the "View
 * piece" line is a ghost affordance whose underline draws on card hover, not a
 * second tap target competing with the first.
 *
 * **One badge, three vocabularies.** `Atelier pick` (a hard cap of twelve
 * across the whole site — a curation badge applied to everything signals
 * nothing), `Made to order`, `Ships in 7–10 days`. Out-of-stock is real
 * information but not curation, so it rides the mono meta line instead of
 * spending the badge slot.
 *
 * Hover swaps to the second image through a meniscus wipe rather than a
 * crossfade, so the card obeys the same reveal language as every other image
 * on the site (§2.7). Hover-capable pointers only.
 *
 * Server component; the wishlist heart is the existing client island and is
 * deliberately quiet — it surfaces on hover and focus, and never competes with
 * the photograph.
 */
export function CatalogProductCard({
  item,
  className,
  morph = false,
  variant,
  priority = false,
}: {
  item: ShopProductItem;
  className?: string;
  /** Pair this card's image stage with the PDP gallery via
   *  view-transition-name. Enable ONLY where a product renders at most once
   *  per page — duplicate names make the browser skip the whole transition. */
  morph?: boolean;
  /** Decided per GRID, not per card — see `shelfVariant`. Defaults to `full`
   *  so a card dropped anywhere without thought is the editorial one. */
  variant?: "full" | "compact";
  /** The first row of the first grid carries the LCP — those images load
   *  eagerly and are never revealed. */
  priority?: boolean;
}) {
  const t = useTranslations("Shop");
  const image = isRenderableSrc(item.image?.url) ? item.image : null;
  const hoverImage = isRenderableSrc(item.hoverImage?.url)
    ? item.hoverImage
    : null;
  const priceLabel =
    item.showPrice && item.priceMin != null
      ? formatPriceBand(item.priceMin, item.priceMax)
      : null;

  const compact = variant === "compact";

  const stage = (
    <div
      style={morph ? { viewTransitionName: `product-${item.slug}` } : undefined}
      className={cn(
        "relative overflow-hidden rounded-image bg-sand",
        compact ? "aspect-square" : "aspect-[4/5]",
      )}
    >
      {image ? (
        <>
          {/* The meniscus reveal, not a plain mount (REDESIGN.md §2.7): no
              image on this site fades in, and this is the card the shop grid,
              the related rail and the homepage's hero piece are all made of.
              `priority` still opts the LCP out inside the component itself,
              so the first row and the PDP mount plain and unanimated. */}
          <MeniscusImage
            src={sizedExternalSrc(image.url, compact ? 600 : 900)}
            alt={image.alt || item.title}
            fill
            sizes={compact ? COMPACT_SIZES : CARD_SIZES}
            priority={priority}
            unoptimized={!isOptimizableImageSrc(image.url)}
            className="absolute inset-0"
            imageClassName="object-cover"
          />
          {hoverImage && !compact ? (
            /* The meniscus wipe: the second image is clipped to nothing and
               rises to full on hover. Pure CSS clip-path — no JS, no observer,
               and the global reduced-motion collapse stills it. */
            <span
              aria-hidden
              className="absolute inset-0 hidden [clip-path:inset(0_0_100%_0)] transition-[clip-path] duration-(--dur-base) ease-(--ease-luxury) group-hover:[clip-path:inset(0_0_0%_0)] group-focus-within:[clip-path:inset(0_0_0%_0)] motion-reduce:transition-none [@media(hover:hover)]:block"
            >
              <Image
                src={sizedExternalSrc(hoverImage.url, 900)}
                alt=""
                fill
                sizes={CARD_SIZES}
                unoptimized={!isOptimizableImageSrc(hoverImage.url)}
                className="object-cover"
              />
              <span className="absolute inset-x-0 top-0 h-px bg-champagne opacity-0 transition-opacity duration-(--dur-base) group-hover:opacity-80" />
            </span>
          ) : null}
        </>
      ) : (
        /* No renderable image — an obsidian monogram tile keeps the shelf
           whole rather than leaving a hole in the grid. */
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center bg-obsidian font-display text-49 text-mineral/70"
        >
          {monogram(item.displayTitle)}
        </span>
      )}

      {!compact && item.featured ? (
        <span className="u-micro absolute start-3 top-3 bg-mineral/92 px-2.5 py-1 text-ink">
          {t("card.badgeAtelierPick")}
        </span>
      ) : null}

      {!compact ? (
        <span className="absolute end-2 top-2 z-10 opacity-0 transition-opacity duration-(--dur-fast) group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <WishlistButton
            slug={item.slug}
            title={item.title}
            className="border-hairline-dk bg-obsidian/60 text-mineral ring-offset-0 focus-visible:ring-focus"
          />
        </span>
      ) : null}
    </div>
  );

  /* ————— Compact: a part, not a piece. 1:1, one line, price, no badge,
     no link line — the whole tile is still the target. ————— */
  if (compact) {
    return (
      <article
        data-slot="sf-catalog-card"
        className={cn("group relative", className)}
      >
        {stage}
        <div className="mt-3">
          <h3 className="font-body text-14 leading-snug font-medium text-ink">
            <MorphLink
              href={`/product/${item.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              <TitleText full={item.title} visible={item.displayTitle} clamp={1} />
            </MorphLink>
          </h3>
          <p className="u-num mt-1 text-14 text-graphite">
            {priceLabel ?? t("card.viewDetails")}
          </p>
        </div>
      </article>
    );
  }

  /* ————— Full: the piece as an object. ————— */
  return (
    <article
      data-slot="sf-catalog-card"
      className={cn("group relative", className)}
    >
      {stage}
      <div className="mt-4 flex flex-col gap-1.5">
        {item.categoryName ? (
          <p className="u-micro">{item.categoryName}</p>
        ) : null}
        <h3 className="font-body text-16 leading-snug font-medium text-ink in-data-[theme=navy]:text-mineral">
          {/* MorphLink drives the card → PDP view-transition morph. */}
          <MorphLink
            href={`/product/${item.slug}`}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
          >
            <TitleText full={item.title} visible={item.displayTitle} clamp={2} />
          </MorphLink>
        </h3>
        <p className="u-num text-16 text-ink in-data-[theme=navy]:text-mineral">
          {priceLabel ?? t("card.viewDetails")}
        </p>
        <p className="u-micro">
          {item.inStock ? t("card.madeToOrder") : t("card.badgeOutOfStock")}
          {item.duplicateCount && item.duplicateCount > 1
            ? ` · ${t("card.optionsCount", { count: item.duplicateCount })}`
            : null}
        </p>
        <p
          aria-hidden
          className="mt-1 inline-flex w-fit items-center gap-1.5 font-body text-14 text-sapphire in-data-[theme=navy]:text-champagne"
        >
          <span className="relative after:absolute after:-bottom-0.5 after:start-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-(--dur-fast) after:ease-(--ease-luxury) group-hover:after:w-full group-focus-within:after:w-full motion-reduce:after:transition-none">
            {t("card.viewPiece")}
          </span>
          <ArrowRight
            aria-hidden
            strokeWidth={1.5}
            className="size-4 rtl:-scale-x-100"
          />
        </p>
      </div>
    </article>
  );
}

/**
 * The card's title, split in two — Part 17: "Card links carry the full title
 * even when the visible text clamps. No `…` in the accessible name."
 *
 * `displayTitle` is the editorial short name, and `editorialName()` truncates
 * it with an ellipsis when the catalogue title runs long. That string is fine
 * to *look* at and wrong to *hear*: it is the link's accessible name, and a
 * name that ends mid-word tells a screen-reader user nothing about where the
 * link goes. The full catalogue title is announced; the short one is painted.
 */
function TitleText({
  full,
  visible,
  clamp,
}: {
  full: string;
  visible: string;
  clamp: 1 | 2;
}) {
  return (
    <>
      <span className="sr-only">{full}</span>
      <span aria-hidden className={clamp === 1 ? "line-clamp-1" : "line-clamp-2"}>
        {visible}
      </span>
    </>
  );
}
