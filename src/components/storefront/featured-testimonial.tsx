import { getTranslations } from "next-intl/server";

import { DemoMark } from "@/components/storefront/demo-mark";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { RatingStars } from "@/components/storefront/rating-stars";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";
import type { TestimonialItem } from "@/lib/testimonials";

/**
 * One cinematic quote, alone, on a light ground — the treatment for a single
 * `featured` testimonial rather than a wall of them (a homepage or PDP
 * moment, not the `/custom-order` words band). Not mounted by this batch:
 * A2 (homepage) and A3 (PDP) own where it lands; this is the component they
 * mount, built ahead of its call site the way `hero-parallax.tsx` was.
 *
 * `mineral`, never `sand` or `obsidian` — the spec's "light ground" note
 * exists because the words band around it is usually `sand`, and stacking
 * two warm neutrals back to back reads as one long beige section rather than
 * a considered pause.
 */
export async function FeaturedTestimonial({
  testimonial,
  className,
}: {
  testimonial: TestimonialItem;
  className?: string;
}) {
  const t = await getTranslations("Testimonials");
  const tCommon = await getTranslations("Common");

  const photo = isRenderableSrc(testimonial.installationImageUrl)
    ? testimonial.installationImageUrl
    : null;
  const attribution = [
    testimonial.name,
    testimonial.designation || testimonial.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const meta = [
    attribution,
    testimonial.givenAt
      ? t("givenOn", {
          date: new Date(testimonial.givenAt).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <figure
      data-slot="sf-featured-testimonial"
      className={cn(
        "grid gap-10 bg-mineral md:grid-cols-12 md:items-center",
        className,
      )}
    >
      <div className="md:col-span-7 md:col-start-1">
        {testimonial.isDemo ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <DemoMark label={tCommon("demoMark")} />
            <span className="u-micro">{t("demoNotice")}</span>
          </div>
        ) : null}
        <RatingStars rating={testimonial.rating} />
        <blockquote className="mt-6 font-display text-h2 leading-[1.1] tracking-display text-ink">
          “{testimonial.quote}”
        </blockquote>
        <figcaption className="u-micro mt-6">
          {meta || testimonial.name}
        </figcaption>
      </div>
      {photo ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-image bg-sand md:col-span-4 md:col-start-9">
          <MeniscusImage
            src={photo}
            alt=""
            fill
            sizes="(min-width:768px) 33vw, 90vw"
            unoptimized={!isOptimizableImageSrc(photo)}
            className="absolute inset-0"
            imageClassName="object-cover"
          />
        </div>
      ) : null}
    </figure>
  );
}
