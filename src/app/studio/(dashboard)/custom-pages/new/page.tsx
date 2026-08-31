import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import { CustomPageForm } from "@/components/studio/custom-pages/custom-page-form";

export const metadata: Metadata = { title: "New landing page" };

export default function NewCustomPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="New landing page"
        description="Name it and save; the blocks come next. The address is minted on save and never changes."
      />
      <CustomPageForm />
    </div>
  );
}
