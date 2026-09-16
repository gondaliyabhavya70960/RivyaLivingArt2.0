import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmedRows } from "@/lib/scraper/shortlist-query";
import { formatPriceMajor } from "@/lib/scraper/confirmed-export";

export const metadata: Metadata = { title: "Confirmed products" };

const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PRICE_BASIS_LABELS: Record<string, string> = {
  PER_PIECE: "per piece",
  PER_AREA: "per area",
  STARTING_FROM: "starting from",
  QUOTE_ONLY: "quote only",
};

/**
 * The gated final list (B7). Every row here got a human's explicit Confirm
 * in the review inbox — nothing arrives from a scrape or a bulk guess. The
 * export buttons hand the owner exactly this table as CSV or XLSX.
 */
export default async function ConfirmedProductsPage() {
  const rows = await confirmedRows();

  return (
    <>
      <PageHeader
        title="Confirmed products"
        description="The gated final list — confirmed by hand in the review inbox, one decision at a time. This is the list the CSV/XLSX export reads."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/review">Review inbox</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/analytics">Analytics</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/scraper/export-confirmed?format=csv" download>
                <Download /> CSV
              </a>
            </Button>
            <Button asChild size="sm">
              <a href="/api/scraper/export-confirmed?format=xlsx" download>
                <Download /> XLSX
              </a>
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing confirmed yet"
          description="Shortlist products in the review inbox, then confirm the ones that make the final list — the export reads this page and nothing else."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium">Reference price</th>
                <th className="px-3 py-2.5 font-medium">Tags</th>
                <th className="px-3 py-2.5 font-medium">Note</th>
                <th className="px-3 py-2.5 font-medium">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const major = formatPriceMajor(
                  row.pick?.row.priceMinor ?? null,
                );
                return (
                  <tr
                    key={row.researchProductId}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- scraped images live on arbitrary hosts; never next/image
                          <img
                            src={row.image}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="size-12 shrink-0 rounded-lg bg-muted object-cover"
                          />
                        ) : (
                          <div
                            aria-hidden
                            className="size-12 shrink-0 rounded-lg bg-muted"
                          />
                        )}
                        <div className="min-w-0">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-xs items-center gap-1 truncate font-medium text-foreground hover:underline"
                          >
                            <span className="truncate">{row.title}</span>
                            <ExternalLink
                              aria-hidden
                              className="size-3 shrink-0"
                            />
                          </a>
                          <p className="text-xs text-muted-foreground">
                            {row.externalId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary">{row.sourceName}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {row.pick ? (
                        <>
                          <p className="tabular-nums text-foreground">
                            {major ? `₹${inr.format(Number(major))}` : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {PRICE_BASIS_LABELS[row.pick.row.priceBasis]}
                            {row.pick.row.label
                              ? ` · ${row.pick.row.label}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground/80">
                            {row.pick.rationale}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          no comparable price
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-40 flex-wrap gap-1">
                        {row.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-52 px-3 py-3">
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {row.note ?? ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <p>
                        {row.confirmedAt
                          ? dateFormatter.format(row.confirmedAt)
                          : "—"}
                      </p>
                      {row.confirmedBy && <p>{row.confirmedBy}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
