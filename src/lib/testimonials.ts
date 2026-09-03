import { defaultLocale } from "@/i18n/config";
import { db } from "@/lib/db";
import { demoClause } from "@/lib/demo-clause";
import { demoWhere } from "@/lib/demo-content";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import type { PermissionStatus, Prisma } from "@/generated/prisma/client";

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
  /** "Interior designer, Surat" — the line under the name. */
  designation: string | null;
  /** What they bought, in their words, when it is not a catalogue product. */
  productTitle: string | null;
  /** The linked catalogue piece, when the words are about one. */
  productSlug: string | null;
  /** The linked case study, when the words are about one. */
  portfolioSlug: string | null;
  installationImageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  featured: boolean;
  /** A seeded fixture, not a customer — consumers mark it as such. */
  isDemo: boolean;
  /** When the customer gave the testimonial, as an ISO string. */
  givenAt: string | null;
  permissionStatus: PermissionStatus;
}

/**
 * What a public page can ask for. Every field is optional; the defaults
 * reproduce the original `getTestimonials(take, locale)` call exactly.
 */
export type TestimonialQuery = {
  take?: number;
  locale?: string;
  productId?: string;
  portfolioId?: string;
  category?: string;
  featured?: boolean;
  /**
   * Whether demo fixtures may appear. Left undefined, the environment decides
   * (`showDemoContent()`); a page that has already asked can pass the answer
   * through so the gate is consulted once per request.
   */
  includeDemo?: boolean;
};

const DEFAULT_TAKE = 8;

/**
 * Everything a public page may know about a testimonial — and nothing else.
 * `internalNotes` is staff-only and is NEVER selected here; adding it to this
 * select would ship the owner's private remarks to every visitor.
 */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  location: true,
  quote: true,
  rating: true,
  avatarUrl: true,
  translations: true,
  designation: true,
  productTitle: true,
  installationImageUrl: true,
  videoUrl: true,
  videoPosterUrl: true,
  featured: true,
  isDemo: true,
  givenAt: true,
  permissionStatus: true,
  product: { select: { slug: true } },
  portfolio: { select: { slug: true } },
} satisfies Prisma.TestimonialSelect;

/**
 * Serialized testimonials for public pages, in the curated Studio order
 * (MKT-203). One source for the homepage, product page and custom-order page,
 * so social proof is filtered (per product / case study / category, featured,
 * demo) from a single place. Returns [] when none exist — every caller renders
 * nothing rather than fabricating proof (the no-invented-content hard rule).
 *
 * Only PUBLISHED rows are ever returned: a draft, a quote awaiting the
 * customer's permission or an archived one is invisible here regardless of
 * what else the query asks for. Demo fixtures are gated by `includeDemo`
 * (see `TestimonialQuery`).
 *
 * Total, like `getSiteImages()`: an unreachable database resolves to [] so a
 * page still renders without its words band rather than not at all.
 *
 * Two call shapes. The positional `(take, locale)` form is what the homepage,
 * the PDP and the custom-order page have used since the helper was written
 * and keeps working unchanged; the object form adds the filters. Pass the
 * active locale to resolve per-locale overrides with English fallback (I3) —
 * the customer's name is never translated, only quote and location.
 */
export async function getTestimonials(
  take?: number,
  locale?: string,
): Promise<TestimonialItem[]>;
export async function getTestimonials(
  query: TestimonialQuery,
): Promise<TestimonialItem[]>;
export async function getTestimonials(
  queryOrTake: TestimonialQuery | number = DEFAULT_TAKE,
  positionalLocale?: string,
): Promise<TestimonialItem[]> {
  const query: TestimonialQuery =
    typeof queryOrTake === "number"
      ? { take: queryOrTake, locale: positionalLocale }
      : queryOrTake;
  const take = query.take ?? DEFAULT_TAKE;
  const locale = query.locale ?? defaultLocale;

  try {
    const demo =
      query.includeDemo === undefined
        ? await demoWhere()
        : demoClause(query.includeDemo);
    const where: Prisma.TestimonialWhereInput = {
      status: "PUBLISHED",
      ...demo,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.portfolioId ? { portfolioId: query.portfolioId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.featured === undefined ? {} : { featured: query.featured }),
    };
    const rows = await db.testimonial.findMany({
      where,
      orderBy: { order: "asc" },
      take,
      select: PUBLIC_SELECT,
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
        designation: row.designation?.trim() || null,
        productTitle: row.productTitle?.trim() || null,
        productSlug: row.product?.slug ?? null,
        portfolioSlug: row.portfolio?.slug ?? null,
        installationImageUrl: row.installationImageUrl?.trim() || null,
        videoUrl: row.videoUrl?.trim() || null,
        videoPosterUrl: row.videoPosterUrl?.trim() || null,
        featured: row.featured,
        isDemo: row.isDemo,
        givenAt: row.givenAt ? row.givenAt.toISOString() : null,
        permissionStatus: row.permissionStatus,
      };
    });
  } catch (error) {
    console.error("getTestimonials failed; rendering without testimonials", error);
    return [];
  }
}
