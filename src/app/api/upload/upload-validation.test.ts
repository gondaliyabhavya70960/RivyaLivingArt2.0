import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateImageBuffer } from "./route";

describe("Upload magic-byte verification (Prompt 06 #2)", () => {
  it("accepts authentic JPEG image buffer", async () => {
    // Generate minimal 1x1 test image via sharp
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const res = await validateImageBuffer(buf);
    expect(res).toEqual({ format: "jpeg" });
  });

  it("accepts authentic PNG image buffer", async () => {
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const res = await validateImageBuffer(buf);
    expect(res).toEqual({ format: "png" });
  });

  it("accepts authentic WebP image buffer", async () => {
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toBuffer();

    const res = await validateImageBuffer(buf);
    expect(res).toEqual({ format: "webp" });
  });

  it("rejects spoofed text payload masquerading as an image", async () => {
    const spoofed = Buffer.from("Hello world, this is a plain text file pretending to be JPEG");
    const res = await validateImageBuffer(spoofed);
    expect(res).toBeNull();
  });

  it("rejects empty or random non-image bytes", async () => {
    expect(await validateImageBuffer(Buffer.alloc(0))).toBeNull();
    expect(await validateImageBuffer(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
  });
});
