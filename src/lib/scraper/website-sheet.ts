/**
 * The website mirror: every product that has been added to the site.
 *
 * Distinct from the two product tabs that already exist, and the difference
 * matters:
 *
 *   CONFIRMED_PRODUCTS  — only rows an operator blessed for the final list
 *   Sheet1              — bulk-upload format, the shape the importer reads back
 *   this tab            — what is actually on the website, right now
 *
 * DRAFT products are included, carrying their status. "Added to the website"
 * is not the same as "live on the website", and a mirror that silently omitted
 * everything unpublished would be the more confusing of the two — the owner
 * would look for a product they know they added and not find it.
 */

/** The tab title, exactly as the owner asked for it. */
export const WEBSITE_SHEET_TAB = "Added product in website";

/** Product ID first — the stable reference across every tab in this sheet. */
export const WEBSITE_COLUMNS: readonly string[] = [
  "Product ID",
  "Slug",
  "Title",
  "Category",
  "Status",
  "Price Min",
  "Price Max",
  "Show Price",
  "In Stock",
  "Featured",
  "Primary Image",
  "Images",
  "Confirmed",
  "Source",
  "Added At",
  "Updated At",
];

export type WebsiteProductRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean;
  inStock: boolean;
  featured: boolean;
  confirmedAt: Date | null;
  importSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string } | null;
  images: { url: string }[];
};

/** Booleans read as words in a spreadsheet a human filters by hand. */
const yesNo = (value: boolean) => (value ? "Yes" : "No");

export function websiteProductToRow(p: WebsiteProductRow): string[] {
  return [
    p.id,
    p.slug,
    p.title,
    p.category?.name ?? "",
    p.status,
    p.priceMin === null ? "" : String(p.priceMin),
    p.priceMax === null ? "" : String(p.priceMax),
    yesNo(p.showPrice),
    yesNo(p.inStock),
    yesNo(p.featured),
    p.images[0]?.url ?? "",
    p.images.map((i) => i.url).join(" | "),
    p.confirmedAt ? "Yes" : "No",
    p.importSource ?? "studio",
    p.createdAt.toISOString(),
    p.updatedAt.toISOString(),
  ];
}
