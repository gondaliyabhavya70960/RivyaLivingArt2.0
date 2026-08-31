/**
 * Split a headline so its FINAL word can carry the one gold flourish a navy
 * band allows (DESIGN.md A2: gold headline flourishes on navy only, and the
 * flourish is decoration, never meaning). Locales whose headline has no
 * space breaks return null and render fully in ivory. Single-sourced here so
 * the one-flourish law can't drift between pages.
 */
export function splitFlourish(
  headline: string,
): { lead: string; flourish: string } | null {
  const trimmed = headline.trim();
  const index = trimmed.lastIndexOf(" ");
  if (index <= 0) return null;
  return {
    lead: trimmed.slice(0, index + 1),
    flourish: trimmed.slice(index + 1),
  };
}
