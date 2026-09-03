import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import { TestimonialForm } from "@/components/studio/testimonials/testimonial-form";

export const metadata: Metadata = { title: "Add testimonial" };

export default function NewTestimonialPage() {
  return (
    <div>
      <PageHeader
        title="Add testimonial"
        description="New testimonials start as drafts. Publishing needs the customer's permission recorded as Granted."
      />
      <TestimonialForm />
    </div>
  );
}
