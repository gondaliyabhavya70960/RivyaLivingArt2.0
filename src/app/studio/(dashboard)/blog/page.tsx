import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { db } from "@/lib/db";
import { ContentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import {
  BlogPostList,
  type BlogPostRow,
} from "@/components/studio/blog/blog-post-list";
import {
  BlogTaxonomyList,
  type TaxonomyRow,
} from "@/components/studio/blog/blog-taxonomy-list";

export const metadata: Metadata = { title: "Blog" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const TABS = [
  { key: "posts", label: "Posts" },
  { key: "categories", label: "Categories" },
  { key: "tags", label: "Tags" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function TabNav({ active }: { active: TabKey }) {
  return (
    <nav
      aria-label="Blog sections"
      className="mb-6 flex w-fit gap-1 rounded-full border border-border bg-card p-1 shadow-e1"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "posts" ? "/studio/blog" : `/studio/blog?tab=${tab.key}`}
          aria-current={active === tab.key ? "page" : undefined}
          className={
            active === tab.key
              ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
              : "rounded-full px-4 py-1.5 text-sm text-foreground/70 transition-colors hover:text-sapphire-ink"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

async function PostsTab({ q, status }: { q?: string; status?: string }) {
  const statusFilter =
    status === ContentStatus.DRAFT || status === ContentStatus.PUBLISHED
      ? status
      : undefined;

  const where: Prisma.BlogPostWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const posts = await db.blogPost.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      blogCategory: { select: { name: true } },
      tags: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });

  const rows: BlogPostRow[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    status: post.status,
    categoryName: post.blogCategory?.name ?? null,
    tagNames: post.tags.map((tag) => tag.name),
    authorName: post.authorName,
    publishedAt: post.publishedAt ? dateFormatter.format(post.publishedAt) : null,
  }));

  return <BlogPostList posts={rows} initialQuery={q ?? ""} />;
}

async function CategoriesTab() {
  const categories = await db.blogCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  const rows: TaxonomyRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    postCount: category._count.posts,
    translations: category.translations,
  }));

  return <BlogTaxonomyList kind="category" rows={rows} />;
}

async function TagsTab() {
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  const rows: TaxonomyRow[] = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    postCount: tag._count.posts,
    translations: tag.translations,
  }));

  return <BlogTaxonomyList kind="tag" rows={rows} />;
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string }>;
}) {
  const { tab: rawTab, q, status } = await searchParams;
  const tab: TabKey =
    rawTab === "categories" || rawTab === "tags" ? rawTab : "posts";

  return (
    <div>
      <PageHeader
        title="Blog"
        description="Stories, care guides and studio news — drafts stay hidden until published."
        actions={
          <Button asChild>
            <Link href="/studio/blog/new">
              <Plus /> New post
            </Link>
          </Button>
        }
      />

      <TabNav active={tab} />

      {tab === "posts" && <PostsTab q={q} status={status} />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "tags" && <TagsTab />}
    </div>
  );
}
