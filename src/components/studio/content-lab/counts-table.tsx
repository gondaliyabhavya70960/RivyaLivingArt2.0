import type { DemoCounts } from "@/lib/demo/apply";

const LABELS: Record<keyof DemoCounts, string> = {
  BlogCategory: "Journal categories",
  BlogPost: "Journal posts",
  Media: "Media files",
  Product: "Products",
  Portfolio: "Portfolio cases",
  Testimonial: "Testimonials",
  Faq: "FAQs",
  CustomPage: "Landing pages",
  Inquiry: "Inquiries",
  ResearchRecord: "Research records",
  ScrapeJob: "Scrape jobs",
  ImportRun: "Import runs",
};

/** Mono counts per demo-bearing table, in the order `apply.ts` seeds them. */
export function CountsTable({ counts }: { counts: DemoCounts }) {
  const rows = Object.entries(counts) as [keyof DemoCounts, number][];
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-e1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className="px-4 py-2.5 text-start font-medium text-foreground"
            >
              Table
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-end font-medium text-foreground"
            >
              Demo rows
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, count]) => (
            <tr key={key} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-foreground">{LABELS[key]}</td>
              <td className="u-num px-4 py-2.5 text-end text-foreground">
                {count}
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-4 py-2.5 font-medium text-foreground">Total</td>
            <td className="u-num px-4 py-2.5 text-end font-medium text-foreground">
              {total}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
