/**
 * Adapter registry (server-only). `fingerprint()` decides the platform;
 * `getAdapter()` returns the matching page-fetcher. All adapters speak
 * `Adapter = (ctx) => Promise<AdapterPage>` from @/lib/scraper/types.
 */
import type { Adapter } from "@/lib/scraper/types";
import { shopifyAdapter } from "@/lib/scraper/adapters/shopify";
import { wooAdapter } from "@/lib/scraper/adapters/woocommerce";
import { jsonldAdapter } from "@/lib/scraper/adapters/jsonld";

export { stripHtml } from "@/lib/scraper/adapters/strip-html";
export { shopifyAdapter } from "@/lib/scraper/adapters/shopify";
export { wooAdapter } from "@/lib/scraper/adapters/woocommerce";
export { jsonldAdapter } from "@/lib/scraper/adapters/jsonld";

// B5 markup-shape extraction — the fallback inside the JSON-LD fetch path
// for pages with no schema.org Product node. Pure mappers, fixture-tested;
// see docs/adapter-acceptance-checklist.md.
export {
  detectMarkupShape,
  mapPageByShape,
  type MarkupShape,
} from "@/lib/scraper/adapters/markup-shape";
export { mapPricedStorePage } from "@/lib/scraper/adapters/priced-store";
export { mapQuoteStudioPage } from "@/lib/scraper/adapters/quote-studio";

export type AdapterPlatform = "SHOPIFY" | "WOOCOMMERCE" | "JSONLD";

export function getAdapter(platform: AdapterPlatform): Adapter {
  switch (platform) {
    case "SHOPIFY":
      return shopifyAdapter;
    case "WOOCOMMERCE":
      return wooAdapter;
    case "JSONLD":
      return jsonldAdapter;
  }
}
