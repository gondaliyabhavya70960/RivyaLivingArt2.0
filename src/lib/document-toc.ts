/**
 * Anchors and a table of contents for a rendered CMS document.
 *
 * `renderTiptapToHtml` normalises an authored document so its top level is
 * `h2` and emits no ids — which is fine for reading and useless for linking.
 * REDESIGN.md §11.9 asks the article for "a floating table of contents in
 * cols 9–12 with scroll-spy", and §11.10 asks the legal pages for
 * "anchor-linked headings" plus a sticky TOC. Both need the same two things:
 * a stable id on every heading, and a list of those headings in document
 * order.
 *
 * Doing it here rather than in the browser keeps the anchors in the served
 * HTML, so a pasted `…/privacy#how-we-use-your-data` lands on the right
 * paragraph before any JavaScript runs, and a crawler sees the same document
 * a reader does.
 *
 * A string pass rather than a DOM pass on purpose: the callers are server
 * components handing the result to `dangerouslySetInnerHTML`, and pulling a
 * parser into that path would cost more than the regex saves. The input is
 * not arbitrary HTML — it is the output of one fixed Tiptap extension set,
 * already sanitised for hrefs by `tiptap-render.ts`.
 */

export type DocumentHeading = {
  /** The id written onto the heading element — the anchor's fragment. */
  id: string;
  /** Plain text of the heading, entities decoded, markup stripped. */
  text: string;
  /** 2–6, as normalised by `renderTiptapToHtml`. */
  level: number;
};

export type DocumentWithToc = {
  /** The same HTML, with an `id` on every heading that lacked one. */
  html: string;
  /** Every heading in document order. */
  headings: DocumentHeading[];
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** A numeric entity, or the entity verbatim when it names no real code point. */
function codePoint(raw: string, value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return raw;
  try {
    return String.fromCodePoint(value);
  } catch {
    return raw;
  }
}

/** Strip tags and decode the handful of entities Tiptap's serializer emits. */
function toPlainText(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (match, code: string) => codePoint(match, Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) =>
      codePoint(match, Number.parseInt(code, 16)),
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A readable, URL-safe fragment. Latin text slugifies; a script with no
 * ASCII (Arabic, Japanese, Devanagari) would slugify to nothing, so those
 * fall back to a positional id rather than to an empty fragment.
 */
export function headingSlug(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || `section-${index + 1}`;
}

/**
 * Give every heading in a rendered document an id and collect the TOC.
 *
 * Ids are deduplicated with a numeric suffix — two "Overview" headings in one
 * document are legal, two `id="overview"` attributes are not. A heading that
 * already carries an id keeps it and is listed as-is, so an authored anchor
 * always wins.
 */
export function withHeadingAnchors(
  html: string,
  levels: readonly number[] = [2, 3],
): DocumentWithToc {
  const headings: DocumentHeading[] = [];
  const used = new Set<string>();
  let index = 0;

  const nextHtml = html.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, rawLevel: string, attrs: string, inner: string) => {
      const level = Number(rawLevel);
      const text = toPlainText(inner);
      if (!levels.includes(level) || !text) return match;

      const existing = /\sid\s*=\s*["']([^"']+)["']/i.exec(attrs);
      let id = existing?.[1];
      if (!id) {
        const base = headingSlug(text, index);
        id = base;
        let n = 2;
        while (used.has(id)) id = `${base}-${n++}`;
      }
      used.add(id);
      headings.push({ id, text, level });
      index += 1;

      return existing
        ? match
        : `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    },
  );

  return { html: nextHtml, headings };
}
