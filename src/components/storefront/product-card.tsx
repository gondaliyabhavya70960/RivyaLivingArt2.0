import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/storefront/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The SUPERSEDED v2.0 product card (DESIGN.md B3 · B4 · A2/A3/A5), kept for
 * `/design-lab` only — nothing on the storefront renders it. The live PLP and
 * rail card is `catalog-product-card.tsx` (REDESIGN.md §4.6), which drops the
 * fill, the shadow and the lift this one carries.
 *
 * That is why the hover lift and `shadow-lg` below survive a repo whose
 * contract bans storefront drop shadows outright (Part 3.5): they are the v2
 * grammar, on a v2 component, behind a lab route. The design lab's own fate
 * is owner decision D17 — rebuild small or retire — and this file goes with
 * it either way, so it is not being half-migrated here.
 *
 * Its badge labels are hardcoded English for the same reason; they never
 * reach a visitor. Durations and easing are on the Part 3.8 tokens because
 * the aliases they used to name no longer exist.
 */
export type ProductCardData = {
  title: string;
  slug: string;
  fromPrice: number;
  image: string;
  hoverImage?: string;
  badge?: "atelierPick" | "madeToOrder" | "shipsIn";
  alt?: string;
};

/* §4.6: only three badges exist across the whole site. */
const badgeLabels: Record<NonNullable<ProductCardData["badge"]>, string> = {
  atelierPick: "Atelier pick",
  madeToOrder: "Made to order",
  shipsIn: "Ships in 7–10 days",
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { title, slug, fromPrice, image, hoverImage, badge, alt } = product;

  return (
    <article
      data-slot="sf-product-card"
      className={cn(
        "group relative overflow-hidden rounded-card bg-sand",
        // B4 product-card hover: lift −6px + soft shadow (the single product
        // shadow, A5), on the micro-motion tokens; static under reduced motion.
        "shadow-obsidian/10 transition-[transform,box-shadow] duration-(--dur-fast) ease-(--ease-luxury) hover:-translate-y-1.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
      )}
    >
      <div className="relative aspect-[4/5] bg-sand">
        <Image
          src={image}
          alt={alt ?? title}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="object-cover"
        />
        {hoverImage ? (
          /* B2 Shop/PLP hover second-image swap — decorative duplicate view. */
          <Image
            src={hoverImage}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-(--dur-fast) ease-(--ease-luxury) group-hover:opacity-100 motion-reduce:transition-none"
          />
        ) : null}
        {badge ? (
          <Badge variant={badge} className="absolute top-3 left-3 z-10">
            {badgeLabels[badge]}
          </Badge>
        ) : null}
      </div>

      <div className="p-6">
        <h3 className="font-display text-20 leading-snug text-ink">
          <Link
            href={`/product/${slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-2"
          >
            {title}
          </Link>
        </h3>
        {/* A3: mono for price microcopy; base price only per Part 0. */}
        <p className="mt-2 font-mono text-14 text-graphite">
          from ₹{fromPrice.toLocaleString("en-IN")}
        </p>
        <p className="mt-3 inline-flex items-center gap-1 font-body text-14 font-medium text-sapphire">
          Customize
          <ArrowRight
            aria-hidden
            strokeWidth={1.5}
            className="size-4 transition-transform duration-(--dur-fast) ease-(--ease-luxury) group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </p>
      </div>
    </article>
  );
}
