import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "./constants";
import { SHARED_METADATA } from "@/app/shared-metadata";

describe("Phase 2f #1: Footer tagline and proposition alignment", () => {
  it("SITE.tagline does not mention 3D printing and reflects handcrafted resin art", () => {
    expect(SITE.tagline).not.toMatch(/3d printing/i);
    expect(SITE.tagline).toBe("Handcrafted resin art, made to order.");
  });

  it("SHARED_METADATA default title and description do not mention 3D printing", () => {
    const titleDefault =
      typeof SHARED_METADATA.title === "object" && SHARED_METADATA.title !== null && "default" in SHARED_METADATA.title
        ? String(SHARED_METADATA.title.default)
        : "";
    expect(titleDefault).not.toMatch(/3d printing/i);
    expect(String(SHARED_METADATA.description)).not.toMatch(/3d printing/i);
  });

  it("manifest.ts fallback does not mention 3D printing", () => {
    const content = readFileSync("src/app/manifest.ts", "utf8");
    expect(content).not.toMatch(/3d printing/i);
  });

  it("OG image fallbacks do not hardcode 3D printing", () => {
    const productOg = readFileSync("src/app/[locale]/(v2)/product/[slug]/opengraph-image.tsx", "utf8");
    const blogOg = readFileSync("src/app/[locale]/(v2)/blog/[slug]/opengraph-image.tsx", "utf8");
    expect(productOg).not.toMatch(/3d printing/i);
    expect(blogOg).not.toMatch(/3d printing/i);
  });

  it("layout.tsx passes localized tFooter('tagline') to Footer, not settings.tagline", () => {
    const layout = readFileSync("src/app/[locale]/(v2)/layout.tsx", "utf8");
    expect(layout).toMatch(/tagline=\{tFooter\("tagline"\)\}/);
    expect(layout).not.toMatch(/tagline=\{settings\.tagline\}/);
  });

  it("all 9 locale message catalogs have a non-empty Footer.tagline", () => {
    const messagesDir = "messages";
    const files = readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(9);

    for (const file of files) {
      const content = JSON.parse(readFileSync(join(messagesDir, file), "utf8"));
      expect(content.Footer?.tagline).toBeDefined();
      expect(typeof content.Footer?.tagline).toBe("string");
      expect(content.Footer.tagline.trim().length).toBeGreaterThan(0);
      expect(content.Footer.tagline).not.toMatch(/3d printing/i);
    }
  });
});
