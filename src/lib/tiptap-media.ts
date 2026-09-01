/**
 * Pure Tiptap JSON media extractor for the studio delete guards.
 *
 * Traverses an arbitrary Tiptap JSON node or document tree (including
 * nested containers, blockquotes, lists, and translations) and extracts
 * all image URLs declared in `{ type: "image", attrs: { src: "..." } }`.
 *
 * Keeps this logic pure and isolated from database queries or server-only
 * boundaries so it can be tested without mocking or engine spin-up.
 */

export function extractTiptapImageUrls(doc: unknown): string[] {
  const urls: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const n = node as Record<string, unknown>;

    if (
      n.type === "image" &&
      typeof n.attrs === "object" &&
      n.attrs !== null
    ) {
      const attrs = n.attrs as Record<string, unknown>;
      if (typeof attrs.src === "string") {
        const src = attrs.src.trim();
        if (src.length > 0) {
          urls.push(src);
        }
      }
    }

    // Recurse into content array or any nested object properties
    // (e.g. translation overlays, custom block payloads)
    for (const key of Object.keys(n)) {
      if (key === "attrs") continue;
      const child = n[key];
      if (child && typeof child === "object") {
        walk(child);
      }
    }
  }

  walk(doc);
  return urls;
}
