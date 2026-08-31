import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import { isLegalPageSlug } from "@/components/studio/pages/legal";
import {
  PageList,
  type PageRow,
} from "@/components/studio/pages/page-list";

export const metadata: Metadata = { title: "Pages" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function PagesPage() {
  const pages = await db.page.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, slug: true, updatedAt: true },
  });

  const rows: PageRow[] = pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    updatedAt: dateFormatter.format(page.updatedAt),
    legal: isLegalPageSlug(page.slug),
  }));

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Standalone site pages — About, policies and anything else the storefront links to."
        actions={
          <Button asChild>
            <Link href="/studio/pages/new">
              <Plus /> New page
            </Link>
          </Button>
        }
      />
      <PageList pages={rows} />
    </div>
  );
}
