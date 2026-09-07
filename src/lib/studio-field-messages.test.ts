import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every rule a Studio editor can refuse must have somewhere to say so.
 *
 * This is the gate on the defect this batch introduced and had to fix twice.
 * Mirroring an action's cap into a client schema stops the request — which is
 * the point — but if nothing renders the message, Save becomes a silent
 * no-op, and that is strictly worse than the raw zod toast it replaced. The
 * first browser round found seven such fields; a hand-run sweep found eight
 * more, including two array-level caps that no single control owns. A test is
 * the only thing that keeps the next one from shipping.
 *
 * It reads source rather than rendering: there is no component-test runner in
 * this repo (see CLAUDE.md), and the question — "is this field's error bound
 * to something?" — is answerable from the text.
 */
const FORMS: { name: string; schema: string; renders: string[] }[] = [
  {
    name: "settings",
    schema: "src/components/studio/settings/settings-form.tsx",
    renders: ["src/components/studio/settings/settings-form.tsx"],
  },
  {
    name: "seo",
    schema: "src/components/studio/settings/seo-form.tsx",
    renders: ["src/components/studio/settings/seo-form.tsx"],
  },
  {
    name: "page",
    schema: "src/components/studio/pages/page-form.tsx",
    renders: ["src/components/studio/pages/page-form.tsx"],
  },
  {
    name: "product",
    schema: "src/components/studio/products/product-form/schema.ts",
    // The product's fields are spread across its section components.
    renders: readdirSync(
      join(
        process.cwd(),
        "src",
        "components",
        "studio",
        "products",
        "product-form",
      ),
    )
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => join("src/components/studio/products/product-form", f)),
  },
  {
    name: "testimonial",
    schema: "src/components/studio/testimonials/testimonial-form.tsx",
    renders: ["src/components/studio/testimonials/testimonial-form.tsx"],
  },
  {
    name: "custom-page",
    schema: "src/components/studio/custom-pages/custom-page-form.tsx",
    renders: ["src/components/studio/custom-pages/custom-page-form.tsx"],
  },
  {
    name: "blog",
    schema: "src/components/studio/blog/blog-post-form.tsx",
    renders: ["src/components/studio/blog/blog-post-form.tsx"],
  },
  {
    name: "portfolio",
    schema: "src/components/studio/portfolio/portfolio-form.tsx",
    renders: ["src/components/studio/portfolio/portfolio-form.tsx"],
  },
];

/**
 * Fields whose rule exists but cannot be reached by anything an owner can
 * do. Each needs a reason, so the list cannot quietly absorb a real gap.
 */
const UNREACHABLE: Record<string, string> = {
  "product.confirmRewrite":
    "a boolean; the schema-level refine matches the scan, the field has no rule of its own",
  "testimonial.rating":
    "1–5 from a star control that cannot emit anything else",
};

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** The form's zod object, from `const formSchema = z` to the type below it. */
function schemaBlock(source: string): string {
  const start =
    source.indexOf("const formSchema = z") >= 0
      ? source.indexOf("const formSchema = z")
      : source.indexOf("export const formSchema = z");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("type FormValues", start);
  return source.slice(start, end > 0 ? end : start + 8000);
}

/** Top-level keys in that object whose declaration carries a rule. */
function ruledFields(block: string): string[] {
  const found: string[] = [];
  const keys = [...block.matchAll(/^ {2,4}(\w+):\s*(.*)$/gm)];
  keys.forEach((match, index) => {
    const from = match.index ?? 0;
    const to = keys[index + 1]?.index ?? block.length;
    const declaration = block.slice(from, to);
    if (
      /\.max\(|\.refine\(|\.regex\(|capped\(|cappedText\(|metaText\(|mediaUrl/.test(
        declaration,
      )
    ) {
      found.push(match[1]);
    }
  });
  return found;
}

describe("every refusable field can say why", () => {
  it.each(FORMS)("$name", ({ name, schema, renders }) => {
    const fields = ruledFields(schemaBlock(read(schema)));
    expect(fields.length).toBeGreaterThan(0);

    const markup = renders.map(read).join("\n");
    const unbound = fields.filter((field) => {
      if (UNREACHABLE[`${name}.${field}`]) return false;
      // `errors.x`, `errors?.x`, `formState.errors.x` — the shapes the eight
      // editors use to bind a message to a field.
      return !new RegExp(`errors\\??\\.${field}\\b`).test(markup);
    });
    expect(unbound).toEqual([]);
  });

  it("keeps the unreachable list honest", () => {
    // Each entry names a form that exists and a field that still carries a
    // rule — so a field that later gains a control cannot hide here.
    for (const key of Object.keys(UNREACHABLE)) {
      const [form, field] = key.split(".");
      const entry = FORMS.find((f) => f.name === form);
      expect(entry, `${form} is not a known editor`).toBeDefined();
      expect(
        ruledFields(schemaBlock(read(entry!.schema))),
        `${key} no longer carries a rule`,
      ).toContain(field);
    }
  });
});
