import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import { SeoForm } from "@/components/studio/settings/seo-form";
import { toSiteSettingsValues } from "@/components/studio/settings/site-settings-values";
import { Role } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "SEO" };

const PER_ENTITY_SEO = [
  {
    label: "Products",
    href: "/studio/products",
    detail: "SEO title, description and OG image on every product form.",
  },
  {
    label: "Blog posts",
    href: "/studio/blog",
    detail: "SEO title and description on every post form.",
  },
  {
    label: "Pages",
    href: "/studio/pages",
    detail: "SEO title and description on every page form.",
  },
] as const;

function PerEntityChecklist() {
  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-e1">
      <h2 className="font-display text-lg text-foreground">Per-item SEO</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Per-item SEO lives on each product, post and page form.
      </p>

      <ul className="mt-5 space-y-4">
        {PER_ENTITY_SEO.map((item) => (
          <li key={item.href} className="flex items-start gap-3">
            <CheckCircle2
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-sapphire-ink"
            />
            <div>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-sapphire-ink"
              >
                {item.label}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SeoPage() {
  // SEO edits SiteSettings — a settings surface, so ADMIN-only (DESIGN.md C).
  await requireStaffPage([Role.ADMIN]);

  const settings = await db.siteSettings.findUnique({
    where: { id: "main" },
  });

  return (
    <div>
      <PageHeader
        title="SEO"
        description="Site-wide fallback metadata for search results and link previews."
      />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SeoForm settings={toSiteSettingsValues(settings)} />
        </div>
        <PerEntityChecklist />
      </div>
    </div>
  );
}
