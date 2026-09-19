/**
 * Is this portfolio row a CONCEPT STUDY rather than a delivered commission?
 *
 * The distinction is not cosmetic. The portfolio is the page where a visitor
 * decides whether this studio has actually made things like the thing they
 * want, and a speculative design study sitting unlabelled among real
 * commissions is a claim about client work that never happened. The owner's
 * standing rule is explicit about it: concept studies must be labelled
 * clearly, and generated concept imagery must never imply genuine customer
 * work.
 *
 * It rides in `Portfolio.resultsMeta` — an existing `Json` column — rather
 * than a new one, because adding a column here would be a migration, and a
 * migration on this repository reaches the production database on push
 * (CLAUDE.md). A presentation-layer fact stored in a Json column that already
 * exists costs nothing and cannot break a deployed client.
 *
 * Total by construction: anything that is not explicitly marked is treated as
 * a genuine commission, which is how every row that predates this function
 * behaves. The failure direction matters — an unmarked concept study is a
 * false claim, an unmarked commission is just a commission — so the marker is
 * required to be present and exact rather than inferred from a slug prefix or
 * a missing photograph.
 */

export const CONCEPT_STUDY_KIND = "concept-study";

export function isConceptStudy(resultsMeta: unknown): boolean {
  if (typeof resultsMeta !== "object" || resultsMeta === null) return false;
  // An array is an object to `typeof`, and indexing one by "kind" yields
  // undefined rather than throwing — harmless, but excluded explicitly so the
  // intent is readable.
  if (Array.isArray(resultsMeta)) return false;
  const kind = (resultsMeta as Record<string, unknown>).kind;
  return kind === CONCEPT_STUDY_KIND;
}
