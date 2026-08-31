import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/storefront/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * v2.0 storefront Product card (DESIGN.md B3 · B4 · A2/A3/A5). Server
 * component: image with hover second-image swap, badge per A2 rule 5, Fraunces
 * title, mono "from ₹" price (A3 — final price is quoted in WhatsApp, Part 0),
 * and a royal-blue "Customize" line — royal blue is the ONLY interactive color
 * (A2 rule 2). Whole card is the link via the stretched title anchor. B4 card
 * motion: hover lift −6px + THE one soft product shadow (A5 — elevation is
 * otherwise surface color, never boxes), --dur-micro / --ease-out,
 * motion-reduce safe. CTA magnetism arrives in the phase-5 motion pass.
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
        "shadow-obsidian/10 transition-[transform,box-shadow] duration-(--dur-micro) ease-(--ease-out) hover:-translate-y-1.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
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
            className="object-cover opacity-0 transition-opacity duration-(--dur-micro) ease-(--ease-out) group-hover:opacity-100 motion-reduce:transition-none"
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
            className="size-4 transition-transform duration-(--dur-micro) ease-(--ease-out) group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </p>
      </div>
    </article>
  );
}
