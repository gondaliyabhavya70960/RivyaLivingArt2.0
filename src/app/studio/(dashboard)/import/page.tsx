import type { Metadata } from "next";

import { ImportWizard } from "@/components/studio/import/import-wizard";
import { PageHeader } from "@/components/studio/page-header";

export const metadata: Metadata = { title: "Bulk Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Bulk Import"
        description="Bring in products, posts and site content from a Google Sheet or a CSV/XLSX file — rows are validated before anything is written."
      />
      <ImportWizard />
    </>
  );
}
