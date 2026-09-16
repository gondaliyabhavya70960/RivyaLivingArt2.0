/**
 * Shared pure-HTML helpers for the markup-shape adapters (B5). No DOM, no
 * network, no new dependencies — the same regex discipline the platform
 * adapters already use. Everything here takes a page's HTML string and gives
 * back values; deciding WHICH page to fetch is the engine's job.
 *
 * Gates referenced below are from docs/adapter-acceptance-checklist.md.
 */

/** Decode the entities upstream markup puts inside attribute values. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/gi, "&");
}

/** All attributes of one tag as a lower-cased-name → value map. */
function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const name = m[1]?.toLowerCase();
    if (!name) continue;
    out[name] = decodeEntities(m[2] ?? m[3] ?? "");
  }
  return out;
}

/**
 * First `<meta>` content for any of the given property/name keys
 * ("og:title", "product:price:amount", …). Attribute order is irrelevant —
 * content frequently precedes property in the wild.
 */
export function metaContent(html: string, keys: string[]): string | null {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attrsOf(m[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (wanted.has(key) && attrs.content) return attrs.content.trim();
  }
  return null;
}

/** First `itemprop` value — content attribute first, then element text. */
export function itempropValue(html: string, prop: string): string | null {
  const re = new RegExp(
    `<([a-z0-9]+)\\b[^>]*itemprop=["']${prop}["'][^>]*>`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return null;
  const attrs = attrsOf(m[0]);
  if (attrs.content) return attrs.content.trim();
  if (attrs.src) return attrs.src.trim();
  // Element-text form: <span itemprop="price">₹1,499</span>
  const close = new RegExp(`</${m[1]}\\s*>`, "i");
  const rest = html.slice(m.index + m[0].length);
  const end = close.exec(rest);
  if (!end) return null;
  const text = rest
    .slice(0, end.index)
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim() || null;
}

/** Inner text of the first tag matching `re`, stripped to plain text. */
export function firstTagText(
  html: string,
  re: RegExp,
): string | null {
  const m = re.exec(html);
  if (!m || m[1] === undefined) return null;
  const text = decodeEntities(m[1].replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "₹": "INR",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

/**
 * Every parseable price in one text run, major units. Handles "₹1,499",
 * "Rs. 2400.00", "INR 850", "$99", and ranges ("₹2,400 – ₹4,800" → both).
 * Returns [] when nothing parses — never zero (gate B1).
 */
export function pricesInText(
  text: string,
): { amount: number; currency?: string }[] {
  const out: { amount: number; currency?: string }[] = [];
  const re =
    /(₹|rs\.?|inr|\$|€|£)\s*([\d][\d,]*(?:\.\d{1,2})?)|([\d][\d,]*(?:\.\d{1,2})?)\s*(₹|rs\.?|inr|\$|€|£)/gi;
  for (const m of text.matchAll(re)) {
    const symbol = (m[1] ?? m[4] ?? "").toLowerCase();
    const raw = (m[2] ?? m[3] ?? "").replace(/,/g, "");
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount)) continue;
    const currency = /^rs\.?$|^inr$/.test(symbol)
      ? "INR"
      : CURRENCY_BY_SYMBOL[symbol];
    out.push({ amount, ...(currency ? { currency } : {}) });
  }
  return out;
}

/**
 * The prices a page PUBLISHES, structured sources first:
 * itemprop="price", product:price:amount, data-price, then elements whose
 * class/id says "price". Visible-text fallback only fires inside an element
 * that declares itself a price — gate D2: price text elsewhere never counts.
 */
export function publishedPrices(
  html: string,
): { amount: number; currency?: string }[] {
  const out: { amount: number; currency?: string }[] = [];

  const structured = [
    itempropValue(html, "price"),
    metaContent(html, ["product:price:amount", "og:price:amount"]),
  ];
  const dataPrice = /\bdata-price=["']([^"']+)["']/i.exec(html);
  if (dataPrice) structured.push(decodeEntities(dataPrice[1]));
  for (const raw of structured) {
    if (!raw) continue;
    const n = Number.parseFloat(raw.replace(/,/g, ""));
    if (Number.isFinite(n)) out.push({ amount: n });
  }

  for (const m of html.matchAll(
    /<([a-z0-9]+)\b(?=[^>]*(?:class|id)=["'][^"']*\bprice\b)[^>]*>([\s\S]*?)<\/\1>/gi,
  )) {
    out.push(...pricesInText(m[2] ?? ""));
  }
  return out;
}

/**
 * The text AROUND the published price — the elements that declare themselves
 * prices, stripped. "₹2,400 – ₹4,800 per sq ft" and "Price on request" both
 * live here, and this is the text `derivePriceBasis` needs to see for
 * PER_AREA / STARTING_FROM / QUOTE_ONLY (gates B2/B3). Empty when no price
 * block exists.
 */
export function priceContextText(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(
    /<([a-z0-9]+)\b(?=[^>]*(?:class|id)=["'][^"']*\bprice\b)[^>]*>([\s\S]*?)<\/\1>/gi,
  )) {
    const text = decodeEntities((m[2] ?? "").replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (text) parts.push(text);
  }
  return [...new Set(parts)].join(" — ");
}

/** Currency the page declares, structured first; undefined when silent. */
export function declaredCurrency(html: string): string | undefined {
  const explicit =
    itempropValue(html, "priceCurrency") ??
    metaContent(html, ["product:price:currency", "og:price:currency"]);
  if (explicit && /^[A-Za-z]{3}$/.test(explicit.trim())) {
    return explicit.trim().toUpperCase();
  }
  for (const p of publishedPrices(html)) {
    if (p.currency) return p.currency;
  }
  return undefined;
}

/** A WooCommerce-style `data-product_variants` JSON blob, if present. */
export function variantBlob(html: string): unknown[] {
  const m = /\bdata-product_variants\s*=\s*("([^"]*)"|'([^']*)')/i.exec(html);
  const raw = m?.[2] ?? m?.[3];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeEntities(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** A page with several product identities is a listing — gate D3. */
export function looksLikeListing(html: string): boolean {
  const ids = html.match(/\bdata-product_id\s*=/gi) ?? [];
  const cards = html.match(/<a\b[^>]*class=["'][^"']*\bproduct\b/gi) ?? [];
  return new Set([...ids]).size >= 3 || cards.length >= 3;
}

/**
 * Images the page offers for the piece: og:image, itemprop="image", and
 * imgs whose own class declares them product/gallery imagery. Absolutized
 * against the page URL, de-duplicated in order, data: URIs skipped.
 */
export function collectImages(
  html: string,
  pageUrl: string,
): { srcs: string[]; alts: string[] } {
  const srcs: string[] = [];
  const alts: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined, alt = "") => {
    if (!raw || raw.startsWith("data:")) return;
    try {
      const abs = new URL(raw, pageUrl).toString();
      if (seen.has(abs)) return;
      seen.add(abs);
      srcs.push(abs);
      alts.push(alt);
    } catch {
      // malformed src — skip
    }
  };
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attrsOf(m[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key === "og:image" || key === "og:image:url") push(attrs.content);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = attrsOf(m[0]);
    const marker = `${attrs.class ?? ""} ${attrs.id ?? ""}`;
    const isProductImg =
      /\b(product|gallery|thumb|piece|artwork)\b/i.test(marker) ||
      attrs.src === itempropValue(html, "image");
    if (isProductImg) push(attrs.src ?? attrs["data-src"], attrs.alt ?? "");
  }
  const itempropImg = itempropValue(html, "image");
  if (itempropImg) push(itempropImg);
  return { srcs, alts };
}

const SPEC_LABELS: Record<string, string> = {
  dimensions: "dimensions",
  dimension: "dimensions",
  size: "dimensions",
  materials: "materials",
  material: "materials",
  finish: "finish",
  "lead time": "leadTime",
  leadtime: "leadTime",
  weight: "weight",
  colour: "colour",
  color: "colour",
  wood: "wood",
  resin: "resin",
  care: "care",
};

/**
 * Spec lists an atelier page publishes — <dl>/<dt>+<dd> pairs and table
 * th/td rows — keyed by canonical label. Only known labels are read; an
 * unknown label is source text we have no slot for, not a fact to guess at.
 */
export function extractSpecs(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const record = (label: string, value: string) => {
    const key = SPEC_LABELS[label.trim().toLowerCase().replace(/:$/, "")];
    const clean = decodeEntities(value.replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (key && clean && !out[key]) out[key] = clean;
  };
  for (const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
    record(m[1] ?? "", m[2] ?? "");
  }
  for (const m of html.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
    record(m[1] ?? "", m[2] ?? "");
  }
  return out;
}

/** Last path segment of a URL — the slug a site puts in its own links. */
export function pathnameSlug(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  } catch {
    return "";
  }
}
