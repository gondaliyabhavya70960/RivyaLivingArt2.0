/**
 * The starter fixture files, loaded the way the Content Lab loads its own:
 * `import` rather than `fs.readFileSync`, so the JSON travels with whatever
 * bundle this module ends up in. A readFileSync of a computed path is
 * invisible to Vercel's tracing — the catalog-fill screen read nothing at all
 * on every environment for exactly that reason (CLAUDE.md, 2026-09-17), and
 * this module has to work from a Server Action as well as from `tsx`.
 *
 * The casts are the same shape the demo loader uses: the JSON is authored in
 * this repository and reviewed in the pull request that adds it, so the file
 * is the schema. What it is NOT allowed to do is disagree with the database,
 * which is why `starter.test.ts` reads these files and asserts their shape.
 */

import faqsJson from "../../../prisma/fixtures/starter/faqs.json";
import conceptsJson from "../../../prisma/fixtures/starter/concepts.json";
import researchJson from "../../../prisma/fixtures/starter/research.json";

import type {
  StarterConcept,
  StarterFaq,
  StarterFixtures,
  StarterResearch,
} from "@/lib/starter/apply";

export function loadStarterFixtures(): StarterFixtures {
  return {
    faqs: faqsJson as unknown as StarterFaq[],
    concepts: conceptsJson as unknown as StarterConcept[],
    research: researchJson as unknown as StarterResearch[],
  };
}
