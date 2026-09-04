import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/studio/page-header";
import { Button } from "@/components/ui/button";
import {
  TestimonialList,
  type TestimonialRow,
} from "@/components/studio/testimonials/testimonial-list";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Testimonials" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function TestimonialsPage() {
  const testimonials = await db.testimonial.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      product: { select: { title: true } },
      portfolio: { select: { title: true } },
    },
  });

  const rows: TestimonialRow[] = testimonials.map((testimonial) => ({
    id: testimonial.id,
    name: testimonial.name,
    quote: testimonial.quote,
    status: testimonial.status,
    featured: testimonial.featured,
    rating: testimonial.rating,
    order: testimonial.order,
    permissionStatus: testimonial.permissionStatus,
    // A linked product or case study is what a reader recognises the row
    // by; the free-text `productTitle` is the fallback for words about a
    // commission that never became a catalogue product.
    linkedLabel:
      testimonial.product?.title ??
      testimonial.portfolio?.title ??
      testimonial.productTitle,
    isDemo: testimonial.isDemo,
    updatedAt: dateFormatter.format(testimonial.updatedAt),
    updatedAtSort: testimonial.updatedAt.getTime(),
  }));

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Customer quotes shown on the storefront — reorder to control which appear first. Publishing needs the customer's permission recorded as Granted."
        actions={
          <Button asChild size="sm">
            <Link href="/studio/testimonials/new">
              <Plus /> New testimonial
            </Link>
          </Button>
        }
      />
      <TestimonialList testimonials={rows} />
    </>
  );
}
