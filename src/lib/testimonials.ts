import { defaultLocale } from "@/i18n/config";
import { db } from "@/lib/db";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";

/** Serialized testimonial row shape shared by every public consumer.
 *  (Lived on the v7 TestimonialCarousel until Phase 7 retired it.) */
export interface TestimonialItem {
  id: string;
  name: string;
  location: string | null;
  quote: string;
  rating: number;
  /**
   * The customer's photograph, or the piece they commissioned.
   *
   * The column and the Studio field both shipped (`actions/testimonials.ts`
   * validates and writes it; the form has taken a URL since it was built) —
   * but nothing selected it here, so a photo the owner set reached no page.
   * Null whenever it is unset, which is the common case, and every consumer
   * renders the quote alone rather than a placeholder.
   */
  avatarUrl: string | null;
}

/**
 * Serialized testimonials for public pages, in the curated Studio order
 * (MKT-203). One source for the homepage, product page and custom-order page,
 * so social proof can later be filtered (per-category/product, featured flag)
 * from a single place. Returns [] when none exist — every caller renders
 * nothing rather than fabricating proof (the no-invented-content hard rule).
 *
 * Pass the active locale to resolve per-locale overrides with English
 * fallback (I3) — the customer's name is never translated, only quote and
 * location.
 */
export async function getTestimonials(
  take = 8,
  locale: string = defaultLocale,
): Promise<TestimonialItem[]> {
  const rows = await db.testimonial.findMany({
    orderBy: { order: "asc" },
    take,
  });
  return rows.map((row) => {
    const t = localize(row, locale, TRANSLATABLE_FIELDS.testimonial);
    return {
      id: t.id,
      name: t.name,
      location: t.location,
      quote: t.quote,
      rating: t.rating,
      avatarUrl: row.avatarUrl?.trim() || null,
    };
  });
}
