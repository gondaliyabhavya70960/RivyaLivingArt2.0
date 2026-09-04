import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { CollectionCard } from "@/components/storefront/collection-card";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { TestimonialCard } from "@/components/storefront/testimonial-card";

import {
  MOCK_COLLECTIONS,
  MOCK_PRODUCTS,
  MOCK_TESTIMONIALS,
} from "@/app/design-lab/mock-data";
import { LabSection } from "./lab-section";

/**
 * The composite storefront blocks — REDESIGN.md §4.6 — assembled from mock
 * catalog/testimonial rows so the real shapes (a card grid, a collection
 * trio, a testimonial pair) are reviewable without a live database.
 */
export function SectionsTab() {
  return (
    <div className="space-y-16">
      <LabSection index={1} title="Section heading">
        <SectionHeading
          eyebrow="The signature"
          eyebrowIndex={1}
          title="Every piece begins with a pour"
          intro="Mono eyebrow, display heading, an optional 52ch intro — the shape behind roughly forty sections on the live site."
        />
        <div className="mt-6">
          <Eyebrow index={2} rule>
            A standalone eyebrow, with its index and hairline
          </Eyebrow>
        </div>
      </LabSection>

      <LabSection index={2} title="Collection card trio">
        <div className="grid gap-4 sm:grid-cols-3">
          {MOCK_COLLECTIONS.map((collection) => (
            <CollectionCard
              key={collection.href}
              href={collection.href}
              name={collection.name}
              promise={collection.promise}
              image={collection.image}
              imageAlt={collection.alt}
            />
          ))}
        </div>
      </LabSection>

      <LabSection index={3} title="Catalog product card — full &amp; compact">
        <p className="mb-4 text-14 text-graphite">
          The variant is decided per GRID, not per card (`shelfVariant`) — shown
          here explicitly for review.
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {MOCK_PRODUCTS.map((item, i) => (
            <CatalogProductCard key={item.id} item={item} priority={i === 0} />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {MOCK_PRODUCTS.map((item) => (
            <CatalogProductCard
              key={`compact-${item.id}`}
              item={item}
              variant="compact"
            />
          ))}
        </div>
      </LabSection>

      <LabSection index={4} title="Testimonial card">
        <div className="grid gap-6 md:grid-cols-2">
          {MOCK_TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.quote} {...testimonial} />
          ))}
        </div>
      </LabSection>
    </div>
  );
}
