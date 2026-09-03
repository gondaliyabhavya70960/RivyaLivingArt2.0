import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/studio/page-header";
import {
  TestimonialForm,
  type TestimonialFormInitial,
} from "@/components/studio/testimonials/testimonial-form";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit testimonial" };

/** yyyy-mm-dd for `<input type="date">`; empty means unset — same convention
 *  as `site-settings-values.ts`'s `dateInput`. */
function dateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditTestimonialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const testimonial = await db.testimonial.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, title: true } },
      portfolio: { select: { id: true, title: true } },
    },
  });
  if (!testimonial) notFound();

  const initial: TestimonialFormInitial = {
    id: testimonial.id,
    name: testimonial.name,
    location: testimonial.location,
    quote: testimonial.quote,
    rating: testimonial.rating,
    avatarUrl: testimonial.avatarUrl,
    mediaId: testimonial.mediaId,
    translations: testimonial.translations,
    status: testimonial.status,
    featured: testimonial.featured,
    designation: testimonial.designation,
    category: testimonial.category,
    givenAt: dateInput(testimonial.givenAt),
    language: testimonial.language,
    product: testimonial.product,
    portfolio: testimonial.portfolio,
    productTitle: testimonial.productTitle,
    purchaseType: testimonial.purchaseType,
    installationImageUrl: testimonial.installationImageUrl,
    installationMediaId: testimonial.installationMediaId,
    videoUrl: testimonial.videoUrl,
    videoPosterUrl: testimonial.videoPosterUrl,
    internalNotes: testimonial.internalNotes,
    permissionStatus: testimonial.permissionStatus,
    verifiedAt: testimonial.verifiedAt
      ? testimonial.verifiedAt.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null,
    isDemo: testimonial.isDemo,
  };

  return (
    <div>
      <PageHeader
        title={testimonial.name}
        description="Edit the customer's words — changes go live only when saved."
      />
      <TestimonialForm testimonial={initial} />
    </div>
  );
}
