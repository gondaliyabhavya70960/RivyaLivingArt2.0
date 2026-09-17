import type { Metadata } from "next";
import { Download, FileSpreadsheet } from "lucide-react";

import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { IMPORT_LIST_NAME, IMPORT_LISTS } from "@/lib/import-list";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NUMBER,
  SIZE_TIER_SHORT,
} from "@/lib/product-size-tier";
import { PageHeader } from "@/components/studio/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Exports" };

/**
 * The confirmed export carries TWO columns called "tier", and the screen says
 * which is which in the owner's words. Both cells are written exactly as the
 * file writes them — `product_tier` is the enum name, `tier` the list number
 * — and the words beside them come from the two vocabularies, never typed
 * here: `src/lib/product-size-tier.ts` for the product tier and
 * `src/lib/import-list.ts` for the import list. The headers themselves are a
 * contract (`CONFIRMED_EXPORT_COLUMNS` is append-only) and do not change.
 */

/** "LARGE_FORMAT = Tier 1 Collectible · MEDIUM_FORMAT = Tier 2 Memory · …" */
const PRODUCT_TIER_CELLS = PRODUCT_SIZE_TIERS.map(
  (tier) => `${tier} = Tier ${SIZE_TIER_NUMBER[tier]} ${SIZE_TIER_SHORT[tier]}`,
).join(" · ");

/** "1 = Owner's store · 2 = Resin goods · 3 = Supplies · 4 = 3D printing" */
const IMPORT_LIST_CELLS = IMPORT_LISTS.map(
  (list) => `${list} = ${IMPORT_LIST_NAME[list]}`,
).join(" · ");

/**
 * The Export Centre — where the owner gets their data out.
 *
 * This screen exists because the confirmed list used to live in a Google
 * Sheet. That made a third-party spreadsheet the owner's view of their own
 * final list, and it is the capability that has to be replaced BEFORE the
 * Sheets integration can be removed (docs/plan/03-sheets-removal.md §5) —
 * never after, or there is a window with no export path at all.
 *
 * It gathers the exports that already existed but were scattered across the
 * screens that happened to own them, so "get me the data" is one destination
 * rather than a memory game.
 *
 * Counts are live. An export whose count is zero says so on the button rather
 * than handing over a file with a header row and nothing under it.
 */
export default async function ExportsPage() {
  const session = await requireStaffPage();
  const isAdmin = session.user.role === "ADMIN";

  const [confirmedCount, subscriberCount, scrapedCount] = await Promise.all([
    db.product.count({ where: { confirmedAt: { not: null } } }),
    db.subscriber.count(),
    // Only ADMIN can download this one, so only ADMIN pays for the count.
    isAdmin ? db.scrapedProduct.count() : Promise.resolve(0),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Exports"
        description="Download your data as a file. Exports are a snapshot, not a connection — nothing here syncs back, and editing a downloaded file never changes the catalogue."
      />

      <div className="divide-y divide-border border-y border-border">
        <ExportRow
          title="Confirmed products"
          count={confirmedCount}
          noun="confirmed product"
          description="Exactly the products someone explicitly confirmed — not everything scraped, not everything in the studio. Quote-only pieces export an empty price, never a zero. Two of its columns are both called tier; they are different things."
          columns={[
            {
              key: "product_tier",
              meaning: `the product tier — what the piece is: ${PRODUCT_TIER_CELLS}. Blank until someone files it.`,
            },
            {
              key: "tier",
              meaning: `the import list — where the row came from: ${IMPORT_LIST_CELLS}. Blank for a product made in the studio.`,
            },
          ]}
          links={[
            { href: "/api/studio/export/confirmed", label: "CSV" },
            {
              href: "/api/studio/export/confirmed?format=xlsx",
              label: "Excel",
              primary: true,
            },
          ]}
        />

        <ExportRow
          title="Subscribers"
          count={subscriberCount}
          noun="subscriber"
          description="Email addresses captured by the newsletter and launching-soon forms."
          links={[{ href: "/api/subscribers/export", label: "CSV" }]}
        />

        {isAdmin && (
          <ExportRow
            title="Scraped products"
            count={scrapedCount}
            noun="staged row"
            description="The full research corpus in ScrapeDeck column order. Administrators only, and capped at 5,000 rows — a working file, not a database dump."
            links={[{ href: "/api/scraper/export?all=1", label: "CSV" }]}
          />
        )}
      </div>
    </div>
  );
}

/**
 * One export. Rendered as a hairline-separated row rather than a card: the
 * storefront's "surfaces, not boxes" rule holds in the Studio too, and three
 * bordered cards in a column is the look this design system exists to avoid.
 */
function ExportRow({
  title,
  count,
  noun,
  description,
  columns,
  links,
}: {
  title: string;
  count: number;
  /** Singular. Pluralised below, because "1 subscribers" reads as a bug. */
  noun: string;
  description: string;
  /**
   * Columns worth a sentence each — the header exactly as the file writes
   * it, then what the cell means. Only for a file whose headers can be
   * misread; a subscriber list needs no glossary.
   */
  columns?: { key: string; meaning: string }[];
  links: { href: string; label: string; primary?: boolean }[];
}) {
  const empty = count === 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 py-6">
      <div className="min-w-0 flex-1 basis-80">
        <div className="flex items-baseline gap-3">
          <h2 className="text-body font-medium text-foreground">{title}</h2>
          <span className="u-num text-small text-graphite">
            {count.toLocaleString("en-IN")}
          </span>
          <span className="u-micro">
            {noun}
            {count === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-2 max-w-[62ch] text-small leading-relaxed text-graphite">
          {description}
        </p>
        {columns && (
          <dl className="mt-3 max-w-[62ch] space-y-1.5 text-small leading-relaxed text-graphite">
            {columns.map((column) => (
              <div key={column.key} className="flex flex-wrap gap-x-2">
                {/* The header is a code, not a word — mono, like every other
                    identifier the Studio prints. */}
                <dt className="font-mono text-foreground">{column.key}</dt>
                <dd className="min-w-0 flex-1 basis-60">{column.meaning}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {empty ? (
          // Disabled plus a stated reason — REDESIGN.md §9. A greyed button
          // with no explanation sends the owner looking for the broken thing.
          <p className="text-small text-graphite">Nothing to export yet</p>
        ) : (
          links.map((link) => (
            <Button
              key={link.href}
              asChild
              variant={link.primary ? "default" : "outline"}
              size="sm"
            >
              {/* A file download, not a page — next/link would hijack it with
                  a client navigation and the browser would never save it. */}
              <a href={link.href}>
                {link.label === "Excel" ? <FileSpreadsheet /> : <Download />}
                {link.label}
              </a>
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
