import type { Metadata } from "next";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import { BlogPostForm } from "@/components/studio/blog/blog-post-form";

export const metadata: Metadata = { title: "New post" };

export default async function NewBlogPostPage() {
  const [categories, tags] = await Promise.all([
    db.blogCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="New post"
        description="Posts start as drafts — publish when the story is ready."
      />
      <BlogPostForm categories={categories} tags={tags} />
    </div>
  );
}
