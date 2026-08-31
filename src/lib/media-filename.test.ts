import { describe, expect, it } from "vitest";

import { seoFilename, splitFilename } from "./media-filename";

describe("splitFilename", () => {
  it("separates the stem from a lowercased extension", () => {
    expect(splitFilename("Varmala Clock.JPEG")).toEqual({
      stem: "Varmala Clock",
      ext: ".jpeg",
    });
  });

  it("keeps dots inside the stem", () => {
    expect(splitFilename("photo.final.v2.png")).toEqual({
      stem: "photo.final.v2",
      ext: ".png",
    });
  });

  it("drops any path the browser sent", () => {
    expect(splitFilename("C:\\Users\\me\\Desktop\\shot.jpg").stem).toBe("shot");
  });

  it("handles a name with no extension and a dotfile", () => {
    expect(splitFilename("README")).toEqual({ stem: "README", ext: "" });
    expect(splitFilename(".gitignore")).toEqual({
      stem: ".gitignore",
      ext: "",
    });
  });
});

describe("seoFilename", () => {
  it("keeps a name the owner actually chose", () => {
    expect(seoFilename("Varmala Preservation Clock.jpg", "products")).toBe(
      "varmala-preservation-clock",
    );
  });

  it("replaces the names a phone or a chat app invents", () => {
    // The whole point (§3.4.5): these must never reach a production URL. They
    // say nothing about the picture and they leak when it was taken.
    const junk = [
      "WhatsApp Image 2026-07-07 at 15.05.34.jpeg",
      "IMG_4942.jpg",
      "DSC00031.JPG",
      "PXL_20260707_150534.jpg",
      "Screenshot 2026-07-07 at 15.05.34.png",
      "Untitled.png",
      "download (3).png",
      "20260707_150534.jpg",
    ];
    for (const name of junk) {
      expect(seoFilename(name, "products"), name).toBe("products");
    }
  });

  it("falls back to the folder, so a camera dump is still findable", () => {
    expect(seoFilename("IMG_0001.jpg", "portfolio")).toBe("portfolio");
  });

  it("numbers the fallback so a camera dump cannot collide with itself", () => {
    expect(seoFilename("IMG_0001.jpg", "products", 0)).toBe("products");
    expect(seoFilename("IMG_0002.jpg", "products", 1)).toBe("products-2");
    expect(seoFilename("IMG_0003.jpg", "products", 2)).toBe("products-3");
  });

  it("never numbers a name the owner chose", () => {
    // Being second in the batch is not a fact about the picture. The storage
    // driver's random suffix already makes the pathname unique.
    expect(seoFilename("Varmala Clock.jpg", "products", 1)).toBe(
      "varmala-clock",
    );
    expect(seoFilename("Varmala Clock.jpg", "products", 7)).toBe(
      "varmala-clock",
    );
  });

  it("caps a very long name without leaving a trailing dash", () => {
    const long = `${"resin-".repeat(30)}clock.jpg`;
    const out = seoFilename(long, "products");
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("-")).toBe(false);
  });

  it("never returns an empty string", () => {
    // A pathname built from "" would be a directory, and the storage driver
    // refuses those — so this is the guard that keeps an upload from failing.
    expect(seoFilename("", "")).toBe("file");
    expect(seoFilename("...", "")).toBe("file");
    expect(seoFilename("😀.png", "")).toBe("file");
  });

  it("strips characters that have no business in a URL", () => {
    expect(seoFilename("Résin & Gold (final)!.jpg", "products")).toBe(
      "resin-gold-final",
    );
  });
});
