#!/usr/bin/env node
/**
 * Generate the Site Copy slot registry from `messages/en.json`.
 *
 *   node scripts/site-copy-registry.mjs           # write src/lib/site-copy.generated.ts
 *   node scripts/site-copy-registry.mjs --check   # fail if it is out of date
 *
 * Why generated and not hand-written: there are ~1,100 storefront strings. A
 * hand-maintained registry would be stale after the first copy change, and a
 * stale registry is worse than none — it offers the owner fields that no
 * longer exist and hides ones that do.
 *
 * What the generator can decide on its own (namespace → surface, leaf name →
 * kind, ICU placeholders, whether the key is reachable from any component) it
 * decides. What needs a human sentence — a plain-English label, where the
 * string appears, a character budget — comes from the hand-written overlay in
 * `src/lib/site-copy.labels.ts`, which only needs entries where the derived
 * label is not good enough.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "src/lib/site-copy.generated.ts";

/* ───────────────────────── namespace → surface ─────────────────────────
   Shares its vocabulary with SITE_IMAGE_GROUPS wherever the two overlap, so
   the owner learns one set of surface names for words and pictures alike. */
const GROUP_BY_NAMESPACE = {
  Home: "Homepage",
  About: "About",
  Process: "Process",
  Workshops: "Workshops",
  CustomOrder: "Commission",
  LargeFormat: "Large format",
  Contact: "Contact",
  Portfolio: "Portfolio",
  Blog: "Journal",
  Faq: "FAQ",
  Shop: "Shop",
  Product: "Shop",
  Search: "Shop",
  Wishlist: "Shop",
  WhatsAppOrder: "Shop",
  Legal: "Legal",
  Nav: "Site chrome",
  Header: "Site chrome",
  Footer: "Site chrome",
  Newsletter: "Site chrome",
  WhatsApp: "Site chrome",
  Language: "Site chrome",
  Common: "Site chrome",
  Consent: "Site chrome",
  InstagramFeed: "Site chrome",
  NotFound: "System",
  ErrorPage: "System",
  Errors: "System",
  OrderErrors: "System",
  Upload: "System",
};

/** Default character budgets per kind. The overlay overrides where a specific
 *  slot has a tighter measure than its kind implies. */
const MAX_BY_KIND = {
  eyebrow: 48,
  heading: 80,
  body: 400,
  cta: 60,
  label: 60,
  alt: 160,
  meta: 160,
  micro: 200,
};

/** Namespaces whose every string is interface plumbing, not editorial copy. */
const INTERFACE_NAMESPACES = new Set([
  "Common",
  "Errors",
  "OrderErrors",
  "Upload",
  "Consent",
  "Language",
  "ErrorPage",
]);

function kindOf(leaf, path) {
  if (path.includes(".meta.")) return "meta";
  if (/^(alt|.*Alt|.*ImageAlt)$/.test(leaf)) return "alt";
  if (/eyebrow/i.test(leaf)) return "eyebrow";
  if (/(headline|heading|title)$/i.test(leaf)) return "heading";
  if (/(lead|body|copy|intro|blurb|para|p\d)$/i.test(leaf)) return "body";
  if (/(cta|button|action|link|submit|continue|back)$/i.test(leaf)) return "cta";
  if (/(hint|placeholder|note|caption|meta)$/i.test(leaf)) return "micro";
  if (/^(validation|aria|sr)/i.test(leaf)) return "micro";
  if (/label$/i.test(leaf)) return "label";
  return "body";
}

function tierOf(namespace, kind, leaf) {
  if (INTERFACE_NAMESPACES.has(namespace)) return "interface";
  if (kind === "micro") return "interface";
  if (/^(validation|aria|sr)/i.test(leaf)) return "interface";
  return "editorial";
}

/** "heroHeadline" → "Hero headline"; "stage1Title" → "Stage 1 title". */
function humanise(leaf) {
  const spaced = leaf
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** ICU argument names, including plural/select forms. */
function icuVars(value) {
  const out = new Set();
  const re = /\{\s*([a-zA-Z0-9_]+)\s*(?:,|\})/g;
  let m;
  while ((m = re.exec(value))) out.add(m[1]);
  return [...out];
}

/** Markup tags used by t.rich — these map to components and must survive. */
function richTags(value) {
  const out = new Set();
  const re = /<([a-zA-Z][a-zA-Z0-9]*)>/g;
  let m;
  while ((m = re.exec(value))) out.add(m[1]);
  return [...out];
}

/* ───────────────────────── reachability ─────────────────────────
   A key is "reachable" if any suffix of its path appears as a quoted string
   anywhere in src/ — because next-intl translators can be scoped to any
   prefix (`getTranslations("Home")` then `t("hero.headline")`).

   This deliberately OVER-approximates: a generic leaf like "heading" matches
   somewhere and the key is kept. That is the safe direction — offering the
   owner a field that changes nothing is a papercut; hiding a field that works
   is a bug they cannot diagnose. Orphans are reported, never auto-deleted. */
function buildCorpus() {
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "generated" || entry.name === "node_modules") continue;
        walk(path);
      } else if (/\.(tsx?|mjs|js)$/.test(entry.name)) {
        chunks.push(readFileSync(path, "utf8"));
      }
    }
  };
  walk("src");
  return chunks.join("\n");
}

/**
 * Template-literal key patterns, as regexes.
 *
 * Keys are routinely built dynamically — `t(`how.${step}Title`)`,
 * `t(`collections.tiles.${tile.key}.promise`)` — and a literal-only scan
 * misses every one of them. That is the DANGEROUS direction to be wrong in:
 * a false "unreachable" hides a field the owner can really change. So every
 * template literal in the corpus becomes a pattern with its interpolations
 * widened to a wildcard, and a key matching any of them counts as reachable.
 */
function buildTemplatePatterns(corpus) {
  const patterns = [];
  const re = /`([^`\\]*\$\{[^`]*)`/g;
  let match;
  while ((match = re.exec(corpus))) {
    const raw = match[1];
    // Only key-shaped templates: dotted, no spaces, no JSX/markup.
    if (/[\s<>()]/.test(raw.replace(/\$\{[^}]*\}/g, ""))) continue;
    if (!raw.includes(".")) continue;
    const source = raw
      .split(/\$\{[^}]*\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[A-Za-z0-9_]+");
    try {
      patterns.push(new RegExp(`^${source}$`));
    } catch {
      /* an unparseable template is not a key */
    }
  }
  return patterns;
}

function isReachable(corpus, patterns, path) {
  const segments = path.split(".");
  for (let i = 0; i < segments.length; i += 1) {
    const suffix = segments.slice(i).join(".");
    if (corpus.includes(`"${suffix}"`) || corpus.includes(`'${suffix}'`)) {
      return true;
    }
    if (patterns.some((p) => p.test(suffix))) return true;
  }
  return false;
}

/* ───────────────────────── walk the catalogue ───────────────────────── */
function collect() {
  const messages = JSON.parse(readFileSync("messages/en.json", "utf8"));
  const corpus = buildCorpus();
  const patterns = buildTemplatePatterns(corpus);
  const slots = [];

  const walk = (node, trail) => {
    for (const [key, value] of Object.entries(node)) {
      const path = [...trail, key];
      if (typeof value === "string") {
        const [namespace] = path;
        const leaf = path[path.length - 1];
        const full = path.join(".");
        const kind = kindOf(leaf, full);
        const section = path.length > 2 ? path[1] : "general";
        const vars = icuVars(value);
        const tags = richTags(value);
        slots.push({
          key: full,
          group: GROUP_BY_NAMESPACE[namespace] ?? "System",
          section,
          label: humanise(leaf),
          kind,
          tier: tierOf(namespace, kind, leaf),
          max: MAX_BY_KIND[kind],
          ...(vars.length ? { vars } : {}),
          ...(tags.length ? { tags } : {}),
          ...(isReachable(corpus, patterns, full) ? {} : { orphan: true }),
        });
      } else if (value && typeof value === "object") {
        walk(value, path);
      }
    }
  };

  walk(messages, []);
  return slots;
}

function render(slots) {
  const orphans = slots.filter((s) => s.orphan).length;
  const body = slots
    .map((s) => `  ${JSON.stringify(s)},`)
    .join("\n");
  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run \`node scripts/site-copy-registry.mjs\` after changing messages/en.json.
 * CI runs \`--check\` and fails when this file is stale, so a new key cannot
 * ship without a slot for the owner to edit it in.
 *
 * ${slots.length} slots · ${orphans} flagged as unreachable from any component.
 */
import type { CopySlot } from "./site-copy";

export const GENERATED_COPY_SLOTS: readonly CopySlot[] = [
${body}
] as const;
`;
}

const slots = collect();
const output = render(slots);

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (current !== output) {
    console.error(
      `✗ ${OUT} is out of date.\n  Run: node scripts/site-copy-registry.mjs`,
    );
    process.exit(1);
  }
  console.log(`✓ ${OUT} is up to date (${slots.length} slots).`);
} else {
  writeFileSync(OUT, output);
  const orphans = slots.filter((s) => s.orphan);
  const byTier = slots.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✓ ${OUT}`);
  console.log(`  ${slots.length} slots — ${byTier.editorial ?? 0} editorial, ${byTier.interface ?? 0} interface`);
  console.log(`  ${slots.filter((s) => s.vars).length} with ICU placeholders, ${slots.filter((s) => s.tags).length} with markup tags`);
  if (orphans.length) {
    console.log(`  ⚠ ${orphans.length} unreachable from any component:`);
    for (const o of orphans) console.log(`      ${o.key}`);
  }
}
