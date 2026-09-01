import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveSafeUploadPath } from "./[...path]/route";

describe("Uploads route path traversal security (Prompt 06 #1)", () => {
  const root = path.resolve(process.cwd(), "public", "uploads");

  it("resolves valid nested files within root", () => {
    const safe = resolveSafeUploadPath(root, ["subfolder", "image.jpg"]);
    expect(safe).toBe(path.join(root, "subfolder", "image.jpg"));
  });

  it("rejects path traversal attempts with .. segments", () => {
    expect(resolveSafeUploadPath(root, ["..", "package.json"])).toBeNull();
    expect(resolveSafeUploadPath(root, ["sub", "..", "..", "etc", "passwd"])).toBeNull();
  });

  it("rejects absolute paths that escape root", () => {
    const absPath = path.resolve(process.cwd(), "package.json");
    expect(resolveSafeUploadPath(root, [absPath])).toBeNull();
  });

  it("rejects exact root directory without file", () => {
    // Must start with root + path.sep, not just root
    expect(resolveSafeUploadPath(root, [])).toBeNull();
  });
});
