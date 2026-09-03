import { getTranslations } from "next-intl/server";

import { DemoMark } from "@/components/storefront/demo-mark";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { MorphLink } from "@/components/storefront/morph-link";
import { RatingStars } from "@/components/storefront/rating-stars";
import { TestimonialVideoFrame } from "@/components/storefront/testimonial-video-frame";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

export type TestimonialCardVariant = "editorial" | "linked" | "video";

export type TestimonialCardProps = {
  quote: string;
  name: string;
  location?: string | null;
  /** "Interior designer, Surat" — the line under the name. */
  designation?: string | null;
  rating: number;
  avatarUrl?: string | null;
  /**
   * `editorial` (default) — a large pull-quote with mono attribution,
   * unchanged in shape from the card every page has used since Phase 7,
   * just typeset to the mono-attribution rule (§3.2).
   * `linked` — the quote beside the linked product or case study's own
   * photograph, the whole tile a `MorphLink` to it.
   * `video` — a poster with a play chip; the film never autoplays.
   */
  variant?: TestimonialCardVariant;
  /** A seeded fixture, never a customer — renders the mono mark and the
   *  "not a customer review" line instead of standing in for real proof. */
  demo?: boolean;
  /** `large` bumps the pull-quote a step up the type scale — `TestimonialWall`
   *  uses it for `featured` rows so they read as chosen, not just first. */
  size?: "default" | "large";
  className?: string;

  // `linked` only.
  linkHref?: string;
  linkImageSrc?: string | null;
  linkImageAlt?: string;
  /** Which label to show under the linked image. */
  linkKind?: "product" | "portfolio";

  // `video` only.
  videoUrl?: string | null;
  videoPosterUrl?: string | null;
};

/**
 * Storefront testimonial card.
 *
 * Sand card on the light band, no shadow — elevation is the surface shift,
 * not a drop shadow (the storefront has exactly two shadow exceptions and
 * this is neither). Proper `<figure>`/`<blockquote>`/`<figcaption>`
 * semantics on every variant.
 *
 * **The photograph.** `Testimonial.avatarUrl` has been writable in the
 * Studio since the original form shipped; when it is set the `editorial`
 * card leads with it at 4:5 through `MeniscusImage` — text-only quotes are
 * the weakest form of proof for a visual product, and this is the one place
 * a real customer's own photo can carry the claim. When it is unset the
 * card is exactly what it was: the quote alone, never a placeholder avatar
 * and never a monogram, because inventing a face is worse than showing
 * none.
 *
 * The alt text on every image here is empty or built from the customer's
 * name — the row carries no caption for any of these fields, so anything
 * more descriptive would be a guess.
 */
export async function TestimonialCard({
  quote,
  name,
  location,
  designation,
  rating,
  avatarUrl,
  variant = "editorial",
  demo = false,
  size = "default",
  className,
  linkHref,
  linkImageSrc,
  linkImageAlt,
  linkKind = "product",
  videoUrl,
  videoPosterUrl,
}: TestimonialCardProps) {
  const t = await getTranslations("Testimonials");
  const tCommon = await getTranslations("Common");

  const attribution = [name, designation || location]
    .filter(Boolean)
    .join(" · ");
  const quoteClass = cn(
    "mt-4 font-display leading-snug text-ink",
    size === "large" ? "text-h3" : "text-20",
  );

  const demoBanner = demo ? (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <DemoMark label={tCommon("demoMark")} />
      <span className="u-micro">{t("demoNotice")}</span>
    </div>
  ) : null;

  if (variant === "video" && isRenderableSrc(videoUrl)) {
    return (
      <figure
        data-slot="sf-testimonial-card"
        className={cn(
          "flex flex-col overflow-hidden rounded-card bg-sand",
          className,
        )}
      >
        {demoBanner ? <div className="px-6 pt-6">{demoBanner}</div> : null}
        <TestimonialVideoFrame
          videoUrl={videoUrl}
          posterUrl={isRenderableSrc(videoPosterUrl) ? videoPosterUrl : null}
          watchLabel={t("watchFilm")}
        />
        <div className="p-6">
          <RatingStars rating={rating} />
          <blockquote className={quoteClass}>“{quote}”</blockquote>
          <figcaption className="u-micro mt-4">
            {attribution || name}
          </figcaption>
        </div>
      </figure>
    );
  }

  if (variant === "linked" && linkHref) {
    const linkedLabel =
      linkKind === "portfolio" ? t("linkedProject") : t("linkedPiece");
    return (
      <figure
        data-slot="sf-testimonial-card"
        className={cn(
          "group relative grid gap-0 overflow-hidden rounded-card bg-sand sm:grid-cols-2",
          className,
        )}
      >
        {isRenderableSrc(linkImageSrc) ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand sm:aspect-auto">
            <MeniscusImage
              src={linkImageSrc}
              alt={linkImageAlt ?? ""}
              fill
              sizes="(min-width:768px) 25vw, 90vw"
              unoptimized={!isOptimizableImageSrc(linkImageSrc)}
              className="absolute inset-0"
              imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </div>
        ) : null}
        <div className="flex flex-col justify-center p-6">
          {demoBanner}
          <div className="flex flex-wrap items-center gap-3">
            <RatingStars rating={rating} />
            {/* A "linked" card is provably tied to one real piece or case
                study in the catalogue — the one trust signal this variant
                can make honestly, distinct from a staff verification claim
                the row's data does not carry here. */}
            <span className="u-micro text-graphite">{t("verifiedBy")}</span>
          </div>
          <blockquote className={quoteClass}>“{quote}”</blockquote>
          <figcaption className="u-micro mt-4">
            {attribution || name}
          </figcaption>
          <MorphLink
            href={linkHref}
            className="u-micro mt-4 inline-flex items-center gap-2 text-sapphire-ink outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
          >
            {linkedLabel}
          </MorphLink>
        </div>
      </figure>
    );
  }

  // `editorial` — the default, and the fallback when `linked`/`video` are
  // requested without the data they need (no image/href, no video URL).
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
            alt=""
            fill
            sizes="(min-width:768px) 33vw, 90vw"
            unoptimized={!isOptimizableImageSrc(photo)}
            className="absolute inset-0"
            imageClassName="object-cover"
          />
        </div>
      ) : null}
      {/* In a 3-up grid the cards stretch to the tallest, so a quote with no
          photograph beside two with one would sit at the top of a card-and-a-
          half of empty sand. Centring its block makes the odd card read as a
          deliberate pull-quote panel instead of a hole in the row. Single
          column below md, where every card already sizes to its own content
          and there is nothing to centre against. */}
      <div className={cn("p-6", photo ? null : "md:my-auto")}>
        {demoBanner}
        <RatingStars rating={rating} />
        <blockquote className={quoteClass}>“{quote}”</blockquote>
        <figcaption className="u-micro mt-4">{attribution || name}</figcaption>
      </div>
    </figure>
  );
}
