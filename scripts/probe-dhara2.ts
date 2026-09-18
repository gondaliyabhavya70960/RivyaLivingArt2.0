/* Scratch — delete before committing. */
import { looksLikeListing, publishedPrices, extractSpecs, metaContent } from "@/lib/scraper/adapters/markup";
import { quotePhraseIn } from "@/lib/scraper/adapters/quote-studio";
import { SCRAPER_UA } from "@/lib/scraper/types";

const U = "https://dharaartcreation.com/products/resin-green-pooja-plate";

async function main() {
  const res = await fetch(U, { headers: { "User-Agent": SCRAPER_UA }, signal: AbortSignal.timeout(25_000) });
  const html = await res.text();
  console.log("bytes:", html.length);
  console.log("looksLikeListing:", looksLikeListing(html));
  console.log("publishedPrices:", JSON.stringify(publishedPrices(html)));
  console.log("specs:", JSON.stringify(extractSpecs(html)));
  console.log("quotePhraseIn:", quotePhraseIn(html));
  console.log("og:type:", metaContent(html, ["og:type"]));
  console.log("og:title:", metaContent(html, ["og:title"]));
  console.log("product:price:amount:", metaContent(html, ["product:price:amount"]));
  console.log("itemtype Product:", /itemtype=["'][^"']*schema\.org\/Product/i.test(html));
  console.log("itemprop price:", /itemprop=["']price["']/i.test(html));
  console.log("data-product_id:", /\bdata-product_(id|variants)\s*=/i.test(html));
  const rupee = html.match(/.{60}₹.{60}/g)?.slice(0, 6);
  console.log("\nrupee contexts:\n" + (rupee ?? []).join("\n---\n"));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
