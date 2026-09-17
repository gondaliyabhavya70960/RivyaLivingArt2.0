import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "lucide-react";

import { ImportWizard } from "@/components/studio/import/import-wizard";
import { PageHeader } from "@/components/studio/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Bulk Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Bulk Import"
        description="Bring in products, posts and site content from a Google Sheet or a CSV/XLSX file — rows are validated before anything is written."
        actions={
          /* The cross-link plan §3 S8 asks for. These two screens sit next to
             each other in the sidebar and read as alternatives, but they are
             opposite jobs: this one is a file an operator hands over, once;
             Catalog fill is a pipeline that runs itself from the committed
             CSVs on every deploy. An operator who came here to "load the
             catalogue" wants the other screen, and until now nothing said so.
             Same `Workflow` glyph the sidebar now gives it, so the two places
             that name it agree. */
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href="/studio/catalog-fill">
              <Workflow />
              Looking for the automatic fill?
            </Link>
          </Button>
        }
      />
      <ImportWizard />
    </>
  );
}
