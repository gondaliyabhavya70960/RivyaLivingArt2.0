/**
 * Tiptap JSON → HTML for public pages (server-only: imports the Node
 * build of @tiptap/html — never import this from a client component).
 * The extension list mirrors the studio rich-text editor
 * (src/components/studio/rich-text-editor.tsx) so everything an admin
 * can author renders faithfully on the public site.
 */

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

const EXTENSIONS = [
  // StarterKit v3 bundles its own Link; disabled so the configured
  // instance below is the only one registered (same as the editor).
  StarterKit.configure({ link: false }),
  Link.configure({ openOnClick: false }),
  Image,
];

/**
 * Allow only http(s)/mailto/tel and scheme-less (relative/anchor) hrefs. A
 * value carrying any other scheme — javascript:, data:, vbscript:, file: — is
 * rejected. Whitespace and C0 control chars are stripped first so obfuscated
 * schemes (e.g. "java\tscript:" or " javascript:") can't slip through.
 */
function isSafeHref(value: string): boolean {
  const s = value.replace(/\s+/g, "").toLowerCase();
  if (/^(?:https?:|mailto:|tel:)/.test(s)) return true;
  // No leading "scheme:" at all → relative / anchor / query → safe.
  return !/^[a-z][a-z0-9+.-]*:/.test(s);
}

/**
 * Post-process the serialized HTML to neutralize dangerous link hrefs
 * (stored-XSS via javascript: etc., SEC-006). Tiptap's link mark serializes
 * the stored href verbatim, so this is the sanitization boundary before
 * dangerouslySetInnerHTML. `on*=` handlers and script tags can't appear from
 * this fixed extension set, so hrefs are the only injectable vector.
 */
function sanitizeGeneratedHtml(html: string): string {
  return html.replace(
    /(\shref\s*=\s*)(["'])([\s\S]*?)\2/gi,
    (match, pre, quote, value) =>
      isSafeHref(value) ? match : `${pre}${quote}#${quote}`,
  );
}

/**
 * Normalize authored headings so the document's outline starts at h2. Every
 * public page renders the document under its own masthead h1, so an authored
 * H1 would duplicate it (Phase 7 a11y review) — and a document whose top
 * level is H2 must NOT be demoted to h3, or the outline skips a level
 * (Part 0 audit: Lighthouse heading-order on blog posts). The whole document
 * shifts by one delta (top level → 2), preserving relative structure and
 * clamping at h6. Single regex pass, so no level ever shifts twice.
 */
function normalizeHeadings(html: string): string {
  const levels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) =>
    Number(m[1]),
  );
  if (!levels.length) return html;
  const delta = 2 - Math.min(...levels);
  if (delta === 0) return html;
  return html.replace(
    /<(\/?)h([1-6])(?=[\s>])/gi,
    (_, close, level) =>
      `<${close}h${Math.min(6, Math.max(2, Number(level) + delta))}`,
  );
}

/**
 * Render stored Page/BlogPost content (Tiptap `{ type: "doc", … }` JSON)
 * to an HTML string for `dangerouslySetInnerHTML`. Anything that is not a
 * valid document — the Prisma default `{}`, null, corrupted JSON — falls
 * back to an empty paragraph instead of throwing during render.
 */
export function renderTiptapToHtml(content: unknown): string {
  if (
    !content ||
    typeof content !== "object" ||
    Array.isArray(content) ||
    !("type" in content)
  ) {
    return "<p></p>";
  }
  try {
    return normalizeHeadings(
      sanitizeGeneratedHtml(
        generateHTML(content as Parameters<typeof generateHTML>[0], EXTENSIONS),
      ),
    );
  } catch {
    return "<p></p>";
  }
}

/**
 * Scoped typography for rendered legal/long-form documents on light
 * (porcelain/ice) bands — apply to the wrapper `<div>` that receives the
 * generated HTML. Descendant selectors instead of a typography plugin.
 */
export const PROSE_LEGAL_CLASS = [
  "mx-auto max-w-3xl",
  /* No [&_h1] rules: renderTiptapToHtml normalizes authored headings, so the
     generated document starts at h2. */
  "[&_h2]:font-display [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:text-foreground",
  "[&_h3]:font-display [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:text-foreground",
  "[&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-foreground/75",
  "[&_li]:mt-2 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-6",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:ps-6",
  "[&_a]:text-sapphire-ink [&_a]:underline",
  "[&_blockquote]:mt-6 [&_blockquote]:border-s-2 [&_blockquote]:border-sapphire/40 [&_blockquote]:ps-4 [&_blockquote]:italic",
  "[&_hr]:my-10 [&_hr]:border-foreground/10",
  "[&_img]:mt-6 [&_img]:max-w-full [&_img]:rounded-xl",
  "[&_strong]:text-foreground",
].join(" ");
