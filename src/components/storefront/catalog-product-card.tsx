import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

import { CardAskWhatsApp } from "@/components/shop/card-ask-whatsapp";
import { CardHoverVideo } from "@/components/shop/card-hover-video";
import { QuickViewTrigger } from "@/components/shop/quick-view-trigger";
import { WishlistButton } from "@/components/shop/wishlist-button";
import { DemoMark } from "@/components/storefront/demo-mark";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { MorphLink } from "@/components/storefront/morph-link";
import {
  accessibleCardName,
  cardMetaLine,
  collectibleCardMeta,
  giftCardMeta,
  memoryCardMeta,
  type CardVariant,
} from "@/lib/card-meta";
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
  /** `full` and `compact` are decided per GRID, not per card — see
   *  `shelfVariant`. `collectible`, `memory` and `gift` are the three tier
   *  variants (docs/plan/07 steps 7–8): a tier-homogeneous grid passes one by
   *  context, a mixed grid asks `cardVariantFor`. Defaults to `full` so a card
   *  dropped anywhere without thought is the editorial one — which is also
   *  what the untiered backlog gets. */
  variant?: CardVariant;
  /** The first row of the first grid carries the LCP — those images load
   *  eagerly and are never revealed. */
  priority?: boolean;
}) {
  const t = useTranslations("Shop");
  const tCommon = useTranslations("Common");
  const image = isRenderableSrc(item.image?.url) ? item.image : null;
  const hoverImage = isRenderableSrc(item.hoverImage?.url)
    ? item.hoverImage
    : null;
  const priceLabel =
    item.showPrice && item.priceMin != null
      ? formatPriceBand(item.priceMin, item.priceMax)
      : null;
  const metaLine = cardMetaLine(item);

  const compact = variant === "compact";
  const collectible = variant === "collectible";
  const memory = variant === "memory";
  const gift = variant === "gift";

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
            imageClassName={cn(
              "object-cover",
              // A second gallery image already wipes in on hover — a scale
              // on TOP of that wipe would be two competing reveals. Only the
              // single-image card gets the zoom.
              !hoverImage &&
                "transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            )}
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

      {/* The card-hover clip (D21) — an ambient loop over the stage, never
          on the LCP row. Mounts nothing at all for a touch visitor or under
          reduced motion (see `card-hover-video.tsx`). */}
      {item.videoUrl && !priority ? (
        <CardHoverVideo src={item.videoUrl} />
      ) : null}

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
              <TitleText
                full={accessibleCardName(item)}
                visible={item.displayTitle}
                clamp={1}
              />
            </MorphLink>
          </h3>
          <p className="u-num mt-1 text-14 text-graphite">
            {priceLabel ?? t("card.viewDetails")}
          </p>
        </div>
      </article>
    );
  }

  /* ————— Collectible: the LARGE_FORMAT tier (docs/plan/07). The brief's
     card — hero image, name, object type, material, the bespoke indicator,
     a figure / a band / price on request, "View piece" — and nothing more:
     "do not overload the card". The name takes the display face, the
     dimensions and materials sit labelled on a hairline (furniture is read
     at room scale, so the size is not a footnote here), and there is no
     quick view: Tier 01's journey is Explore → View → Consultation, and the
     consultation is the WhatsApp thread (T9 — nothing else can be
     recorded). The branch itself lives in card-meta.ts, where it is
     tested. ————— */
  if (collectible) {
    const meta = collectibleCardMeta(item);
    return (
      <article
        data-slot="sf-catalog-card"
        data-variant="collectible"
        className={cn("group relative", className)}
      >
        {stage}
        <div className="mt-4 flex flex-col gap-2">
          {meta.objectType || item.isDemo ? (
            <div className="flex items-center gap-2">
              {meta.objectType ? (
                <p className="u-micro">{meta.objectType}</p>
              ) : null}
              {item.isDemo ? <DemoMark label={tCommon("demoMark")} /> : null}
            </div>
          ) : null}
          <h3 className="font-display text-h3 leading-h3 text-ink in-data-[theme=navy]:text-mineral">
            <MorphLink
              href={`/product/${item.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              <TitleText
                full={accessibleCardName(item)}
                visible={item.displayTitle}
                clamp={2}
              />
            </MorphLink>
          </h3>
          {meta.dimensions || meta.materials ? (
            <dl className="flex flex-col gap-1 border-t border-hairline pt-3">
              {meta.dimensions ? (
                <div className="flex gap-2">
                  <dt className="u-micro">{t("card.collectible.sizeLabel")}</dt>
                  <dd className="u-num text-small text-ink in-data-[theme=navy]:text-mineral">
                    {meta.dimensions}
                  </dd>
                </div>
              ) : null}
              {meta.materials ? (
                <div className="flex gap-2">
                  <dt className="u-micro">
                    {t("card.collectible.materialsLabel")}
                  </dt>
                  <dd className="font-body text-small text-ink in-data-[theme=navy]:text-mineral">
                    {meta.materials}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <p className="u-num text-16 text-ink in-data-[theme=navy]:text-mineral">
            {meta.price.kind === "onRequest"
              ? t("card.collectible.priceOnRequest")
              : meta.price.label}
          </p>
          <p className="u-micro">
            {meta.availability === "madeToOrder"
              ? t("card.madeToOrder")
              : t("card.badgeOutOfStock")}
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

        {/* One real control beside the stretched card link, above it in the
            stacking order (see the full variant): the WhatsApp thread is the
            consultation. */}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <CardAskWhatsApp title={item.title} slug={item.slug} />
        </div>
      </article>
    );
  }

  /* ————— Memory: the MEDIUM_FORMAT tier (docs/plan/07). The brief calls
     this tier's product "guided customization" — so the card answers the two
     questions the `full` card leaves open for a commemorative piece: what do
     I get to choose, and how long until I have it.

     No materials/dimensions line here, deliberately. That is the collectible
     card's content because a collectible IS an object; this tier is a service
     that ends in one, and the size of the finished block is not what a person
     comparing two varmala studios is weighing.

     The choice count is a NUMBER through translated copy. `variantChips`
     holds strings built in `shop.ts` as hardcoded English ("Colours +3",
     "Sizes S/M/L") and rendered nowhere today — painting them here would put
     English on a card in nine locales. ————— */
  if (memory) {
    const meta = memoryCardMeta(item);
    /* Composed with the site's mono separator, the way `cardMetaLine` already
       joins materials and dimensions. Both halves are translated or
       owner-typed; neither is a sentence with a word order to get wrong. */
    const availability = meta.availability === "madeToOrder"
      ? [t("card.madeToOrder"), meta.leadTime].filter(Boolean).join(" · ")
      : t("card.badgeOutOfStock");
    return (
      <article
        data-slot="sf-catalog-card"
        data-variant="memory"
        className={cn("group relative", className)}
      >
        {stage}
        <div className="mt-4 flex flex-col gap-1.5">
          {meta.occasion || item.isDemo ? (
            <div className="flex items-center gap-2">
              {meta.occasion ? (
                <p className="u-micro">{meta.occasion}</p>
              ) : null}
              {item.isDemo ? <DemoMark label={tCommon("demoMark")} /> : null}
            </div>
          ) : null}
          <h3 className="font-body text-16 leading-snug font-medium text-ink in-data-[theme=navy]:text-mineral">
            <MorphLink
              href={`/product/${item.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              <TitleText
                full={accessibleCardName(item)}
                visible={item.displayTitle}
                clamp={2}
              />
            </MorphLink>
          </h3>
          {meta.choices > 0 ? (
            <p className="u-micro">
              {t("card.customize")} ·{" "}
              {t("card.choicesCount", { count: meta.choices })}
            </p>
          ) : null}
          <p className="u-num text-16 text-ink in-data-[theme=navy]:text-mineral">
            {meta.price.kind === "onRequest"
              ? t("card.collectible.priceOnRequest")
              : meta.price.label}
          </p>
          <p className="u-micro">{availability}</p>
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

        {/* Both controls, as the full card has: this tier's whole proposition
            is the conversation about what gets made, so the WhatsApp thread
            is not an afterthought here. */}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <QuickViewTrigger item={item} />
          <CardAskWhatsApp title={item.title} slug={item.slug} />
        </div>
      </article>
    );
  }

  /* ————— Gift: the SMALL_FORMAT tier (docs/plan/07) — "efficient grid,
     quick personalization, variants, price visible".

     "Price visible" is the line that shapes it: the price comes FIRST, in the
     display face, where every other variant puts it under the title in body
     size. Density comes from dropping the category eyebrow and the materials
     line — not from dropping the affordance, so "View piece" stays.

     It can still resolve to "price on request". "Price visible" is how this
     tier is MEANT to be filled in, not a promise the card can keep on a row
     with no published figure. ————— */
  if (gift) {
    const meta = giftCardMeta(item);
    return (
      <article
        data-slot="sf-catalog-card"
        data-variant="gift"
        className={cn("group relative", className)}
      >
        {stage}
        <div className="mt-4 flex flex-col gap-1">
          <p className="u-num text-20 text-ink in-data-[theme=navy]:text-mineral">
            {meta.price.kind === "onRequest"
              ? t("card.collectible.priceOnRequest")
              : meta.price.label}
          </p>
          <h3 className="font-body text-16 leading-snug font-medium text-ink in-data-[theme=navy]:text-mineral">
            <MorphLink
              href={`/product/${item.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              <TitleText
                full={accessibleCardName(item)}
                visible={item.displayTitle}
                clamp={2}
              />
            </MorphLink>
          </h3>
          <p className="u-micro">
            {meta.availability === "madeToOrder"
              ? t("card.madeToOrder")
              : t("card.badgeOutOfStock")}
            {meta.choices > 0
              ? ` · ${t("card.choicesCount", { count: meta.choices })}`
              : null}
          </p>
          {/* The demo mark sits on its own row here rather than beside an
              eyebrow, because this variant has no eyebrow to sit beside. */}
          {item.isDemo ? <DemoMark label={tCommon("demoMark")} /> : null}
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

        {/* Quick view IS the quick personalization this tier asks for — the
            panel carries the customization fields without a page load. */}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <QuickViewTrigger item={item} />
          <CardAskWhatsApp title={item.title} slug={item.slug} />
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
        {item.categoryName || item.isDemo ? (
          <div className="flex items-center gap-2">
            {item.categoryName ? (
              <p className="u-micro">{item.categoryName}</p>
            ) : null}
            {item.isDemo ? <DemoMark label={tCommon("demoMark")} /> : null}
          </div>
        ) : null}
        <h3 className="font-body text-16 leading-snug font-medium text-ink in-data-[theme=navy]:text-mineral">
          {/* MorphLink drives the card → PDP view-transition morph. */}
          <MorphLink
            href={`/product/${item.slug}`}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
          >
            <TitleText
              full={accessibleCardName(item)}
              visible={item.displayTitle}
              clamp={2}
            />
          </MorphLink>
        </h3>
        {metaLine ? (
          <p className="u-micro line-clamp-1">
            <span className="sr-only">{t("card.materialsDimensions")}: </span>
            {metaLine}
          </p>
        ) : null}
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

      {/* Below the stretched card link and OUTSIDE it: `relative z-10` puts
          these two real controls above the invisible full-card anchor
          (the same technique the wishlist heart already uses), so they stay
          reachable rather than silently triggering navigation instead. */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <QuickViewTrigger item={item} />
        <CardAskWhatsApp title={item.title} slug={item.slug} />
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
      <span
        aria-hidden
        className={clamp === 1 ? "line-clamp-1" : "line-clamp-2"}
      >
        {visible}
      </span>
    </>
  );
}
