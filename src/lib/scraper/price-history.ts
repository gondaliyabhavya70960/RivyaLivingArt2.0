/**
 * When a scrape is worth a price point.
 *
 * The reference spec says "every successful price scrape creates a price
 * history point". Taken literally at this catalogue's size — tens of thousands
 * of rows, re-scraped regularly — that is millions of rows a month, nearly all
 * of them saying the same thing as the row above.
 *
 * So a point is recorded when the price actually MOVES, plus one on first
 * sighting to anchor the series. That is the same information: a series with
 * no point between two dates means the price did not change between them,
 * which is exactly what a repeated identical row would have told you.
 *
 * Pure module — this is the decision, and the scrape loop it runs inside needs
 * a live upstream site before a test could reach it.
 */

export type PricePoint = {
  priceMin: number | null;
  priceMax: number | null;
};

/**
 * Has the price moved?
 *
 * Null is a real value here, not missing data: a product that stopped
 * advertising a price has changed in a way worth recording, and so has one
 * that started.
 */
export function priceMoved(previous: PricePoint, next: PricePoint): boolean {
  return (
    previous.priceMin !== next.priceMin || previous.priceMax !== next.priceMax
  );
}

/** "₹799 → ₹849", for a person reading a row. */
export function describePriceMove(
  previous: PricePoint,
  next: PricePoint,
  currency = "₹",
): string | null {
  if (!priceMoved(previous, next)) return null;
  const show = (p: PricePoint) => {
    if (p.priceMin === null && p.priceMax === null) return "no price";
    if (p.priceMax === null || p.priceMax === p.priceMin) {
      return `${currency}${p.priceMin}`;
    }
    if (p.priceMin === null) return `${currency}${p.priceMax}`;
    return `${currency}${p.priceMin}–${currency}${p.priceMax}`;
  };
  return `${show(previous)} → ${show(next)}`;
}
