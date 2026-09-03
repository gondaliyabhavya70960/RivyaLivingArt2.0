import {
  TestimonialCard,
  type TestimonialCardVariant,
} from "@/components/storefront/testimonial-card";
import type { TestimonialItem } from "@/lib/testimonials";

/**
 * The words band's default layout: a CSS-columns wall (the
 * `portfolio/lightbox-gallery.tsx` masonry technique — `columns-1 md:columns-2
 * lg:columns-3`, `break-inside-avoid`), never a carousel (REDESIGN.md's
 * motion ceiling forbids scroll-jacking outside the two sanctioned pins, and
 * a carousel is exactly the pattern that tempts one).
 *
 * Each row picks its own card variant from what the row actually has:
 * a video film when `videoUrl` is set, the linked piece's own installation
 * photo when the row is tied to a product or case study, and the plain
 * pull-quote otherwise. `editorialFirst` forces the FIRST row to the
 * pull-quote regardless — the opening word should read as a statement, not
 * whichever row happened to carry a photo.
 */
export function TestimonialWall({
  testimonials,
  editorialFirst = false,
  className,
}: {
  testimonials: TestimonialItem[];
  editorialFirst?: boolean;
  className?: string;
}) {
  if (testimonials.length === 0) return null;

  return (
    <div className={className ?? "columns-1 gap-6 sm:columns-2 lg:columns-3"}>
      {testimonials.map((item, index) => {
        const variant: TestimonialCardVariant =
          editorialFirst && index === 0
            ? "editorial"
            : item.videoUrl
              ? "video"
              : item.productSlug || item.portfolioSlug
                ? "linked"
                : "editorial";

        const linkKind: "product" | "portfolio" = item.productSlug
          ? "product"
          : "portfolio";
        const linkHref = item.productSlug
          ? `/product/${item.productSlug}`
          : item.portfolioSlug
            ? `/portfolio/${item.portfolioSlug}`
            : undefined;

        return (
          <TestimonialCard
            key={item.id}
            className="mb-6 break-inside-avoid"
            quote={item.quote}
            name={item.name}
            location={item.location}
            designation={item.designation}
            rating={item.rating}
            avatarUrl={item.avatarUrl}
            demo={item.isDemo}
            size={item.featured ? "large" : "default"}
            variant={variant}
            linkHref={linkHref}
            linkImageSrc={item.installationImageUrl}
            linkImageAlt={item.name}
            linkKind={linkKind}
            videoUrl={item.videoUrl}
            videoPosterUrl={item.videoPosterUrl}
          />
        );
      })}
    </div>
  );
}
