import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { RatingStars } from "@/components/storefront/rating-stars";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

/**
 * Storefront testimonial card. Server component.
 *
 * Sand card on the light band, no shadow — elevation is the surface shift, not
 * a drop shadow (the storefront has exactly two shadow exceptions and this is
 * neither). Proper <figure>/<blockquote>/<figcaption> semantics.
 *
 * **The photograph.** `Testimonial.avatarUrl` has been writable in the Studio
 * since the form was built, and until now it reached no page: nothing selected
 * it, so an owner could set a picture and watch the site ignore it. When one
 * is set the card leads with it at 4:5 through `MeniscusImage` — text-only
 * quotes are the weakest form of proof for a visual product, and this is the
 * one place a real customer's piece can carry the claim. When it is unset the
 * card is exactly what it was: the quote alone, never a placeholder avatar and
 * never a monogram, because inventing a face is worse than showing none.
 *
 * The alt text describes the picture rather than naming the brand, and is
 * built from the customer's name because that is the only thing the row knows
 * about it — the owner writes no caption for this field.
 */
export function TestimonialCard({
  quote,
  name,
  location,
  rating,
  avatarUrl,
  className,
}: {
  quote: string;
  name: string;
  location?: string;
  rating: number;
  avatarUrl?: string | null;
  className?: string;
}) {
  const photo = isRenderableSrc(avatarUrl) ? avatarUrl : null;

  return (
    <figure
      data-slot="sf-testimonial-card"
      className={cn(
        "flex flex-col overflow-hidden rounded-card bg-sand",
        className,
      )}
    >
      {photo ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand">
          <MeniscusImage
            src={photo}
            /* Deliberately empty. The row stores a URL and nothing else, so
               any sentence here would be a guess — and a hard-coded English
               one, shipped untranslated to nine locales. The <figcaption>
               below names the person and the quote carries the meaning, so
               the picture is decorative in the accessibility sense. A real
               description would need a caption column on Testimonial, which
               the hard rules put out of scope. */
            alt=""
            fill
            sizes="(min-width:768px) 33vw, 90vw"
            unoptimized={!isOptimizableImageSrc(photo)}
            className="absolute inset-0"
            imageClassName="object-cover"
          />
        </div>
      ) : null}
      {/* In the 3-up grid the cards stretch to the tallest, so a quote with no
          photograph beside two with one would sit at the top of a card-and-a-
          half of empty sand. Centring its block makes the odd card read as a
          deliberate pull-quote panel instead of a hole in the row. Single
          column below md, where every card already sizes to its own content
          and there is nothing to centre against. */}
      <div className={cn("p-6", photo ? null : "md:my-auto")}>
        <RatingStars rating={rating} />
        <blockquote className="mt-4 font-display text-20 leading-snug text-ink">
          “{quote}”
        </blockquote>
        <figcaption className="mt-4 font-body text-14 text-graphite">
          {name}
          {location ? <span> · {location}</span> : null}
        </figcaption>
      </div>
    </figure>
  );
}
