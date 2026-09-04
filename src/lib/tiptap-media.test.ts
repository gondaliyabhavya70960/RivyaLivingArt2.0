import { describe, expect, it, vi } from "vitest";
import { extractTiptapImageUrls } from "./tiptap-media";
import { findMediaUsageDetails, findMediaUsages } from "./media-usages";

describe("extractTiptapImageUrls", () => {
  it("extracts image URLs from standard Tiptap doc structure", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Here is an image:" }],
        },
        {
          type: "image",
          attrs: { src: "https://blob.example/resin-pour.webp", alt: "Pouring resin" },
        },
      ],
    };
    expect(extractTiptapImageUrls(doc)).toEqual(["https://blob.example/resin-pour.webp"]);
  });

  it("extracts deeply nested images inside lists, blockquotes and custom containers", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "orderedList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "image",
                      attrs: { src: "https://blob.example/step1.webp" },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "image",
          attrs: { src: "https://blob.example/step2.webp" },
        },
      ],
    };
    expect(extractTiptapImageUrls(doc)).toEqual([
      "https://blob.example/step1.webp",
      "https://blob.example/step2.webp",
    ]);
  });

  it("extracts images from translation overlays and custom block payloads", () => {
    const payload = {
      heading: "Custom Block",
      body: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://blob.example/en-image.webp" },
          },
        ],
      },
      translations: {
        hi: {
          body: {
            type: "doc",
            content: [
              {
                type: "image",
                attrs: { src: "https://blob.example/hi-image.webp" },
              },
            ],
          },
        },
      },
    };
    expect(extractTiptapImageUrls(payload)).toEqual([
      "https://blob.example/en-image.webp",
      "https://blob.example/hi-image.webp",
    ]);
  });

  it("safely handles null, undefined, primitives and malformed objects without throwing", () => {
    expect(extractTiptapImageUrls(null)).toEqual([]);
    expect(extractTiptapImageUrls(undefined)).toEqual([]);
    expect(extractTiptapImageUrls("hello")).toEqual([]);
    expect(extractTiptapImageUrls(123)).toEqual([]);
    expect(extractTiptapImageUrls({})).toEqual([]);
    expect(extractTiptapImageUrls({ type: "image" })).toEqual([]);
    expect(extractTiptapImageUrls({ type: "image", attrs: null })).toEqual([]);
    expect(extractTiptapImageUrls({ type: "image", attrs: { src: "" } })).toEqual([]);
    expect(extractTiptapImageUrls({ type: "image", attrs: { src: 42 } })).toEqual([]);
  });
});

// Mock the database queries that findMediaUsageDetails runs
vi.mock("@/lib/db", () => {
  return {
    db: {
      productImage: { findMany: vi.fn().mockResolvedValue([]) },
      portfolioImage: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([]) },
      blogPost: {
        findMany: vi.fn().mockImplementation((args) => {
          if (args?.select?.coverImage) {
            return Promise.resolve([]);
          }
          if (args?.select?.content) {
            return Promise.resolve([
              {
                title: "Pouring Deep Waves",
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Process photo:" }],
                    },
                    {
                      type: "image",
                      attrs: { src: "https://blob.example/blog-body-waves.webp" },
                    },
                  ],
                },
                translations: {
                  hi: {
                    content: {
                      type: "doc",
                      content: [
                        {
                          type: "image",
                          attrs: { src: "https://blob.example/blog-body-hi.webp" },
                        },
                      ],
                    },
                  },
                },
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      portfolio: { findMany: vi.fn().mockResolvedValue([]) },
      siteSettings: { findMany: vi.fn().mockResolvedValue([]) },
      testimonial: { findMany: vi.fn().mockResolvedValue([]) },
      // B0: two more guarded readers (video posters, research pictures).
      media: { findMany: vi.fn().mockResolvedValue([]) },
      researchRecord: { findMany: vi.fn().mockResolvedValue([]) },
      siteImage: { findMany: vi.fn().mockResolvedValue([]) },
      customPage: { findMany: vi.fn().mockResolvedValue([]) },
      page: {
        findMany: vi.fn().mockResolvedValue([
          {
            title: "Privacy Policy",
            content: {
              type: "doc",
              content: [
                {
                  type: "image",
                  attrs: { src: "https://blob.example/legal-seal.webp" },
                },
              ],
            },
            translations: null,
          },
        ]),
      },
      customBlock: {
        findMany: vi.fn().mockImplementation((args) => {
          const types = args?.where?.type?.in ?? [];
          const blocks = [];
          if (types.includes("hero")) {
            blocks.push({
              type: "hero",
              data: { image: "https://blob.example/hero.webp" },
              page: { title: "Diwali 2026" },
            });
          }
          if (types.includes("richText")) {
            blocks.push({
              type: "richText",
              data: {
                heading: "Our Craft",
                body: {
                  type: "doc",
                  content: [
                    {
                      type: "image",
                      attrs: { src: "https://blob.example/lander-craft.webp" },
                    },
                  ],
                },
              },
              page: { title: "Diwali 2026" },
            });
          }
          return Promise.resolve(blocks);
        }),
      },
    },
  };
});

describe("Phase 2f #2: Tiptap Json image scanning in media-usages", () => {
  it("guards images referenced in BlogPost Tiptap content", async () => {
    const targetUrl = "https://blob.example/blog-body-waves.webp";
    const used = await findMediaUsages([targetUrl]);
    expect(used.has(targetUrl)).toBe(true);

    const details = await findMediaUsageDetails([targetUrl]);
    expect(details.get(targetUrl)).toContain("Blog post · Pouring Deep Waves");
  });

  it("guards images referenced in BlogPost translations Tiptap content", async () => {
    const targetUrl = "https://blob.example/blog-body-hi.webp";
    const used = await findMediaUsages([targetUrl]);
    expect(used.has(targetUrl)).toBe(true);

    const details = await findMediaUsageDetails([targetUrl]);
    expect(details.get(targetUrl)).toContain("Blog post · Pouring Deep Waves");
  });

  it("guards images referenced in Page Tiptap content", async () => {
    const targetUrl = "https://blob.example/legal-seal.webp";
    const used = await findMediaUsages([targetUrl]);
    expect(used.has(targetUrl)).toBe(true);

    const details = await findMediaUsageDetails([targetUrl]);
    expect(details.get(targetUrl)).toContain("Page · Privacy Policy");
  });

  it("guards images referenced in CustomBlock richText body", async () => {
    const targetUrl = "https://blob.example/lander-craft.webp";
    const used = await findMediaUsages([targetUrl]);
    expect(used.has(targetUrl)).toBe(true);

    const details = await findMediaUsageDetails([targetUrl]);
    expect(details.get(targetUrl)).toContain("Landing page · Diwali 2026");
  });
});
