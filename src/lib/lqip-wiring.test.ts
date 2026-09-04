import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A resolved site-image slot must never reach a frame without its blur.
 *
 * Batch D taught the resolver to carry a 20px LQIP per slot
 * (`SiteImageRef.blurDataUrl`) and taught `SlotImage`, `HeroMedia` and
 * `MeniscusImage` to paint one. It did not teach the twenty-odd storefront
 * frames that render a slot to HAND one over: they kept passing the bare URL
 * from `getSiteImages()`, so the placeholder was computed on every request
 * and painted nowhere. Nothing failed — a missing placeholder looks exactly
 * like a slot that has none — which is why this is a test and not a comment.
 *
 * The rule has no legitimate exception, and that is what makes it checkable:
 * when a slot genuinely has no recorded placeholder the resolver already says
 * so with a null, and forwarding that null is still correct. So "renders
 * `images[…]` or `imageRefs[…]` without a `blurDataURL` beside it" is always
 * an omission.
 *
 * Deliberately NOT covered: catalog photography on a supplier host, owner
 * uploads reached through a `Media` row, and every `piece.cover` /
 * `post.coverImage` / gallery URL. No placeholder is known for those without
 * a database round trip the render path does not currently make, and
 * inventing one would put the wrong picture's ground behind them.
 */

const V2_ROOT = join(process.cwd(), "src", "app", "[locale]", "(v2)");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/** The slot maps a page holds — the URL narrowing and the full refs. */
const SLOT_SOURCE = /\b(images|imageRefs)\[/;

/**
 * The self-closing JSX element starting at `start`, as source text.
 *
 * These frames carry no children, so the first `/>` after the tag name ends
 * the element. Attribute values here are strings, numbers and braces — none
 * of them contains `/>`.
 */
function elementAt(source: string, start: number): string {
  const end = source.indexOf("/>", start);
  return end === -1 ? source.slice(start) : source.slice(start, end + 2);
}

/** The innermost object literal containing `index`, brace-balanced. */
function enclosingObject(source: string, index: number): string {
  let depth = 0;
  let open = -1;
  for (let i = index; i >= 0; i -= 1) {
    if (source[i] === "}") depth += 1;
    else if (source[i] === "{") {
      if (depth === 0) {
        open = i;
        break;
      }
      depth -= 1;
    }
  }
  if (open === -1) return "";
  depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return source.slice(open);
}

describe("every storefront frame that renders a site-image slot forwards its blur", () => {
  const files = tsxFiles(V2_ROOT);

  it("finds the routes to check", () => {
    // A restructure that empties this list would make every assertion below
    // vacuously pass.
    expect(files.length).toBeGreaterThan(10);
  });

  it("passes blurDataURL on every <Image> / <MeniscusImage> fed from a slot", () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<(MeniscusImage|Image)[\s\n]/g)) {
        const element = elementAt(source, match.index);
        const src = element.match(/src=\{([^\n]*)\}/)?.[1] ?? "";
        if (!SLOT_SOURCE.test(src)) continue;
        if (element.includes("blurDataURL")) continue;
        missing.push(`${file.slice(process.cwd().length + 1)}: src={${src}}`);
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("passes blurDataURL in every props object built from a slot", () => {
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bsrc: (images|imageRefs)\[/g)) {
        const object = enclosingObject(source, match.index);
        if (object.includes("blurDataURL")) continue;
        missing.push(
          `${file.slice(process.cwd().length + 1)}: ${object.slice(0, 120)}`,
        );
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
