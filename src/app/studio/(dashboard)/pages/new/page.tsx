import type { Metadata } from "next";

import { PageHeader } from "@/components/studio/page-header";
import { PageForm } from "@/components/studio/pages/page-form";

export const metadata: Metadata = { title: "New page" };

export default function NewPagePage() {
  return (
    <div>
      <PageHeader
        title="New page"
        description="The slug is minted on save and never changes afterwards."
      />
      <PageForm />
    </div>
  );
}
