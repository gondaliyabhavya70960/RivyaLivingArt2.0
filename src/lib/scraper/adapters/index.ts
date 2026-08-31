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
