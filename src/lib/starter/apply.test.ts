import { describe, expect, it } from "vitest";

import { applyStarterContent, type StarterFixtures } from "@/lib/starter/apply";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * A recording stub rather than a real database.
 *
 * The guarantee worth testing here is a NEGATIVE one — that nothing is ever
 * updated — and the cheapest way to prove a call was not made is to count
 * calls. `applyStarterContent` only ever reaches for `findMany`, `aggregate`
 * and `create`, so anything else being present and untouched is the assertion.
 */
function stubDb(existing: {
  faqQuestions?: string[];
  portfolioSlugs?: string[];
  researchUrls?: string[];
}) {
  const created: Array<{ table: string; data: Record<string, unknown> }> = [];
  const updated: Array<{ table: string }> = [];

  const table = (name: string, rows: Array<Record<string, unknown>>) => ({
    findMany: async () => rows,
    aggregate: async () => ({ _max: { order: 6 } }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push({ table: name, data });
      return data;
    },
    update: async () => {
      updated.push({ table: name });
      return {};
    },
    upsert: async () => {
      updated.push({ table: name });
      return {};
    },
  });

  const db = {
    faq: table(
      "faq",
      (existing.faqQuestions ?? []).map((question) => ({ question })),
    ),
    portfolio: table(
      "portfolio",
      (existing.portfolioSlugs ?? []).map((slug) => ({ slug })),
    ),
    researchRecord: table(
      "researchRecord",
      (existing.researchUrls ?? []).map((url) => ({ url })),
    ),
  } as unknown as PrismaClient;

  return { db, created, updated };
}

const FIXTURES: StarterFixtures = {
  faqs: [
    { question: "How do I care for and clean my resin art?", answer: "A", group: "resin" },
    { question: "Does resin yellow in sunlight?", answer: "B", group: "resin" },
  ],
  concepts: [
    {
      title: "Coastal Resin Dining Table",
      slug: "concept-coastal-dining-table",
      brief: "b",
      process: "p",
      story: "s",
      location: "Surat studio",
      year: 2026,
      resultsMeta: { type: "Dining table", material: "Oak", size: "indicative", timeline: "indicative" },
      images: [],
    },
  ],
  research: [
    {
      source: "Example Studio",
      url: "https://example.com/tables",
      title: "Tables",
      category: "furniture",
      description: "d",
      tags: ["furniture"],
      notes: "n",
    },
  ],
};

describe("applyStarterContent", () => {
  it("writes nothing on a dry run, but reports the real plan", async () => {
    const { db, created, updated } = stubDb({});
    const report = await applyStarterContent(db, FIXTURES, { apply: false });

    expect(created).toEqual([]);
    expect(updated).toEqual([]);
    expect(report.applied).toBe(false);
    expect(report.created).toBe(4); // 2 faqs + 1 concept + 1 research
    expect(report.skipped).toBe(0);
  });

  it("creates only what is missing and NEVER updates what exists", async () => {
    const { db, created, updated } = stubDb({
      // The live FAQ the owner already wrote — and may have edited since.
      faqQuestions: ["How do I care for and clean my resin art?"],
      portfolioSlugs: ["concept-coastal-dining-table"],
      researchUrls: ["https://example.com/tables"],
    });
    const report = await applyStarterContent(db, FIXTURES, { apply: true });

    // This is the whole point of the module: an existing row is the owner's.
    expect(updated).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0].table).toBe("faq");
    expect(created[0].data.question).toBe("Does resin yellow in sunlight?");

    expect(report.created).toBe(1);
    expect(report.skipped).toBe(3);
    const faq = report.byEntity.find((o) => o.entity === "Faq");
    expect(faq?.skippedKeys).toEqual([
      "How do I care for and clean my resin art?",
    ]);
  });

  it("sorts new FAQs after the ones already on the page", async () => {
    const { db, created } = stubDb({});
    await applyStarterContent(db, FIXTURES, { apply: true });
    const orders = created
      .filter((c) => c.table === "faq")
      .map((c) => c.data.order);
    // The stub's max order is 6 — the six live answers, ordered by the owner.
    // Inserting into the middle of that would reorder a page nobody asked to.
    expect(orders).toEqual([7, 8]);
  });

  it("publishes FAQs by default and drafts them on request", async () => {
    const live = stubDb({});
    await applyStarterContent(live.db, FIXTURES, { apply: true });
    expect(live.created.filter((c) => c.table === "faq").map((c) => c.data.status))
      .toEqual(["PUBLISHED", "PUBLISHED"]);

    const draft = stubDb({});
    await applyStarterContent(draft.db, FIXTURES, {
      apply: true,
      publishFaqs: false,
    });
    expect(draft.created.filter((c) => c.table === "faq").map((c) => c.data.status))
      .toEqual(["DRAFT", "DRAFT"]);
  });

  it("always creates a concept study as a labelled draft", async () => {
    const { db, created } = stubDb({});
    await applyStarterContent(db, FIXTURES, { apply: true });
    const concept = created.find((c) => c.table === "portfolio");
    expect(concept?.data.status).toBe("DRAFT");
    // Unlabelled, it would be a claim about client work that never happened.
    expect(concept?.data.resultsMeta).toMatchObject({ kind: "concept-study" });
  });

  it("keeps research records internal and never demo", async () => {
    const { db, created } = stubDb({});
    await applyStarterContent(db, FIXTURES, { apply: true });
    const record = created.find((c) => c.table === "researchRecord");
    expect(record?.data.status).toBe("RESEARCH");
    expect(record?.data.isDemo).toBe(false);
  });
});
