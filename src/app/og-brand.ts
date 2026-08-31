import { SITE } from "@/lib/constants";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * The two pieces of brand every share card prints: the wordmark and the
 * domain under it.
 *
 * Both used to be literals in each of the four `opengraph-image.tsx` files —
 * `Rivya Living Art` and `store.bhavyagondaliya.co.in`, written out four times. The
 * name is owner-editable in Settings and the domain follows
 * `NEXT_PUBLIC_SITE_URL`, so a rebrand or a domain move left four sharing
 * cards quietly wrong, in the one place nobody looks: other people's chats.
 *
 * The domain is DERIVED rather than stored. There is no setting for it —
 * the site is served from wherever it is served from, and a field an owner
 * could set to something the site is not reachable at would be worse than no
 * field.
 */
export type OgBrand = { name: string; tagline: string; domain: string };

function domainOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // A malformed NEXT_PUBLIC_SITE_URL must not take the share card down; it
    // is a decorative line under the wordmark.
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export async function ogBrand(): Promise<OgBrand> {
  const { brandName, tagline } = await getSiteSettings();
  return {
    name: brandName,
    tagline: tagline || SITE.tagline,
    domain: domainOf(SITE.url),
  };
}

/**
 * The wordmark size for a name of a given length.
 *
 * The card was drawn around "Rivya Living Art" at 148px. The moment the name became
 * the owner's to choose, a longer one wrapped and ran straight through the
 * tagline underneath — a broken share card is worse than a stale one, and it
 * is invisible from inside the studio. Stepping the size down keeps a long
 * name on one line, and the wrap guard below catches anything longer still.
 */
export function wordmarkSize(name: string): number {
  const n = name.trim().length;
  if (n <= 12) return 148;
  if (n <= 18) return 112;
  if (n <= 26) return 84;
  return 64;
}
