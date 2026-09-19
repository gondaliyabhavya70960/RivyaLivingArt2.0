/**
 * Starter content — genuine Rivya brand content, written for production.
 *
 * This is NOT the Content Lab. The two are deliberately different in every
 * way that matters, and conflating them is the mistake this file exists to
 * prevent:
 *
 *   Content Lab (src/lib/demo)      Starter content (here)
 *   ──────────────────────────      ──────────────────────
 *   isDemo: true                    isDemo: false — it IS the site's content
 *   refuses a production host       production is the POINT
 *   upserts by fixture id           never touches a row that already exists
 *   removable in bulk               removed like any other content, by hand
 *   synthetic, marked, noindex      real editorial copy, indexed, public
 *
 * WHY IT IS STRICTLY ADDITIVE. `prisma/seed.ts` rewrites every FAQ answer it
 * recognises on each run, which is safe exactly once — the moment an owner
 * improves one of those answers in the Studio, the next run silently reverts
 * it. That seeder is also unreachable in practice: `bootstrap.ts` skips the
 * whole base seed when `category.count() > 0`, so on the live database it has
 * not run since the first deploy. Both problems have the same answer. This
 * module CREATES rows that are missing and does nothing at all to rows that
 * exist — no update branch, no "only if unchanged" heuristic, no last-write
 * timestamp comparison. A row that is already there is the owner's, whether
 * they edited it or never touched it, and the report says it was skipped.
 *
 * Dry run is the DEFAULT. `apply: false` does every lookup and returns the
 * exact plan without a single write, because the first thing anyone should be
 * able to do with a content seeder pointed at a live site is ask what it
 * would do.
 *
 * Like the Content Lab applier this takes a `PrismaClient` rather than
 * importing one, so the CLI and the Server Action share the code without
 * sharing a connection.
 */

import type { PrismaClient, Prisma } from "@/generated/prisma/client";

export type StarterFaq = {
  question: string;
  answer: string;
  group: string;
};

export type StarterConceptImage = {
  purpose: string;
  alt: string;
  prompt: string;
  aspectRatio: string;
  filename: string;
};

export type StarterConcept = {
  title: string;
  slug: string;
  brief: string;
  process: string;
  story: string;
  location: string;
  year: number;
  resultsMeta: Record<string, string>;
  images: StarterConceptImage[];
};

export type StarterResearch = {
  source: string;
  url: string;
  title: string;
  category: string;
  materials?: string;
  dimensions?: string;
  price?: string;
  description: string;
  tags: string[];
  notes: string;
};

export type StarterFixtures = {
  faqs: StarterFaq[];
  concepts: StarterConcept[];
  research: StarterResearch[];
};

export type StarterEntity = "Faq" | "Portfolio" | "ResearchRecord";

export type StarterOutcome = {
  entity: StarterEntity;
  /** Rows the fixture file holds. */
  total: number;
  /** Rows that do not exist yet and would be (or were) created. */
  created: number;
  /** Rows already present — left exactly as they are. */
  skipped: number;
  /** Natural keys that were skipped, for the report. */
  skippedKeys: string[];
};

export type StarterReport = {
  applied: boolean;
  byEntity: StarterOutcome[];
  created: number;
  skipped: number;
};

export type StarterOptions = {
  /** False (the default) plans without writing anything. */
  apply?: boolean;
  /**
   * Publish the FAQs on write. They are the gap this content exists to close
   * — the live FAQ page has six questions — so the default is to publish, and
   * the CLI prints that before it writes. Concept studies are never published
   * by this module: a case study with no photography is a broken page, not a
   * thin one.
   */
  publishFaqs?: boolean;
};

/**
 * Plan (and optionally write) the starter content.
 *
 * The three entities are independent — there are no foreign keys between a
 * FAQ, a concept study and a research record — so the order here is only the
 * order the report reads in.
 */
export async function applyStarterContent(
  db: PrismaClient,
  fixtures: StarterFixtures,
  options: StarterOptions = {},
): Promise<StarterReport> {
  const apply = options.apply ?? false;
  const publishFaqs = options.publishFaqs ?? true;

  const byEntity: StarterOutcome[] = [
    await applyFaqs(db, fixtures.faqs, apply, publishFaqs),
    await applyConcepts(db, fixtures.concepts, apply),
    await applyResearch(db, fixtures.research, apply),
  ];

  return {
    applied: apply,
    byEntity,
    created: byEntity.reduce((sum, o) => sum + o.created, 0),
    skipped: byEntity.reduce((sum, o) => sum + o.skipped, 0),
  };
}

/**
 * FAQs are matched on the QUESTION, which is the only natural key the table
 * has — `Faq` carries no slug. Matching is exact rather than fuzzy on
 * purpose: a near-match heuristic that decides "How do I care for my piece?"
 * and "How do I care for and clean my resin art?" are the same question will
 * eventually be wrong, and being wrong here means silently withholding an
 * answer the owner wanted.
 */
async function applyFaqs(
  db: PrismaClient,
  faqs: StarterFaq[],
  apply: boolean,
  publish: boolean,
): Promise<StarterOutcome> {
  const existing = await db.faq.findMany({ select: { question: true } });
  const present = new Set(existing.map((row) => row.question));

  const missing = faqs.filter((faq) => !present.has(faq.question));
  const skippedKeys = faqs
    .filter((faq) => present.has(faq.question))
    .map((faq) => faq.question);

  if (apply && missing.length > 0) {
    // New FAQs sort AFTER everything already on the page — the six live
    // answers were ordered by the owner and inserting into the middle of that
    // would reorder a page nobody asked to reorder.
    const highest = await db.faq.aggregate({ _max: { order: true } });
    let order = (highest._max.order ?? 0) + 1;
    for (const faq of missing) {
      await db.faq.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          order: order++,
          status: publish ? "PUBLISHED" : "DRAFT",
          isDemo: false,
        },
      });
    }
  }

  return {
    entity: "Faq",
    total: faqs.length,
    created: missing.length,
    skipped: skippedKeys.length,
    skippedKeys,
  };
}

/**
 * Concept studies are matched on slug and are ALWAYS created as DRAFT.
 *
 * They carry `resultsMeta.kind = "concept-study"`, which is what the public
 * case page reads to label them. That label is not decoration: these are
 * speculative design studies by the studio, not delivered commissions, and a
 * portfolio that does not say so is making a claim about client work that
 * never happened.
 */
async function applyConcepts(
  db: PrismaClient,
  concepts: StarterConcept[],
  apply: boolean,
): Promise<StarterOutcome> {
  const slugs = concepts.map((c) => c.slug);
  const existing = await db.portfolio.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  const present = new Set(existing.map((row) => row.slug));

  const missing = concepts.filter((c) => !present.has(c.slug));
  const skippedKeys = concepts
    .filter((c) => present.has(c.slug))
    .map((c) => c.slug);

  if (apply) {
    for (const concept of missing) {
      await db.portfolio.create({
        data: {
          title: concept.title,
          slug: concept.slug,
          story: concept.story,
          brief: concept.brief,
          process: concept.process,
          location: concept.location,
          year: concept.year,
          status: "DRAFT",
          isDemo: false,
          resultsMeta: {
            ...concept.resultsMeta,
            kind: "concept-study",
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  return {
    entity: "Portfolio",
    total: concepts.length,
    created: missing.length,
    skipped: skippedKeys.length,
    skippedKeys,
  };
}

/**
 * Research records are matched on URL — the one field that identifies a
 * competitor page across re-runs, where the title changes whenever they
 * redesign. They stay `status: "RESEARCH"` and are never public.
 */
async function applyResearch(
  db: PrismaClient,
  records: StarterResearch[],
  apply: boolean,
): Promise<StarterOutcome> {
  const urls = records.map((r) => r.url);
  const existing = await db.researchRecord.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const present = new Set(existing.map((row) => row.url));

  const missing = records.filter((r) => !present.has(r.url));
  const skippedKeys = records
    .filter((r) => present.has(r.url))
    .map((r) => r.url);

  if (apply) {
    for (const record of missing) {
      await db.researchRecord.create({
        data: {
          source: record.source,
          url: record.url,
          title: record.title,
          category: record.category,
          materials: record.materials ?? null,
          dimensions: record.dimensions ?? null,
          price: record.price || null,
          description: record.description,
          notes: record.notes,
          tags: record.tags,
          status: "RESEARCH",
          isDemo: false,
        },
      });
    }
  }

  return {
    entity: "ResearchRecord",
    total: records.length,
    created: missing.length,
    skipped: skippedKeys.length,
    skippedKeys,
  };
}
