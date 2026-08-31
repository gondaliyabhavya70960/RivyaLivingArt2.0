import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { markdownToTiptap } from "../src/lib/import/parse";
import { slugify } from "../src/lib/slug";
import {
  generatedBlogCover,
  isReplaceableGeneratedCover,
} from "./generated-cover";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CONTENT_DIR = path.join(process.cwd(), "prisma", "blog-content");

/**
 * Seeds the Phase 11 original blog library from prisma/blog-content/*.md.
 * Idempotent (upsert by slug). publishedAt is staggered deterministically
 * across the ~10 months before the anchor date so the journal reads as
 * naturally grown, oldest first in file order.
 */
const ANCHOR = new Date("2026-07-01T09:30:00+05:30");
const STAGGER_DAYS = 5.5;

type FrontMatter = Record<string, string>;

function parseFrontmatter(raw: string): { fm: FrontMatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter block");
  const fm: FrontMatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fm, body: match[2].trim() };
}

async function main() {
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith(".md")).sort();
  if (files.length === 0) throw new Error(`No .md files in ${CONTENT_DIR}`);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, file] of files.entries()) {
    try {
      const raw = await readFile(path.join(CONTENT_DIR, file), "utf8");
      const { fm, body } = parseFrontmatter(raw);
      for (const key of ["title", "slug", "excerpt", "category"]) {
        if (!fm[key]) throw new Error(`missing frontmatter "${key}"`);
      }

      const categorySlug = slugify(fm.category);
      const category = await db.blogCategory.upsert({
        where: { slug: categorySlug },
        update: {},
        create: { name: fm.category, slug: categorySlug },
      });

      const tagNames = (fm.tags ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5);
      const tagIds: string[] = [];
      for (const name of tagNames) {
        const tag = await db.tag.upsert({
          where: { slug: slugify(name) },
          update: {},
          create: { name, slug: slugify(name) },
        });
        tagIds.push(tag.id);
      }

      const content = await markdownToTiptap(body);
      const publishedAt = new Date(
        ANCHOR.getTime() - (files.length - 1 - i) * STAGGER_DAYS * 86_400_000,
      );

      const data = {
        title: fm.title,
        excerpt: fm.excerpt,
        content: content as object,
        authorName: "Rivya Living Art Studio",
        blogCategoryId: category.id,
        status: "PUBLISHED" as const,
        publishedAt,
        seoTitle: fm.seoTitle || fm.title,
        seoDescription: fm.seoDescription || fm.excerpt,
        tags: { set: tagIds.map((id) => ({ id })) },
      };

      // Step-4 generated cover — set on create, and back-fill on update ONLY
      // when the post has no cover OR still holds the machine-set generated
      // CDN URL for this same slug (so the first-party mirror flip can land,
      // IMG-901). An owner-uploaded cover is never clobbered by a re-seed.
      const cover = generatedBlogCover(fm.slug);

      const existing = await db.blogPost.findUnique({ where: { slug: fm.slug } });
      if (existing) {
        const replaceable = isReplaceableGeneratedCover(
          "blog",
          fm.slug,
          existing.coverImage,
        );
        await db.blogPost.update({
          where: { slug: fm.slug },
          data: {
            ...data,
            ...(cover && replaceable && existing.coverImage !== cover
              ? { coverImage: cover }
              : {}),
          },
        });
        updated++;
      } else {
        await db.blogPost.create({
          data: {
            ...data,
            slug: fm.slug,
            ...(cover ? { coverImage: cover } : {}),
            tags: { connect: tagIds.map((id) => ({ id })) },
          },
        });
        created++;
      }
    } catch (e) {
      errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`Blog seed: ${created} created, ${updated} updated, ${errors.length} errors.`);
  for (const err of errors) console.error("  ✗", err);
  if (errors.length > 0) process.exitCode = 1;
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
