import { describe, expect, it } from "vitest";
import { getLqipBlur } from "./lqip";

describe("LQIP Blur Wiring (REDESIGN.md §15.5)", () => {
  it("resolves blurDataURL for bundled v3 master images by pathname", () => {
    const heroBlur = getLqipBlur("/media/v3/hero-pour.avif");
    expect(heroBlur).toBeDefined();
    expect(heroBlur).toMatch(/^data:image\/webp;base64,/);

    const tileBlur = getLqipBlur("/media/v3/tile-preserve.avif");
    expect(tileBlur).toBeDefined();
    expect(tileBlur).toMatch(/^data:image\/webp;base64,/);
  });

  it("resolves blurDataURL when given a full absolute URL with the same pathname", () => {
    const blur = getLqipBlur("https://www.rivyalivingart.com/media/v3/story-cure.avif");
    expect(blur).toBeDefined();
    expect(blur).toMatch(/^data:image\/webp;base64,/);
  });

  it("returns undefined for unknown or owner-uploaded images (never paints wrong blur)", () => {
    // Crucial rule: an owner override must not paint master A's blur under photograph B
    expect(getLqipBlur("https://blob.vercel-storage.com/custom-override-123.jpg")).toBeUndefined();
    expect(getLqipBlur("/uploads/user-photo.png")).toBeUndefined();
    expect(getLqipBlur("https://res.cloudinary.com/dhaqpl1kz/image/upload/sample.jpg")).toBeUndefined();
  });

  it("safely handles null, undefined, empty string and non-string inputs", () => {
    expect(getLqipBlur(null)).toBeUndefined();
    expect(getLqipBlur(undefined)).toBeUndefined();
    expect(getLqipBlur("")).toBeUndefined();
    expect(getLqipBlur("   ")).toBeUndefined();
  });
});
