"use client";

import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/storefront/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/storefront/dialog";
import { DemoMark } from "@/components/storefront/demo-mark";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { MorphLink } from "@/components/storefront/morph-link";
import { useWaNumber } from "@/components/providers/wa-number-provider";
import { cardMetaLine } from "@/lib/card-meta";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import type { ShopProductItem } from "@/lib/shop";
import { cn, formatPriceBand, monogram } from "@/lib/utils";
import { buildWaLink } from "@/lib/whatsapp";

/**
 * The card's quick look — REDESIGN.md §4.6's "Quick view" affordance,
 * revived from the `Shop.quickView*` keys that already shipped in all nine
 * locales. A storefront `Dialog`, not a second page: identity, price, the
 * mono meta line and exactly the two actions the full PDP leads with —
 * "View & customize" (a real `MorphLink`, so the view-transition morph still
 * pairs the two stages) and "Ask on WhatsApp".
 *
 * The trigger (`quick-view-trigger.tsx`) owns `open`; this component is pure
 * presentation over whichever item it was handed.
 */
export function QuickView({
  item,
  open,
  onOpenChange,
  onClosed,
}: {
  item: ShopProductItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus to restore when the dialog closes — the element that opened it. */
  onClosed?: () => void;
}) {
  const t = useTranslations("Shop");
  const tCommon = useTranslations("Common");
  const waNumber = useWaNumber();

  const image = isRenderableSrc(item.image?.url) ? item.image : null;
  const priceLabel =
    item.showPrice && item.priceMin != null
      ? formatPriceBand(item.priceMin, item.priceMax)
      : t("card.viewDetails");
  const metaLine = cardMetaLine(item);
  const productUrl = `/product/${item.slug}`;
  const waHref = buildWaLink(
    `${t("quickViewWhatsApp")}: ${item.title}\n${productUrl}`,
    waNumber,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("close")}
        className="grid max-w-2xl gap-6 sm:grid-cols-2 sm:gap-8"
        // Radix parks focus on the body when a dialog it did not open through
        // its own trigger closes. The caller hands back the element that
        // opened this one, so Escape returns the visitor to the card they
        // were reading rather than the top of the shop.
        onCloseAutoFocus={(event) => {
          if (!onClosed) return;
          event.preventDefault();
          onClosed();
        }}
      >
        <DialogTitle className="sr-only">{item.title}</DialogTitle>

        <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-sand">
          {image ? (
            <MeniscusImage
              src={sizedExternalSrc(image.url, 700)}
              alt={image.alt || item.title}
              fill
              reveal={false}
              sizes="(min-width:640px) 40vw, 90vw"
              unoptimized={!isOptimizableImageSrc(image.url)}
              className="absolute inset-0"
              imageClassName="object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-obsidian font-display text-49 text-mineral/70"
            >
              {monogram(item.displayTitle)}
            </span>
          )}
        </div>

        <div className="flex flex-col justify-center gap-3">
          {item.isDemo ? <DemoMark label={tCommon("demoMark")} /> : null}
          {item.categoryName ? (
            <p className="u-micro">{item.categoryName}</p>
          ) : null}
          <h2 className="font-display text-h3 leading-h3 tracking-display text-ink">
            {item.displayTitle}
          </h2>
          <p className="u-num text-18 text-ink">{priceLabel}</p>
          <p
            className={cn(
              "font-body text-14 leading-relaxed text-graphite",
              !item.shortTagline && "u-micro",
            )}
          >
            {item.shortTagline || t("quickViewTaglineFallback")}
          </p>
          {metaLine ? (
            <p className="u-num text-14 text-graphite">
              <span className="sr-only">{t("card.materialsDimensions")}: </span>
              {metaLine}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            <Button asChild variant="primary" size="md">
              <MorphLink href={productUrl}>{t("quickViewCustomize")}</MorphLink>
            </Button>
            <Button asChild variant="whatsapp" size="md">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="quick-view"
              >
                <MessageCircle
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4"
                />
                {t("quickViewWhatsApp")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
