import type { Metadata } from "next";
import { db } from "@/lib/db";
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
      {/* No "New page" action, deliberately. A Page row only reaches a
          visitor if a route reads it, and exactly two do — `(v2)/privacy`
          and `(v2)/terms`, each hardcoding its own slug. A page created here
          would 404, and `KNOWN_ROUTES` would not let the navigation editor
          link it either, so the button offered content nobody could reach.
          Standalone pages are a real feature (a catch-all renderer, metadata,
          the slug joining KNOWN_ROUTES and the sitemap) and are worth
          building deliberately rather than half-having; owner decision,
          2026-09-04. `upsertPage` refuses a create for the same reason. */}
      <PageHeader
        title="Pages"
        description="The two policy pages the footer links to. Their wording, SEO and translations are editable here; their URLs are fixed."
      />
      <PageList pages={rows} />
    </div>
  );
}
