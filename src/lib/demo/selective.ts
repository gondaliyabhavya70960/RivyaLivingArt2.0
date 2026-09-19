/**
 * Content Lab — remove SOME demo data, not all of it.
 *
 * `removeDemo` in ./apply.ts is the blunt instrument: every demo row in every
 * table, behind one typed phrase. That is the right tool for "reset this
 * database" and the wrong one for "drop the demo inquiries, keep the demo
 * journal while I finish checking the article layout". This module is the
 * scoped version, and it exists because the owner asked to be able to pick.
 *
 * Three rules shape everything below, and each of them is a rule because the
 * cheap version of it is silently wrong:
 *
 * 1. THE CLIENT'S CLAIM THAT A ROW IS DEMO IS NOT EVIDENCE. Every id that
 *    arrives from the browser is re-read server-side with `isDemo: true` in
 *    the WHERE clause before anything is deleted, and the delete itself
 *    carries the same clause. A row the owner promoted to real between
 *    opening the screen and pressing the button is reported as PROTECTED and
 *    left alone — it is not an error and it is not silently skipped.
 *
 * 2. SHARED MEDIA SURVIVES. A demo `Media` row whose file is also used by
 *    genuine content must lose the demo relationship, never the file. The
 *    check is ordered rather than clever: content rows are deleted FIRST, so
 *    by the time the media pass runs, any usage still reported by
 *    `findMediaUsageDetails` is by definition a genuine referrer. A demo
 *    picture used only by a demo product has already lost its last referrer
 *    and is free to go.
 *
 * 3. NOTHING HERE RUNS BY ITSELF. There is no cron, no deploy hook and no
 *    "tidy up" path into this module. Every export takes an explicit
 *    selection that a person assembled, and `src/actions/demo.ts` is the only
 *    caller.
 *
 * Like ./apply.ts this takes a `PrismaClient` rather than importing one, and
 * takes the media-usage lookup as a parameter rather than importing
 * `@/lib/media-usages` — that module reaches for the shared `@/lib/db`
 * singleton, which would drag Next's request context into a file a plain
 * `tsx` script has to be able to load.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { DEMO_ENTITY_ORDER, type DemoCounts } from "@/lib/demo/apply";

export type DemoEntity = (typeof DEMO_ENTITY_ORDER)[number];

/** url → human labels of the places still referencing it. */
export type UsageLookup = (urls: string[]) => Promise<Map<string, string[]>>;

/**
 * What the owner picked. `entities` clears every demo row in those tables;
 * `ids` names individual rows. Both may be present — the union is removed.
 */
export type DemoSelection = {
  entities?: DemoEntity[];
  ids?: Partial<Record<DemoEntity, string[]>>;
};

export type NormalizedSelection = {
  /** Tables to clear wholesale, in dependency-safe delete order. */
  entities: DemoEntity[];
  /** Individual rows, in the same order, excluding tables already cleared. */
  ids: Array<{ entity: DemoEntity; ids: string[] }>;
  /** Total rows explicitly named (whole-table clears are not counted here). */
  namedRows: number;
};

export type EntityOutcome = {
  entity: DemoEntity;
  /** Rows the request asked for — the whole demo set when cleared wholesale. */
  selected: number;
  deleted: number;
  /** Named but no longer `isDemo: true` — left alone deliberately. */
  protectedRows: number;
  /** Named but not found at all (already deleted, or a stale screen). */
  missing: number;
};

export type DemoRemovalReport = {
  selected: number;
  deleted: number;
  protectedRows: number;
  missing: number;
  byEntity: EntityOutcome[];
  /** Demo media files deleted because nothing genuine referenced them. */
  demoMediaRemoved: number;
  /** Demo media rows kept because genuine content still uses the file. */
  sharedMediaPreserved: Array<{ url: string; usedBy: string[] }>;
  /** Demo rows still in the database after the run. */
  remaining: DemoCounts;
};

/**
 * Delete order — children before parents. `Media` is deliberately ABSENT: it
 * is handled last and separately, after every content row that could be
 * referencing a demo file has already gone (rule 2 above).
 */
const REMOVAL_ORDER: DemoEntity[] = [
  "ImportRun",
  "ScrapeJob",
  "ResearchRecord",
  "Inquiry",
  "CustomPage",
  "Faq",
  "Testimonial",
  "Portfolio",
  "Product",
  "BlogPost",
  "BlogCategory",
];

export const DEMO_ENTITY_LABELS: Record<DemoEntity, string> = {
  BlogCategory: "Journal categories",
  BlogPost: "Journal posts",
  Media: "Media files",
  Product: "Products",
  Portfolio: "Portfolio cases",
  Testimonial: "Testimonials",
  Faq: "FAQs",
  CustomPage: "Landing pages",
  Inquiry: "Inquiries",
  ResearchRecord: "Research records",
  ScrapeJob: "Scrape jobs",
  ImportRun: "Import runs",
};

const KNOWN_ENTITIES = new Set<string>(DEMO_ENTITY_ORDER);

/**
 * Put a selection into a deterministic, de-duplicated, delete-safe shape.
 *
 * Unknown entity names are dropped rather than thrown on: the selection
 * arrives over the wire from a screen that may be a deploy behind, and a
 * table it knows about that this build does not is not worth failing a
 * removal the owner is watching. Ids for a table being cleared wholesale are
 * dropped too — they are already covered, and counting them twice would
 * report a `selected` total the database can never match.
 */
export function normalizeSelection(
  selection: DemoSelection,
): NormalizedSelection {
  const entities = REMOVAL_ORDER.concat("Media").filter(
    (entity) => selection.entities?.includes(entity) ?? false,
  );
  const cleared = new Set(entities);

  const ids: Array<{ entity: DemoEntity; ids: string[] }> = [];
  let namedRows = 0;
  for (const entity of REMOVAL_ORDER.concat("Media")) {
    if (cleared.has(entity)) continue;
    const raw = selection.ids?.[entity];
    if (!raw || raw.length === 0) continue;
    const unique = [...new Set(raw.filter((id) => id.trim().length > 0))];
    if (unique.length === 0) continue;
    ids.push({ entity, ids: unique });
    namedRows += unique.length;
  }

  return { entities, ids, namedRows };
}

/**
 * True when the selection clears whole tables, which is the case a typed
 * phrase exists for: an entity clear is unbounded — the owner is agreeing to
 * lose however many rows that table happens to hold, which is a different
 * decision from ticking four rows they can see.
 */
export function requiresTypedConfirmation(selection: DemoSelection): boolean {
  return normalizeSelection(selection).entities.length > 0;
}

export const DEMO_REMOVAL_PHRASE = "REMOVE DEMO DATA";

/**
 * Why this removal cannot run, in the owner's words, or null when it can.
 *
 * Returned rather than thrown for the reason the studio's other guards give:
 * `runAction` reports every throw as "something went wrong", which is exactly
 * the wrong message for "you typed the phrase slightly wrong".
 */
export function describeSelectionProblem(
  selection: DemoSelection,
  confirmation: string,
): string | null {
  const normalized = normalizeSelection(selection);
  // The unknown-type check runs BEFORE the empty check and not after it: a
  // selection of nothing but types this build has never heard of normalizes
  // to empty, and "Nothing is selected" sends the owner back to a screen
  // where something plainly IS selected.
  const unknown = (selection.entities ?? []).filter(
    (entity) => !KNOWN_ENTITIES.has(entity),
  );
  if (unknown.length > 0 && normalized.entities.length === 0) {
    return `This build does not know the content type ${unknown[0]}.`;
  }
  if (normalized.entities.length === 0 && normalized.ids.length === 0) {
    return "Nothing is selected.";
  }
  if (
    requiresTypedConfirmation(selection) &&
    confirmation !== DEMO_REMOVAL_PHRASE
  ) {
    return `Type "${DEMO_REMOVAL_PHRASE}" to clear a whole content type.`;
  }
  return null;
}

/** The narrow WHERE every demo delete uses. `isDemo` is never optional. */
type DemoWhere = { isDemo: true; id?: { in: string[] } };

/** Narrowed by the caller: with `isDemo` for deletable rows, without it to
 *  find out whether an undeletable id still exists at all. */
type FindWhere = { id: { in: string[] }; isDemo?: true };

type Delegate = {
  count: (where: DemoWhere) => Promise<number>;
  find: (where: FindWhere) => Promise<Array<{ id: string }>>;
  remove: (where: DemoWhere) => Promise<{ count: number }>;
};

/**
 * One switch rather than a lookup table, for the reason
 * `findMediaUsageDetails` gives about its own named queries: a positional or
 * keyed map of twelve Prisma delegates hands one table's rows to another
 * table's label the first time an entry is inserted in the wrong slot, and
 * the failure is a silent wrong delete rather than a type error.
 */
function delegateFor(db: PrismaClient, entity: DemoEntity): Delegate {
  const select = { id: true } as const;
  switch (entity) {
    case "BlogCategory":
      return {
        count: (where) => db.blogCategory.count({ where }),
        find: (where) => db.blogCategory.findMany({ where, select }),
        remove: (where) => db.blogCategory.deleteMany({ where }),
      };
    case "BlogPost":
      return {
        count: (where) => db.blogPost.count({ where }),
        find: (where) => db.blogPost.findMany({ where, select }),
        remove: (where) => db.blogPost.deleteMany({ where }),
      };
    case "Media":
      return {
        count: (where) => db.media.count({ where }),
        find: (where) => db.media.findMany({ where, select }),
        remove: (where) => db.media.deleteMany({ where }),
      };
    case "Product":
      return {
        count: (where) => db.product.count({ where }),
        find: (where) => db.product.findMany({ where, select }),
        remove: (where) => db.product.deleteMany({ where }),
      };
    case "Portfolio":
      return {
        count: (where) => db.portfolio.count({ where }),
        find: (where) => db.portfolio.findMany({ where, select }),
        remove: (where) => db.portfolio.deleteMany({ where }),
      };
    case "Testimonial":
      return {
        count: (where) => db.testimonial.count({ where }),
        find: (where) => db.testimonial.findMany({ where, select }),
        remove: (where) => db.testimonial.deleteMany({ where }),
      };
    case "Faq":
      return {
        count: (where) => db.faq.count({ where }),
        find: (where) => db.faq.findMany({ where, select }),
        remove: (where) => db.faq.deleteMany({ where }),
      };
    case "CustomPage":
      return {
        count: (where) => db.customPage.count({ where }),
        find: (where) => db.customPage.findMany({ where, select }),
        remove: (where) => db.customPage.deleteMany({ where }),
      };
    case "Inquiry":
      return {
        count: (where) => db.inquiry.count({ where }),
        find: (where) => db.inquiry.findMany({ where, select }),
        remove: (where) => db.inquiry.deleteMany({ where }),
      };
    case "ResearchRecord":
      return {
        count: (where) => db.researchRecord.count({ where }),
        find: (where) => db.researchRecord.findMany({ where, select }),
        remove: (where) => db.researchRecord.deleteMany({ where }),
      };
    case "ScrapeJob":
      return {
        count: (where) => db.scrapeJob.count({ where }),
        find: (where) => db.scrapeJob.findMany({ where, select }),
        remove: (where) => db.scrapeJob.deleteMany({ where }),
      };
    case "ImportRun":
      return {
        count: (where) => db.importRun.count({ where }),
        find: (where) => db.importRun.findMany({ where, select }),
        remove: (where) => db.importRun.deleteMany({ where }),
      };
  }
}

async function removeOne(
  db: PrismaClient,
  entity: DemoEntity,
  ids: string[] | null,
): Promise<EntityOutcome> {
  const delegate = delegateFor(db, entity);

  if (ids === null) {
    const selected = await delegate.count({ isDemo: true });
    const { count } = await delegate.remove({ isDemo: true });
    return { entity, selected, deleted: count, protectedRows: 0, missing: 0 };
  }

  // Rule 1: the browser said these are demo rows. Ask the database.
  const live = await delegate.find({ id: { in: ids }, isDemo: true });
  const verified = new Set(live.map((row) => row.id));
  const deleted = verified.size
    ? (await delegate.remove({ isDemo: true, id: { in: [...verified] } })).count
    : 0;

  // Anything named that did not come back is either no longer demo or gone.
  // Those are different facts and the owner is told which, so the second
  // lookup deliberately DROPS the isDemo clause — asking again WITH it would
  // return the same empty set and report every protected row as missing.
  const unaccounted = ids.filter((id) => !verified.has(id));
  const stillThere = unaccounted.length
    ? (await delegate.find({ id: { in: unaccounted } })).length
    : 0;

  return {
    entity,
    selected: ids.length,
    deleted,
    // Exists, but no longer classified as demo — left alone on purpose.
    protectedRows: stillThere,
    missing: unaccounted.length - stillThere,
  };
}

/**
 * Delete the selected demo rows and report exactly what happened.
 *
 * The caller is responsible for authorisation and for the typed phrase —
 * `describeSelectionProblem` is exported so the action and the screen run the
 * same check, because CI does not run when an owner presses a button.
 */
export async function removeDemoSelection(
  db: PrismaClient,
  selection: DemoSelection,
  findUsages: UsageLookup,
  counts: (db: PrismaClient) => Promise<DemoCounts>,
): Promise<DemoRemovalReport> {
  const normalized = normalizeSelection(selection);
  const wholesale = new Set(normalized.entities);
  const named = new Map(normalized.ids.map((entry) => [entry.entity, entry.ids]));

  const byEntity: EntityOutcome[] = [];

  // Content first, in child-before-parent order. Media is excluded here on
  // purpose and handled below, once nothing demo is left to reference a file.
  for (const entity of REMOVAL_ORDER) {
    if (wholesale.has(entity)) {
      byEntity.push(await removeOne(db, entity, null));
    } else if (named.has(entity)) {
      byEntity.push(await removeOne(db, entity, named.get(entity) ?? []));
    }
  }

  // Rule 2: media last, and one file at a time against the real usage graph.
  let demoMediaRemoved = 0;
  const sharedMediaPreserved: Array<{ url: string; usedBy: string[] }> = [];
  const wantsMedia = wholesale.has("Media") || named.has("Media");

  if (wantsMedia) {
    const candidates = wholesale.has("Media")
      ? await db.media.findMany({
          where: { isDemo: true },
          select: { id: true, url: true },
        })
      : await db.media.findMany({
          where: { id: { in: named.get("Media") ?? [] }, isDemo: true },
          select: { id: true, url: true },
        });

    const usages = await findUsages(candidates.map((m) => m.url));
    const free: string[] = [];
    for (const media of candidates) {
      const usedBy = usages.get(media.url);
      if (usedBy && usedBy.length > 0) {
        sharedMediaPreserved.push({ url: media.url, usedBy });
      } else {
        free.push(media.id);
      }
    }
    if (free.length > 0) {
      const { count } = await db.media.deleteMany({
        where: { id: { in: free }, isDemo: true },
      });
      demoMediaRemoved = count;
    }

    const requested = wholesale.has("Media")
      ? candidates.length
      : (named.get("Media") ?? []).length;
    byEntity.push({
      entity: "Media",
      selected: requested,
      deleted: demoMediaRemoved,
      protectedRows: sharedMediaPreserved.length,
      missing: Math.max(
        0,
        requested - demoMediaRemoved - sharedMediaPreserved.length,
      ),
    });
  }

  const total = (pick: (o: EntityOutcome) => number) =>
    byEntity.reduce((sum, outcome) => sum + pick(outcome), 0);

  return {
    selected: total((o) => o.selected),
    deleted: total((o) => o.deleted),
    protectedRows: total((o) => o.protectedRows),
    missing: total((o) => o.missing),
    byEntity,
    demoMediaRemoved,
    sharedMediaPreserved,
    remaining: await counts(db),
  };
}
