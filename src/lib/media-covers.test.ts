import { describe, expect, it } from "vitest";

import { isCoverImage, reorderForCover } from "@/lib/media-covers";

const GALLERY = [
  { id: "a", url: "/a.jpg", order: 0 },
  { id: "b", url: "/b.jpg", order: 1 },
  { id: "c", url: "/c.jpg", order: 2 },
];

describe("reorderForCover", () => {
  it("moves the target to the front and keeps the rest in order", () => {
    expect(reorderForCover(GALLERY, "/c.jpg")).toEqual([
      { id: "c", order: 0 },
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("writes nothing when the target is already the cover", () => {
    // A control that offers a no-op is a control that teaches the owner their
    // click did nothing.
    expect(reorderForCover(GALLERY, "/a.jpg")).toBeNull();
  });

  it("is null when the media is not in this gallery at all", () => {
    expect(reorderForCover(GALLERY, "/elsewhere.jpg")).toBeNull();
  });

  it("renumbers from zero rather than decrementing below the minimum", () => {
    // The failure a `min - 1` strategy produces: repeated use drifts negative
    // and leaves the old numbers untouched, so gaps compound.
    const gappy = [
      { id: "a", url: "/a.jpg", order: 5 },
      { id: "b", url: "/b.jpg", order: 40 },
    ];
    expect(reorderForCover(gappy, "/b.jpg")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
    ]);
  });

  it("breaks a tie by existing position, not by the sort's whim", () => {
    // Duplicate orders are real in this table. Without the stable tie-break
    // the two tied rows could swap on every save, so the gallery would
    // reshuffle itself each time someone set a cover.
    //
    // The expected set is the MINIMAL one: `c` is already stored as 0, so it
    // needs no write even though it moved from third place to first. What
    // makes it the cover is that a and b move OFF 0, and after this write the
    // three read back as c=0, a=1, b=2.
    const tied = [
      { id: "a", url: "/a.jpg", order: 0 },
      { id: "b", url: "/b.jpg", order: 0 },
      { id: "c", url: "/c.jpg", order: 0 },
    ];
    expect(reorderForCover(tied, "/c.jpg")).toEqual([
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("leaves the gallery readable as cover-first after a minimal write", () => {
    // The property the minimal set has to preserve, checked rather than
    // assumed: apply the changes, and the target is strictly lowest.
    const tied = [
      { id: "a", url: "/a.jpg", order: 0 },
      { id: "b", url: "/b.jpg", order: 0 },
      { id: "c", url: "/c.jpg", order: 0 },
    ];
    const changes = reorderForCover(tied, "/c.jpg") ?? [];
    const applied = tied.map((image) => ({
      ...image,
      order: changes.find((c) => c.id === image.id)?.order ?? image.order,
    }));
    expect(isCoverImage(applied, "/c.jpg")).toBe(true);
    expect(applied.map((i) => i.order).sort()).toEqual([0, 1, 2]);
  });

  it("handles a single-image gallery", () => {
    expect(
      reorderForCover([{ id: "a", url: "/a.jpg", order: 3 }], "/a.jpg"),
    ).toEqual([{ id: "a", order: 0 }]);
  });
});

describe("isCoverImage", () => {
  it("reads the lowest order, not the first row returned", () => {
    const unsorted = [
      { id: "b", url: "/b.jpg", order: 2 },
      { id: "a", url: "/a.jpg", order: 0 },
    ];
    expect(isCoverImage(unsorted, "/a.jpg")).toBe(true);
    expect(isCoverImage(unsorted, "/b.jpg")).toBe(false);
  });

  it("is false for an empty gallery", () => {
    expect(isCoverImage([], "/a.jpg")).toBe(false);
  });
});
