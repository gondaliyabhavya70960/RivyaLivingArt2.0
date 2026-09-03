import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/storefront/section-heading";
import { TestimonialWall } from "@/components/storefront/testimonial-wall";
import { getTestimonials } from "@/lib/testimonials";

/**
 * The PDP's words band. `getTestimonials` was already scoped per product
 * (`testimonials.ts:38-41` used to call it with no `where` at all — every
 * product page showed the same global set); this widens the fallback one
 * step further: a piece with no words of its own borrows its CATEGORY's,
 * because "nobody has said anything about this exact piece yet" is not the
 * same claim as "nobody likes this kind of piece" — and renders nothing
 * rather than either fabricating a quote or showing an empty band (Part 0).
 *
 * Self-contained — the section, its heading and its band all live here, so
 * a PDP mounts it with three props and nothing else. Not mounted by this
 * batch; A3 owns the PDP layout that calls it.
 */
export async function ProductTestimonials({
  productId,
  categorySlug,
  locale,
}: {
  productId: string;
  categorySlug: string;
  locale: string;
}) {
  let testimonials = await getTestimonials({ productId, locale });
  if (testimonials.length === 0) {
    testimonials = await getTestimonials({ category: categorySlug, locale });
  }
  if (testimonials.length === 0) return null;

  const t = await getTranslations("Testimonials");

  return (
    <section
      aria-labelledby="product-testimonials-heading"
      className="section-standard bg-sand"
    >
      <div className="u-shell flex flex-col gap-12">
        <SectionHeading
          id="product-testimonials-heading"
          title={t("wallHeading")}
        />
        <TestimonialWall testimonials={testimonials} />
      </div>
    </section>
  );
}
