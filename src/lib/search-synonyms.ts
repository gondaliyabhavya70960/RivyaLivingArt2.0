/**
 * Search synonym vocabulary (product-ux benchmark gap 7): the audience types
 * buyer language ("epoxy", "geode", "PLA") where the catalog speaks studio
 * language ("resin", "agate", "filament"). Each query term is expanded with
 * its synonym set before matching, so both vocabularies hit the same shelf.
 * Deliberately small and hand-curated — every pair is real vocabulary from
 * the catalog, never a guess that could surface wrong products.
 */
const SYNONYMS: Record<string, string[]> = {
  epoxy: ["resin"],
  resin: ["epoxy"],
  geode: ["agate"],
  agate: ["geode"],
  lithophane: ["lamp"],
  pla: ["filament"],
  filament: ["pla"],
  keyring: ["keychain"],
  keychain: ["keyring"],
  garland: ["varmala"],
  varmala: ["garland"],
  photoframe: ["photo frame"],
  "3d": ["print"],
};

/**
 * The query plus every synonym any of its words carries, deduped. "geode
 * tray" → ["geode tray", "agate"]: the full phrase stays the primary match,
 * synonyms widen the net.
 */
export function expandQueryTerms(query: string): string[] {
  const q = query.trim();
  const terms = new Set<string>([q]);
  for (const word of q.toLowerCase().split(/\s+/)) {
    for (const synonym of SYNONYMS[word] ?? []) terms.add(synonym);
  }
  return [...terms].filter(Boolean);
}
