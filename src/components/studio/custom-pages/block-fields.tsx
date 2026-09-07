"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";

import { saveCustomBlock } from "@/actions/custom-pages";
import type {
  BlockPickers,
  BlockRow,
} from "@/components/studio/custom-pages/block-board";
import { ProductPicker } from "@/components/studio/custom-pages/product-picker";
import { MediaPicker } from "@/components/studio/media/media-picker";
import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { TranslationsSection } from "@/components/studio/translations-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOM_BLOCKS,
  describeBlockDataProblem,
  parseBlockData,
  type CustomBlockType,
} from "@/lib/custom-blocks";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { toTranslationsRecord } from "@/lib/translations-form";
import { cn } from "@/lib/utils";

/**
 * One block's fields.
 *
 * Written as an explicit switch rather than a generic renderer driven by field
 * descriptors. Sixteen blocks is still small enough that the switch reads
 * faster than the abstraction, and the fields genuinely differ: a product
 * grid needs a mode and a slug list, a picture block needs a library picker,
 * a film block a video picker and a poster, the FAQ block needs the questions
 * that already exist. A descriptor language rich enough for all of that is a
 * worse thing to maintain than sixteen small forms.
 */
export function BlockFields({
  block,
  pickers,
}: {
  block: BlockRow;
  pickers: BlockPickers;
}) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown>>(() =>
    parseBlockData(block.type, block.data),
  );
  const [translations, setTranslations] = useState(() =>
    toTranslationsRecord(block.translations),
  );
  const [saving, setSaving] = useState(false);

  const def = CUSTOM_BLOCKS[block.type];
  const problem = describeBlockDataProblem(block.type, data);

  function set(field: string, value: unknown) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    const res = await saveCustomBlock({ id: block.id, data, translations });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Block saved.");
    router.refresh();
  }

  const id = (field: string) => `blk-${block.id}-${field}`;

  return (
    <div className="space-y-5">
      {block.type === "hero" && (
        <>
          <ImageField
            id={id("image")}
            label="Picture"
            value={String(data.image ?? "")}
            alt={String(data.imageAlt ?? "")}
            onChange={(url) => set("image", url)}
            onAltChange={(alt) => set("imageAlt", alt)}
          />
          <TextField
            id={id("eyebrow")}
            label="Eyebrow"
            hint="The small line above the headline."
            value={String(data.eyebrow ?? "")}
            onChange={(v) => set("eyebrow", v)}
          />
          <TextField
            id={id("headline")}
            label="Headline"
            value={String(data.headline ?? "")}
            onChange={(v) => set("headline", v)}
          />
          <AreaField
            id={id("body")}
            label="Opening words"
            value={String(data.body ?? "")}
            onChange={(v) => set("body", v)}
          />
          <CtaFields data={data} set={set} id={id} />
        </>
      )}

      {block.type === "richText" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <div className="space-y-2">
            <Label>Words</Label>
            <RichTextEditor
              value={data.body as Record<string, unknown>}
              onChange={(next) => set("body", next)}
            />
          </div>
        </>
      )}

      {block.type === "productGrid" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("intro")}
            label="Intro"
            value={String(data.intro ?? "")}
            onChange={(v) => set("intro", v)}
          />
          <div className="space-y-2">
            <Label htmlFor={id("mode")}>Which pieces</Label>
            <select
              id={id("mode")}
              value={String(data.mode ?? "featured")}
              onChange={(e) => set("mode", e.target.value)}
              className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
            >
              <option value="featured">The pieces marked featured</option>
              <option value="category">Everything in one category</option>
              <option value="manual">Ones I choose</option>
            </select>
          </div>

          {data.mode === "category" && (
            <div className="space-y-2">
              <Label htmlFor={id("category")}>Category</Label>
              <select
                id={id("category")}
                value={String(data.category ?? "")}
                onChange={(e) => set("category", e.target.value)}
                className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
              >
                <option value="">Pick one…</option>
                {pickers.categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {data.mode === "manual" && (
            <ProductPicker
              chosen={Array.isArray(data.slugs) ? (data.slugs as string[]) : []}
              onChange={(next) => set("slugs", next)}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor={id("limit")}>How many</Label>
            <Input
              id={id("limit")}
              type="number"
              min={2}
              max={12}
              value={Number(data.limit ?? 4)}
              onChange={(e) => set("limit", Number(e.target.value))}
              className="w-28"
            />
          </div>
        </>
      )}

      {block.type === "imageCta" && (
        <>
          <ImageField
            id={id("image")}
            label="Picture"
            value={String(data.image ?? "")}
            alt={String(data.imageAlt ?? "")}
            onChange={(url) => set("image", url)}
            onAltChange={(alt) => set("imageAlt", alt)}
          />
          <div className="space-y-2">
            <Label htmlFor={id("side")}>Picture side</Label>
            <select
              id={id("side")}
              value={String(data.imageSide ?? "start")}
              onChange={(e) => set("imageSide", e.target.value)}
              className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
            >
              <option value="start">
                Before the words (left, or right in Arabic)
              </option>
              <option value="end">
                After the words (right, or left in Arabic)
              </option>
            </select>
          </div>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("body")}
            label="Words"
            value={String(data.body ?? "")}
            onChange={(v) => set("body", v)}
          />
          <CtaFields data={data} set={set} id={id} />
        </>
      )}

      {block.type === "faqPicker" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <fieldset className="space-y-2">
            <legend className="text-small font-medium text-foreground">
              Questions
            </legend>
            <p className="text-xs text-graphite">
              These come from the FAQ screen — answer it there once and reuse it
              here. Nothing is duplicated.
            </p>
            {pickers.faqs.length === 0 ? (
              <p className="text-xs text-graphite">
                No questions answered yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {pickers.faqs.map((faq) => {
                  const chosen = Array.isArray(data.faqIds)
                    ? (data.faqIds as string[])
                    : [];
                  const on = chosen.includes(faq.id);
                  return (
                    <li key={faq.id}>
                      <label className="flex items-start gap-2 text-small">
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          checked={on}
                          onChange={() =>
                            set(
                              "faqIds",
                              on
                                ? chosen.filter((c) => c !== faq.id)
                                : [...chosen, faq.id],
                            )
                          }
                        />
                        <span>{faq.question}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
        </>
      )}

      {block.type === "finalCta" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("body")}
            label="Words"
            value={String(data.body ?? "")}
            onChange={(v) => set("body", v)}
          />
          <label className="flex items-start gap-2 text-small">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={Boolean(data.whatsapp)}
              onChange={(e) => set("whatsapp", e.target.checked)}
            />
            <span>
              Send the button to WhatsApp
              <span className="block text-xs text-graphite">
                Uses the studio&rsquo;s number, so it stays right if the number
                ever changes.
              </span>
            </span>
          </label>
          {!data.whatsapp && <CtaFields data={data} set={set} id={id} />}
          {data.whatsapp && (
            <TextField
              id={id("ctaLabel")}
              label="Button label"
              value={String(data.ctaLabel ?? "")}
              onChange={(v) => set("ctaLabel", v)}
            />
          )}
        </>
      )}

      {block.type === "collectionGrid" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("intro")}
            label="Intro"
            value={String(data.intro ?? "")}
            onChange={(v) => set("intro", v)}
          />
          <fieldset className="space-y-2">
            <legend className="text-small font-medium text-foreground">
              Collections
            </legend>
            <p className="text-xs text-graphite">
              Up to six, in the order they should read.
            </p>
            <CollectionSlugPicker
              chosen={Array.isArray(data.slugs) ? (data.slugs as string[]) : []}
              onChange={(next) => set("slugs", next)}
              options={pickers.categories}
            />
          </fieldset>
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "portfolioGrid" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("intro")}
            label="Intro"
            value={String(data.intro ?? "")}
            onChange={(v) => set("intro", v)}
          />
          <div className="space-y-2">
            <Label htmlFor={id("mode")}>Which case studies</Label>
            <select
              id={id("mode")}
              value={String(data.mode ?? "recent")}
              onChange={(e) => set("mode", e.target.value)}
              className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
            >
              <option value="recent">The newest published</option>
              <option value="manual">Ones I choose</option>
            </select>
          </div>
          {data.mode === "manual" && (
            <SlugListField
              id={id("slugs")}
              label="Case study slugs"
              hint="The last part of the commission's web address, one per line — e.g. seaside-shell-candle. Up to six, read in this order."
              value={Array.isArray(data.slugs) ? (data.slugs as string[]) : []}
              onChange={(next) => set("slugs", next)}
              max={6}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor={id("limit")}>How many</Label>
            <Input
              id={id("limit")}
              type="number"
              min={2}
              max={6}
              value={Number(data.limit ?? 4)}
              onChange={(e) => set("limit", Number(e.target.value))}
              className="w-28"
            />
          </div>
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "journalGrid" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("intro")}
            label="Intro"
            value={String(data.intro ?? "")}
            onChange={(v) => set("intro", v)}
          />
          <TextField
            id={id("categorySlug")}
            label="Journal category (optional)"
            hint="The category's slug, e.g. gift-guides. Leave blank for the newest posts across every category."
            value={String(data.categorySlug ?? "")}
            onChange={(v) => set("categorySlug", v)}
          />
          <div className="space-y-2">
            <Label htmlFor={id("limit")}>How many</Label>
            <Input
              id={id("limit")}
              type="number"
              min={2}
              max={6}
              value={Number(data.limit ?? 4)}
              onChange={(e) => set("limit", Number(e.target.value))}
              className="w-28"
            />
          </div>
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "testimonial" && (
        <>
          <TextField
            id={id("testimonialId")}
            label="Testimonial id"
            hint="The id column on the testimonials list — the last segment of its edit link, /studio/testimonials/<this>. Must be a PUBLISHED testimonial or this block shows nothing."
            value={String(data.testimonialId ?? "")}
            onChange={(v) => set("testimonialId", v)}
          />
          <div className="space-y-2">
            <Label htmlFor={id("variant")}>Treatment</Label>
            <select
              id={id("variant")}
              value={String(data.variant ?? "editorial")}
              onChange={(e) => set("variant", e.target.value)}
              className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
            >
              <option value="editorial">Pull-quote card</option>
              <option value="featured">Full-width cinematic quote</option>
            </select>
          </div>
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "testimonialGrid" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <div className="space-y-2">
            <Label htmlFor={id("mode")}>Which testimonials</Label>
            <select
              id={id("mode")}
              value={String(data.mode ?? "featured")}
              onChange={(e) => set("mode", e.target.value)}
              className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
            >
              <option value="featured">The ones marked featured</option>
              <option value="manual">Ones I choose</option>
            </select>
          </div>
          {data.mode === "manual" && (
            <SlugListField
              id={id("ids")}
              label="Testimonial ids"
              hint="One per line — the last segment of each row's edit link, /studio/testimonials/<this>. Up to six, shown in this order where the layout allows it."
              value={Array.isArray(data.ids) ? (data.ids as string[]) : []}
              onChange={(next) => set("ids", next)}
              max={6}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor={id("limit")}>How many</Label>
            <Input
              id={id("limit")}
              type="number"
              min={2}
              max={6}
              value={Number(data.limit ?? 4)}
              onChange={(e) => set("limit", Number(e.target.value))}
              className="w-28"
            />
          </div>
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "videoHero" && (
        <>
          <VideoField
            id={id("videoUrl")}
            label="Video"
            value={String(data.videoUrl ?? "")}
            onChange={(v) => set("videoUrl", v)}
          />
          <ImageField
            id={id("posterUrl")}
            label="Poster (shown while the film loads, and instead of it on phones)"
            value={String(data.posterUrl ?? "")}
            alt={String(data.imageAlt ?? "")}
            onChange={(url) => set("posterUrl", url)}
            onAltChange={(alt) => set("imageAlt", alt)}
          />
          <TextField
            id={id("eyebrow")}
            label="Eyebrow"
            hint="The small line above the headline."
            value={String(data.eyebrow ?? "")}
            onChange={(v) => set("eyebrow", v)}
          />
          <TextField
            id={id("headline")}
            label="Headline"
            value={String(data.headline ?? "")}
            onChange={(v) => set("headline", v)}
          />
          <AreaField
            id={id("body")}
            label="Opening words"
            value={String(data.body ?? "")}
            onChange={(v) => set("body", v)}
          />
          <CtaFields data={data} set={set} id={id} />
        </>
      )}

      {block.type === "masonryGallery" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <GalleryImagesField
            idPrefix={id("images")}
            label="Pictures"
            hint="Up to twelve. Tiles stagger through four shapes in the order you list them; a caption is optional and shows under its picture as written."
            value={asGalleryImages(data.images)}
            max={12}
            onChange={(next) => set("images", next)}
          />
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "bentoGallery" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <GalleryImagesField
            idPrefix={id("images")}
            label="Pictures"
            hint="Up to six. The first picture is the large tile; the rest sit beside and under it in the order you list them."
            value={asGalleryImages(data.images)}
            max={6}
            onChange={(next) => set("images", next)}
          />
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {block.type === "fullscreenGallery" && (
        <>
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <GalleryImagesField
            idPrefix={id("images")}
            label="Pictures"
            hint="Up to twelve square thumbnails; each opens full-screen with keyboard stepping. The description doubles as the full-screen title, so write one for every picture."
            value={asGalleryImages(data.images)}
            max={12}
            onChange={(next) => set("images", next)}
          />
        </>
      )}

      {block.type === "videoStory" && (
        <>
          <VideoField
            id={id("videoUrl")}
            label="Video"
            value={String(data.videoUrl ?? "")}
            onChange={(v) => set("videoUrl", v)}
          />
          <ImageField
            id={id("posterUrl")}
            label="Poster (shown while the film loads, and instead of it on phones)"
            value={String(data.posterUrl ?? "")}
            alt={String(data.imageAlt ?? "")}
            onChange={(url) => set("posterUrl", url)}
            onAltChange={(alt) => set("imageAlt", alt)}
          />
          <TextField
            id={id("heading")}
            label="Heading"
            value={String(data.heading ?? "")}
            onChange={(v) => set("heading", v)}
          />
          <AreaField
            id={id("body")}
            label="Words"
            value={String(data.body ?? "")}
            onChange={(v) => set("body", v)}
          />
          <SpacingField
            id={id("spacing")}
            value={String(data.spacing ?? "standard")}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}

      {def.translatable.length > 0 && (
        <TranslationsSection
          idPrefix={`blk-${block.id}`}
          value={translations}
          onChange={setTranslations}
          fields={def.translatable.map((field) => ({
            ...field,
            base:
              typeof data[field.name] === "string"
                ? (data[field.name] as string)
                : undefined,
          }))}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save block"}
        </Button>
        {problem && <p className="text-small text-alert">{problem}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════ small shared fields ═══════════════════════ */

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-graphite">{hint}</p>}
    </div>
  );
}

function AreaField({
  id,
  label,
  hint,
  rows = 3,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-graphite">{hint}</p>}
    </div>
  );
}

/**
 * A film from the media library (`MediaPicker accept="VIDEO"`, batch D) or a
 * pasted address. The same shape as ImageField without the alt text — the
 * poster next to it carries the description.
 */
function VideoField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          placeholder="Choose from the library, or paste a full https:// address"
          onChange={(e) => onChange(e.target.value)}
        />
        <MediaPicker accept="VIDEO" onSelect={(item) => onChange(item.url)} />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-graphite">
        An MP4 or WebM already uploaded on the Media screen, or one hosted
        elsewhere. Keep it short and silent — it plays muted, and only where
        motion is allowed.
      </p>
    </div>
  );
}

function ImageField({
  id,
  label,
  value,
  alt,
  onChange,
  onAltChange,
}: {
  id: string;
  label: string;
  value: string;
  alt: string;
  onChange: (url: string) => void;
  onAltChange: (alt: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          placeholder="Pick from the library"
          onChange={(e) => onChange(e.target.value)}
        />
        <MediaPicker onSelect={(item) => onChange(item.url)} />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        )}
      </div>
      {value && (
        <div className="relative h-28 w-44 overflow-hidden rounded-lg border border-border">
          <Image
            src={value}
            alt=""
            fill
            sizes="176px"
            unoptimized={!isOptimizableImageSrc(value)}
            className="object-cover"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${id}-alt`}>What the picture shows</Label>
        <Input
          id={`${id}-alt`}
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
        />
        <p className="text-xs text-graphite">
          Describe the picture for someone who cannot see it. Leave blank only
          when it is purely decorative.
        </p>
      </div>
    </div>
  );
}

function CtaFields({
  data,
  set,
  id,
}: {
  data: Record<string, unknown>;
  set: (field: string, value: unknown) => void;
  id: (field: string) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id={id("ctaLabel")}
        label="Button label"
        value={String(data.ctaLabel ?? "")}
        onChange={(v) => set("ctaLabel", v)}
      />
      <TextField
        id={id("ctaHref")}
        label="Button goes to"
        hint="A page on this site, like /shop, or a full https:// address."
        value={String(data.ctaHref ?? "")}
        onChange={(v) => set("ctaHref", v)}
      />
    </div>
  );
}

/** The spacing choice every catalogue-growth block offers — never
 *  `section-major`, which is reserved for a page's two hand-built moments. */
function SpacingField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Spacing</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-input border border-border bg-transparent px-3 text-small"
      >
        <option value="standard">Standard</option>
        <option value="compact">Compact</option>
      </select>
    </div>
  );
}

/**
 * A plain-text fallback for "pick some rows by slug or id", one per line.
 *
 * `ProductPicker` (search, thumbnails, ordering) is the pattern the plan asks
 * every manual picker here to reuse — but it is built on a search server
 * action scoped to products. Building the same for case studies, testimonials
 * and blog categories means a new server action per entity, and
 * `src/actions/*` carries no owner in this batch's file-ownership table this
 * wave. Until one of those actions exists, an owner types what they typed
 * everywhere else on this screen before the picker shipped: the last part of
 * the row's own web address. Local state, not the parent's — so a half-typed
 * line is not re-split into an array on every keystroke.
 */
type GalleryImageValue = { url: string; alt: string; caption: string };

/** The stored array as the editor's own shape — tolerant of a row written by
 *  an older shape or by hand, never throwing on it. */
function asGalleryImages(value: unknown): GalleryImageValue[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      url: typeof row.url === "string" ? row.url : "",
      alt: typeof row.alt === "string" ? row.alt : "",
      caption: typeof row.caption === "string" ? row.caption : "",
    };
  });
}

/**
 * An ordered, capped list of pictures for the gallery blocks: each row is a
 * library pick (or a pasted URL), its description and an optional caption,
 * with move/remove controls — the order is the order the storefront renders.
 */
function GalleryImagesField({
  idPrefix,
  label,
  hint,
  value,
  max,
  onChange,
}: {
  idPrefix: string;
  label: string;
  hint?: string;
  value: GalleryImageValue[];
  max: number;
  onChange: (next: GalleryImageValue[]) => void;
}) {
  function update(index: number, patch: Partial<GalleryImageValue>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-graphite">{hint}</p>}
      <ol className="space-y-3">
        {value.map((row, index) => {
          const rowId = `${idPrefix}-${index}`;
          return (
            <li
              key={rowId}
              className="space-y-2 rounded-card border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="u-num text-12 text-graphite">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Input
                  id={`${rowId}-url`}
                  aria-label={`Picture ${index + 1}`}
                  value={row.url}
                  placeholder="Pick from the library"
                  onChange={(e) => update(index, { url: e.target.value })}
                />
                <MediaPicker onSelect={(item) => update(index, { url: item.url })} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Move picture ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Move picture ${index + 1} down`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove picture ${index + 1}`}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
              {row.url && (
                <div className="relative h-24 w-36 overflow-hidden rounded-lg border border-border">
                  <Image
                    src={row.url}
                    alt=""
                    fill
                    sizes="144px"
                    unoptimized={!isOptimizableImageSrc(row.url)}
                    className="object-cover"
                  />
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${rowId}-alt`}>What the picture shows</Label>
                  <Input
                    id={`${rowId}-alt`}
                    value={row.alt}
                    onChange={(e) => update(index, { alt: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${rowId}-caption`}>Caption (optional)</Label>
                  <Input
                    id={`${rowId}-caption`}
                    value={row.caption}
                    onChange={(e) => update(index, { caption: e.target.value })}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value.length >= max}
          onClick={() => onChange([...value, { url: "", alt: "", caption: "" }])}
        >
          Add picture
        </Button>
        <p className="text-xs text-graphite">
          {value.length} of {max}.
        </p>
      </div>
    </div>
  );
}

function SlugListField({
  id,
  label,
  hint,
  value,
  onChange,
  max,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const [text, setText] = useState(value.join("\n"));

  function commit(next: string) {
    setText(next);
    const parsed = [
      ...new Set(
        next
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, max);
    onChange(parsed);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        value={text}
        onChange={(e) => commit(e.target.value)}
      />
      {hint && <p className="text-xs text-graphite">{hint}</p>}
      <p className="text-xs text-graphite">
        {value.length} of {max} picked.
      </p>
    </div>
  );
}

/**
 * An ordered, capped multi-pick from a short fixed list — `pickers.categories`
 * has ~16 rows, small enough that a search box would be overhead. A tag toggles
 * on click; the chosen list keeps ITS OWN order (arrows), because the storefront
 * renders these grids in the order the owner picked, not alphabetically.
 */
function CollectionSlugPicker({
  chosen,
  onChange,
  options,
  max = 6,
}: {
  chosen: string[];
  onChange: (next: string[]) => void;
  options: { slug: string; name: string }[];
  max?: number;
}) {
  const nameOf = (slug: string) =>
    options.find((o) => o.slug === slug)?.name ?? slug;

  function toggle(slug: string) {
    if (chosen.includes(slug)) {
      onChange(chosen.filter((s) => s !== slug));
      return;
    }
    if (chosen.length >= max) return;
    onChange([...chosen, slug]);
  }

  function move(slug: string, delta: number) {
    const next = [...chosen];
    const from = next.indexOf(slug);
    const to = from + delta;
    if (to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {chosen.length === 0 ? (
        <p className="text-xs text-graphite">
          Nothing picked yet — this block will not appear on the page.
        </p>
      ) : (
        <ol className="space-y-1">
          {chosen.map((slug, index) => (
            <li
              key={slug}
              className="flex items-center gap-2 rounded-lg border border-border p-2"
            >
              <span className="min-w-0 flex-1 truncate text-small text-foreground">
                {nameOf(slug)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={index === 0}
                onClick={() => move(slug, -1)}
              >
                <ArrowUp aria-hidden className="size-4" />
                <span className="sr-only">Move {nameOf(slug)} up</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={index === chosen.length - 1}
                onClick={() => move(slug, 1)}
              >
                <ArrowDown aria-hidden className="size-4" />
                <span className="sr-only">Move {nameOf(slug)} down</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => toggle(slug)}
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">Remove {nameOf(slug)}</span>
              </Button>
            </li>
          ))}
        </ol>
      )}
      {options.length === 0 ? (
        <p className="text-xs text-graphite">
          No collections to pick from yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const already = chosen.includes(option.slug);
            const full = !already && chosen.length >= max;
            return (
              <button
                key={option.slug}
                type="button"
                disabled={already || full}
                onClick={() => toggle(option.slug)}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3 text-small transition-colors",
                  already
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground disabled:opacity-50",
                )}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { CustomBlockType };
