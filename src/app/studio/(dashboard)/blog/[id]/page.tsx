import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import {
  BlogPostForm,
  type BlogPostFormInitial,
} from "@/components/studio/blog/blog-post-form";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [post, categories, collections, tags] = await Promise.all([
    db.blogPost.findUnique({
      where: { id },
      include: { tags: { select: { id: true } } },
    }),
    db.blogCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!post) notFound();

  const initial: BlogPostFormInitial = {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage ?? "",
    authorName: post.authorName,
    blogCategoryId: post.blogCategoryId ?? "",
    categoryId: post.categoryId ?? "",
    tagIds: post.tags.map((tag) => tag.id),
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? "",
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    translations: post.translations,
  };

  return (
    <div>
      <PageHeader
        title={post.title}
        description="Edit the post — changes go live only when saved."
      />
      <BlogPostForm
        categories={categories}
        collections={collections}
        tags={tags}
        post={initial}
      />
    </div>
  );
}
