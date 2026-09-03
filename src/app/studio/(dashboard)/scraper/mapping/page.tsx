import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/studio/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Source → category mapping" };
export const dynamic = "force-dynamic";

type MappingRow = {
  importSource: string;
  categoryName: string;
  categorySlug: string;
  count: bigint;
};

/**
 * Source→canonical mapping report (FINDINGS open-queue item): for every
 * import source, where its products actually landed across the canonical
 * categories. The keyword matcher (src/lib/scraper/category-map.ts) is
 * best-effort — this is the review surface that makes a mis-mapped cluster
 * visible (one source dumping 300 rows into "Home Decor" is a mapping bug,
 * not a merchandising fact). Each row deep-links the filtered product list
 * so fixing is one click away.
 */
export default async function MappingReportPage() {
  const rows = await db.$queryRaw<MappingRow[]>`
    SELECT p."importSource" AS "importSource",
           c."name" AS "categoryName",
           c."slug" AS "categorySlug",
           count(*)::bigint AS "count"
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."importSource" IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY 1 ASC, count(*) DESC
  `;

  const bySource = new Map<
    string,
    {
      total: number;
      categories: { name: string; slug: string; count: number }[];
    }
  >();
  for (const row of rows) {
    const entry = bySource.get(row.importSource) ?? {
      total: 0,
      categories: [],
    };
    const count = Number(row.count);
    entry.total += count;
    entry.categories.push({
      name: row.categoryName,
      slug: row.categorySlug,
      count,
    });
    bySource.set(row.importSource, entry);
  }

  return (
    <>
      <PageHeader
        title="Source → category mapping"
        description="Where each import source's products landed across the canonical categories — the review surface for the keyword matcher's best-effort mapping."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/scraper">
              <ArrowLeft /> Scraper
            </Link>
          </Button>
        }
      />

      <div className="space-y-6">
        {[...bySource.entries()].map(([source, entry]) => (
          <section
            key={source}
            className="rounded-card border border-border bg-card p-5 shadow-e1"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium text-foreground">{source}</h2>
              <p className="text-sm tabular-nums text-muted-foreground">
                {entry.total.toLocaleString("en-IN")} products ·{" "}
                {entry.categories.length}{" "}
                {entry.categories.length === 1 ? "category" : "categories"}
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {entry.categories.map((category) => (
                <li
                  key={category.slug}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-16 shrink-0 text-end tabular-nums text-muted-foreground">
                    {category.count.toLocaleString("en-IN")}
                  </span>
                  {/* Proportion bar — plain CSS, same idiom as analytics. */}
                  <span
                    aria-hidden
                    className="h-2 rounded-full bg-primary/70"
                    style={{
                      width: `${Math.max(2, Math.round((category.count / entry.total) * 100))}%`,
                    }}
                  />
                  <span className="min-w-0 truncate text-foreground">
                    {category.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {bySource.size === 0 && (
          <p className="text-sm text-muted-foreground">
            No imported products yet — run the sheet import or approve scraped
            products first.
          </p>
        )}
      </div>
    </>
  );
}
