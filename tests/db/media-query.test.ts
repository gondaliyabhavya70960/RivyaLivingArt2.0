import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseFilters, queryMedia } from "@/app/studio/(dashboard)/media/query";
import { getTestDb } from "./helpers";

/**
 * The media library's query layer against real Postgres (batch D · media
 * system). The one genuinely risky piece is the orientation filter: Prisma
 * cannot compare `width` against `height` — two columns of the same row —
 * in a `where` clause, so it is answered by three small, fully static
 * `$queryRaw` calls. This proves those three queries actually partition a
 * mixed set of rows the way the landscape/portrait/square labels claim,
 * plus the size-band and sort behaviour built on top of the same table.
 *
 * Rows are created with test- ids inside try/finally, same convention as
 * demo-gate.test.ts.
 */
const PREFIX = "test-media-query-";
const ids = {
  landscape: `${PREFIX}landscape`,
  portrait: `${PREFIX}portrait`,
  square: `${PREFIX}square`,
  noDims: `${PREFIX}no-dims`,
  small: `${PREFIX}small`,
  large: `${PREFIX}large`,
  aName: `${PREFIX}a-name`,
  zName: `${PREFIX}z-name`,
};

let db: PrismaClient | null = null;

beforeAll(async () => {
  db = await getTestDb();
  if (!db) return;

  const base = {
    folder: "refs" as const,
    type: "IMAGE" as const,
  };

  await db.media.createMany({
    data: [
      {
        id: ids.landscape,
        pathname: `${ids.landscape}.jpg`,
        url: `/uploads/${ids.landscape}.jpg`,
        width: 1600,
        height: 900,
        bytes: 500_000,
        originalName: ids.landscape,
        ...base,
      },
      {
        id: ids.portrait,
        pathname: `${ids.portrait}.jpg`,
        url: `/uploads/${ids.portrait}.jpg`,
        width: 900,
        height: 1600,
        bytes: 500_000,
        originalName: ids.portrait,
        ...base,
      },
      {
        id: ids.square,
        pathname: `${ids.square}.jpg`,
        url: `/uploads/${ids.square}.jpg`,
        width: 1000,
        height: 1000,
        bytes: 500_000,
        originalName: ids.square,
        ...base,
      },
      {
        id: ids.noDims,
        pathname: `${ids.noDims}.glb`,
        url: `/uploads/${ids.noDims}.glb`,
        width: null,
        height: null,
        bytes: 500_000,
        type: "MODEL3D",
        folder: "refs",
        originalName: ids.noDims,
      },
      {
        id: ids.small,
        pathname: `${ids.small}.jpg`,
        url: `/uploads/${ids.small}.jpg`,
        bytes: 10_000, // 10 KB — "small" band
        originalName: ids.small,
        ...base,
      },
      {
        id: ids.large,
        pathname: `${ids.large}.jpg`,
        url: `/uploads/${ids.large}.jpg`,
        bytes: 5 * 1024 * 1024, // 5 MB — "large" band
        originalName: ids.large,
        ...base,
      },
      {
        id: ids.aName,
        pathname: `${PREFIX}a-name-file.jpg`,
        url: `/uploads/${PREFIX}a-name-file.jpg`,
        bytes: 500_000,
        originalName: ids.aName,
        ...base,
      },
      {
        id: ids.zName,
        pathname: `${PREFIX}z-name-file.jpg`,
        url: `/uploads/${PREFIX}z-name-file.jpg`,
        bytes: 500_000,
        originalName: ids.zName,
        ...base,
      },
    ],
  });
});

afterAll(async () => {
  if (!db) return;
  await db.media.deleteMany({ where: { id: { in: Object.values(ids) } } });
});

/** Scopes every query to just this test's own fixtures via the shared
 *  pathname prefix, so it never depends on — or is thrown off by —
 *  whatever else is in the library. */
function scoped(q: string) {
  return { q };
}

describe("parseFilters", () => {
  it("defaults to newest/grid/no filters on an empty params object", () => {
    const filters = parseFilters({});
    expect(filters).toMatchObject({
      folder: null,
      q: "",
      filter: null,
      type: null,
      orientation: null,
      from: null,
      to: null,
      size: null,
      favourite: false,
      demo: false,
      sort: "newest",
      view: "grid",
      after: null,
    });
  });

  it("reads every recognised param", () => {
    const filters = parseFilters({
      folder: "products",
      q: "  teak bowl  ",
      filter: "unused",
      type: "VIDEO",
      orientation: "portrait",
      from: "2026-01-01",
      to: "2026-02-01",
      size: "large",
      favourite: "1",
      demo: "1",
      sort: "oldest",
      view: "list",
      after: "abc123",
    });
    expect(filters).toEqual({
      folder: "products",
      q: "teak bowl",
      filter: "unused",
      type: "VIDEO",
      orientation: "portrait",
      from: "2026-01-01",
      to: "2026-02-01",
      size: "large",
      favourite: true,
      demo: true,
      sort: "oldest",
      view: "list",
      after: "abc123",
    });
  });

  it("drops an unrecognised enum value and a malformed date rather than throwing", () => {
    const filters = parseFilters({
      folder: "not-a-real-folder",
      type: "SPREADSHEET",
      sort: "shuffle",
      from: "not-a-date",
    });
    expect(filters.folder).toBeNull();
    expect(filters.type).toBeNull();
    expect(filters.sort).toBe("newest"); // falls back to the default
    expect(filters.from).toBeNull();
  });
});

describe("orientation filter (Postgres $queryRaw)", () => {
  it("landscape is width > height, and nothing else", async (ctx) => {
    if (!db) return ctx.skip();
    const result = await queryMedia({
      ...parseFilters({}),
      orientation: "landscape",
      ...scoped(PREFIX),
    });
    const returnedIds = result.rows.map((r) => r.id);
    expect(returnedIds).toContain(ids.landscape);
    expect(returnedIds).not.toContain(ids.portrait);
    expect(returnedIds).not.toContain(ids.square);
    expect(returnedIds).not.toContain(ids.noDims);
  });

  it("portrait is width < height, and nothing else", async (ctx) => {
    if (!db) return ctx.skip();
    const result = await queryMedia({
      ...parseFilters({}),
      orientation: "portrait",
      ...scoped(PREFIX),
    });
    const returnedIds = result.rows.map((r) => r.id);
    expect(returnedIds).toContain(ids.portrait);
    expect(returnedIds).not.toContain(ids.landscape);
    expect(returnedIds).not.toContain(ids.square);
  });

  it("square is width = height, and nothing else", async (ctx) => {
    if (!db) return ctx.skip();
    const result = await queryMedia({
      ...parseFilters({}),
      orientation: "square",
      ...scoped(PREFIX),
    });
    const returnedIds = result.rows.map((r) => r.id);
    expect(returnedIds).toContain(ids.square);
    expect(returnedIds).not.toContain(ids.landscape);
    expect(returnedIds).not.toContain(ids.portrait);
  });

  it("never includes a row with no recorded dimensions in any orientation", async (ctx) => {
    if (!db) return ctx.skip();
    for (const orientation of ["landscape", "portrait", "square"] as const) {
      const result = await queryMedia({
        ...parseFilters({}),
        orientation,
        ...scoped(PREFIX),
      });
      expect(result.rows.map((r) => r.id)).not.toContain(ids.noDims);
    }
  });
});

describe("size band filter", () => {
  it("small is under 250 KB, large is 2-10 MB — each band excludes the other's fixture", async (ctx) => {
    if (!db) return ctx.skip();
    const small = await queryMedia({
      ...parseFilters({}),
      size: "small",
      ...scoped(PREFIX),
    });
    const smallIds = small.rows.map((r) => r.id);
    expect(smallIds).toContain(ids.small);
    expect(smallIds).not.toContain(ids.large);

    const large = await queryMedia({
      ...parseFilters({}),
      size: "large",
      ...scoped(PREFIX),
    });
    const largeIds = large.rows.map((r) => r.id);
    expect(largeIds).toContain(ids.large);
    expect(largeIds).not.toContain(ids.small);
  });
});

describe("sort", () => {
  it("name sorts ascending by pathname", async (ctx) => {
    if (!db) return ctx.skip();
    const result = await queryMedia({
      ...parseFilters({}),
      sort: "name",
      ...scoped(PREFIX),
    });
    const aIndex = result.rows.findIndex((r) => r.id === ids.aName);
    const zIndex = result.rows.findIndex((r) => r.id === ids.zName);
    expect(aIndex).toBeGreaterThanOrEqual(0);
    expect(zIndex).toBeGreaterThan(aIndex);
  });

  it("largest sorts descending by bytes", async (ctx) => {
    if (!db) return ctx.skip();
    const result = await queryMedia({
      ...parseFilters({}),
      sort: "largest",
      ...scoped(PREFIX),
    });
    const largeIndex = result.rows.findIndex((r) => r.id === ids.large);
    const smallIndex = result.rows.findIndex((r) => r.id === ids.small);
    expect(largeIndex).toBeGreaterThanOrEqual(0);
    expect(largeIndex).toBeLessThan(smallIndex);
  });
});
