import { describe, expect, it, vi } from "vitest";

// media-ingest.ts opens with `import "server-only"` — a real guard in the
// Next.js webpack build (it aliases the bare specifier to a bundled shim,
// see next/dist/build/webpack-config.js) but not an installed npm package,
// so plain Vite/Node module resolution cannot find it. Mocking it to an
// empty module is the same substitution Next's bundler performs; it does
// not touch server-only's actual guarantee (nothing here runs client-side —
// this is a Vitest process, not a browser bundle).
vi.mock("server-only", () => ({}));

const {
  MediaTypeMismatchError,
  finalizeAsset,
  sniffContentType,
  validateDeclaredType,
} = await import("./media-ingest");

// Byte fixtures — no files on disk. Each is the shortest buffer that still
// satisfies sniffContentType's own offsets, built the same way the format's
// spec builds it (an ISO-BMFF ftyp box, a RIFF chunk, …) rather than copied
// from a real file.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const GLB = Buffer.from("glTF", "ascii");

function ftypBox(brand: string): Buffer {
  // [box size: 4 bytes, unused here][ "ftyp" ][ major brand, 4 chars ]
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x1c]),
    Buffer.from("ftyp", "ascii"),
    Buffer.from(brand, "ascii"),
  ]);
}

function riffWebp(): Buffer {
  return Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // chunk size — unread by the sniff
    Buffer.from("WEBP", "ascii"),
  ]);
}

const AVIF = ftypBox("avif");
const AVIS = ftypBox("avis");
const MP4_ISOM = ftypBox("isom");
const MP4_MP42 = ftypBox("mp42");
const WEBP = riffWebp();

// A zip's own magic bytes — what a USDZ, a .docx or an ordinary .zip all
// start with. Used to prove sniffContentType does NOT invent a USDZ answer
// and that validateDeclaredType trusts the declaration for USDZ regardless.
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

describe("sniffContentType", () => {
  it("reads JPEG from FF D8 FF", () => {
    expect(sniffContentType(JPEG)).toBe("image/jpeg");
  });

  it("reads PNG from the eight-byte signature", () => {
    expect(sniffContentType(PNG)).toBe("image/png");
  });

  it("reads WebP from RIFF…WEBP", () => {
    expect(sniffContentType(WEBP)).toBe("image/webp");
  });

  it("reads AVIF from an ftyp box branded avif or avis", () => {
    expect(sniffContentType(AVIF)).toBe("image/avif");
    expect(sniffContentType(AVIS)).toBe("image/avif");
  });

  it("reads MP4 from an ftyp box branded isom/mp42/avc1/iso5", () => {
    expect(sniffContentType(MP4_ISOM)).toBe("video/mp4");
    expect(sniffContentType(MP4_MP42)).toBe("video/mp4");
    expect(sniffContentType(ftypBox("avc1"))).toBe("video/mp4");
    expect(sniffContentType(ftypBox("iso5"))).toBe("video/mp4");
  });

  it("reads WebM from the EBML header", () => {
    expect(sniffContentType(WEBM)).toBe("video/webm");
  });

  it("reads GLB from the glTF magic", () => {
    expect(sniffContentType(GLB)).toBe("model/gltf-binary");
  });

  it("does not mistake an ftyp box with an unknown brand for anything", () => {
    expect(sniffContentType(ftypBox("qt  "))).toBeNull();
  });

  it("does not read a USDZ (zip) signature as any of the seven types", () => {
    expect(sniffContentType(ZIP)).toBeNull();
  });

  it("returns null for unrecognized bytes", () => {
    expect(
      sniffContentType(Buffer.from("not a media file", "utf8")),
    ).toBeNull();
  });

  it("returns null for a buffer too short to carry any signature", () => {
    expect(sniffContentType(Buffer.alloc(0))).toBeNull();
    expect(sniffContentType(Buffer.from([0x00]))).toBeNull();
  });

  it("does not throw on a buffer shorter than the ftyp/RIFF offsets it checks", () => {
    // 4 bytes is enough for the JPEG/PNG/WebM/GLB checks but short of the
    // 12 the RIFF/ftyp checks read at — this must fall through to null
    // rather than reading past the end of the buffer.
    expect(sniffContentType(Buffer.from([0x00, 0x00, 0x00, 0x00]))).toBeNull();
  });
});

describe("validateDeclaredType", () => {
  it("accepts every family when the bytes back up the declaration", () => {
    expect(() => validateDeclaredType(JPEG, "image/jpeg")).not.toThrow();
    expect(() => validateDeclaredType(PNG, "image/png")).not.toThrow();
    expect(() => validateDeclaredType(WEBP, "image/webp")).not.toThrow();
    expect(() => validateDeclaredType(AVIF, "image/avif")).not.toThrow();
    expect(() => validateDeclaredType(MP4_ISOM, "video/mp4")).not.toThrow();
    expect(() => validateDeclaredType(WEBM, "video/webm")).not.toThrow();
    expect(() => validateDeclaredType(GLB, "model/gltf-binary")).not.toThrow();
  });

  it("accepts a same-family mismatch (a real PNG declared as webp)", () => {
    // The guard is FAMILY-level (image vs video vs model), not exact
    // subtype — sharp reads the real bytes regardless of the declared
    // subtype, and this function only guards against the case that
    // matters: a different kind of payload entirely.
    expect(() => validateDeclaredType(PNG, "image/webp")).not.toThrow();
  });

  it("rejects a video declared as an image", () => {
    expect(() => validateDeclaredType(MP4_ISOM, "image/jpeg")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("rejects a model declared as an image", () => {
    expect(() => validateDeclaredType(GLB, "image/png")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("rejects an image declared as a video", () => {
    expect(() => validateDeclaredType(JPEG, "video/mp4")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("rejects unrecognized bytes declared as a known family", () => {
    const bytes = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    expect(() => validateDeclaredType(bytes, "image/png")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("carries the declared and sniffed types on the thrown error", () => {
    try {
      validateDeclaredType(MP4_ISOM, "image/jpeg");
      expect.unreachable("expected a MediaTypeMismatchError");
    } catch (error) {
      expect(error).toBeInstanceOf(MediaTypeMismatchError);
      const err = error as InstanceType<typeof MediaTypeMismatchError>;
      expect(err.declared).toBe("image/jpeg");
      expect(err.sniffed).toBe("video/mp4");
      expect(err.message).toMatch(/image\/jpeg/);
      expect(err.message).toMatch(/video\/mp4/);
    }
  });

  it("names the mismatch as unrecognized when nothing was sniffed", () => {
    try {
      validateDeclaredType(Buffer.from("nope", "utf8"), "video/webm");
      expect.unreachable("expected a MediaTypeMismatchError");
    } catch (error) {
      const err = error as InstanceType<typeof MediaTypeMismatchError>;
      expect(err.sniffed).toBeNull();
      expect(err.message).toMatch(/unrecognized/i);
    }
  });

  it("accepts a declared USDZ on the declaration alone — a zip's magic bytes prove nothing", () => {
    // USDZ is a zip container; ZIP's own signature (PK..) is not one of the
    // seven this module sniffs, so a byte-level check could never tell a
    // real USDZ apart from any other zip. Declared USDZ skips the check
    // entirely rather than rejecting every real one.
    expect(() => validateDeclaredType(ZIP, "model/vnd.usdz+zip")).not.toThrow();
    // Even bytes that sniff as something else entirely don't matter — USDZ
    // is never compared against the sniff result.
    expect(() =>
      validateDeclaredType(JPEG, "model/vnd.usdz+zip"),
    ).not.toThrow();
  });

  it("passes through a declared type outside image/video/model unexamined", () => {
    // Nothing in this module claims to sniff a PDF or any other document
    // type, so there is nothing to compare against — it is not this
    // function's job to reject a type it was never asked to verify.
    expect(() => validateDeclaredType(JPEG, "application/pdf")).not.toThrow();
  });
});

describe("finalizeAsset — declared/actual type guard", () => {
  it("rejects a spoofed upload before touching the file at all", async () => {
    // A non-image mismatch never reaches the sharp branch, so this proves
    // the guard runs first without needing a decodable image fixture.
    await expect(finalizeAsset(MP4_ISOM, "image/jpeg")).rejects.toBeInstanceOf(
      MediaTypeMismatchError,
    );
  });

  it("resolves for a model whose bytes back up the declared type", async () => {
    const facts = await finalizeAsset(GLB, "model/gltf-binary");
    expect(facts.checksum).toHaveLength(64); // sha256 hex
    expect(facts.width).toBeNull();
    expect(facts.height).toBeNull();
    expect(facts.dominantHex).toBeNull();
  });

  it("resolves for a declared USDZ regardless of its bytes", async () => {
    const facts = await finalizeAsset(ZIP, "model/vnd.usdz+zip");
    expect(facts.checksum).toHaveLength(64);
  });
});
