import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import {
  NewTestimonialButton,
  TestimonialList,
  type TestimonialRow,
} from "@/components/studio/testimonials/testimonial-list";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  const testimonials = await db.testimonial.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const rows: TestimonialRow[] = testimonials.map((testimonial) => ({
    id: testimonial.id,
    name: testimonial.name,
    location: testimonial.location,
    quote: testimonial.quote,
    rating: testimonial.rating,
    avatarUrl: testimonial.avatarUrl,
    order: testimonial.order,
    translations: testimonial.translations,
  }));

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Customer quotes shown on the storefront — reorder to control which appear first."
        actions={<NewTestimonialButton />}
      />
      <TestimonialList testimonials={rows} />
    </>
  );
}
