import Link from "next/link";
import { Star } from "lucide-react";

export type TopProductRow = {
  id: string;
  title: string;
  count: number;
};

/**
 * C1/C3 "top products by inquiries" list. The #1 row carries THE studio's
 * single gold accent (Part C): a bronze star — gold-as-text on a light
 * surface must be bronze ink per A2 rule 3. Everything interactive stays
 * royal blue via the semantic hover/ring tokens.
 */
export function TopProductsCard({ products }: { products: TopProductRow[] }) {
  return (
    <section aria-labelledby="top-products-heading" className="min-w-0 rounded-card border border-border bg-card p-5 shadow-e1">
      <h2 id="top-products-heading" className="font-display text-20 leading-tight text-foreground">
        Top products by inquiries
      </h2>
      <p className="u-micro mt-1">ALL-TIME · FROM SAVED WHATSAPP ORDERS</p>
      {products.length === 0 ? (
        <p className="mt-4 text-small leading-relaxed text-graphite">
          No product inquiries yet — they appear here once customers start
          placing orders.
        </p>
      ) : (
        <ul className="mt-3">
          {products.map((product, index) => (
            <li key={product.id}>
              <Link
                href={`/studio/products/${product.id}`}
                className="-mx-2 flex min-h-11 items-center gap-3 rounded-input px-2 py-1.5 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              >
                {index === 0 ? (
                  <>
                    <Star
                      aria-hidden
                      className="size-4 shrink-0 fill-current text-champagne-ink"
                    />
                    <span className="sr-only">Top product: </span>
                  </>
                ) : (
                  <span
                    aria-hidden
                    className="u-num w-4 shrink-0 text-center text-12 text-graphite"
                  >
                    {index + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
                  {product.title}
                </span>
                <span className="u-num shrink-0 text-small text-graphite">
                  {product.count.toLocaleString("en-IN")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
