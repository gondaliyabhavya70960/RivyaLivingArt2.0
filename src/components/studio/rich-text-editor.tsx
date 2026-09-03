"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import { MediaPicker } from "@/components/studio/media/media-picker";

import {
  PromptDialog,
  validateUrl,
} from "@/components/studio/prompt-dialog";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Image as ImageIcon,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  TextQuote,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Stored content is Tiptap JSON (a `{ type: "doc", … }` object). Anything
 * else — the Prisma default `{}`, null, a stray string — starts the editor
 * empty instead of crashing the schema parser.
 */
function toInitialContent(value: unknown): JSONContent | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "type" in value
  ) {
    return value as JSONContent;
  }
  return null;
}

/**
 * No typography plugin is installed, so the editable area styles its own
 * document nodes (headings, lists, quotes, …) via descendant selectors.
 */
const CONTENT_CLASS = [
  "prose prose-sm max-w-none",
  "min-h-64 px-4 py-3 text-sm text-foreground",
  "[&_.tiptap]:min-h-56 [&_.tiptap]:outline-none",
  "[&_p]:my-2 [&_p]:leading-relaxed",
  "[&_h2]:font-display [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:text-foreground",
  "[&_h3]:font-display [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:text-foreground",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-sapphire-ink/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/70",
  "[&_hr]:my-6 [&_hr]:border-foreground/10",
  "[&_a]:text-sapphire-ink [&_a]:underline [&_a]:underline-offset-4",
  "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_code]:rounded [&_code]:bg-muted/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  // Placeholder extension renders via CSS on the first empty paragraph.
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none",
  "[&_p.is-editor-empty:first-child]:before:float-left",
  "[&_p.is-editor-empty:first-child]:before:h-0",
  "[&_p.is-editor-empty:first-child]:before:text-muted-foreground",
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
].join(" ");

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the selection in the editor when a toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "size-8 rounded-lg text-foreground/70",
        active && "bg-sand text-sapphire-ink hover:bg-sand/50 hover:text-sapphire-ink",
      )}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

/**
 * Shared Tiptap editor for long-form JSON content (blog posts, pages).
 * Emits `editor.getJSON()` on every update; the initial `value` is only
 * read once on mount — remount (key) the component to reset it.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: unknown;
  onChange: (json: object) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    // SSR safety — render nothing on the server, mount on the client.
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 bundles its own Link; disabled so the configured
      // instance below is the only one registered.
      StarterKit.configure({ link: false, heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: toInitialContent(value),
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON()),
    // The contenteditable is a form control to assistive tech; without a
    // name axe reports aria-input-field-name (serious) on every editor screen.
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder ?? "Body",
      },
    },
  });

  // Tiptap v3 does not re-render on transactions by default — subscribe to
  // just the flags the toolbar needs.
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }: { editor: Editor | null }) =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            strike: instance.isActive("strike"),
            h2: instance.isActive("heading", { level: 2 }),
            h3: instance.isActive("heading", { level: 3 }),
            bulletList: instance.isActive("bulletList"),
            orderedList: instance.isActive("orderedList"),
            blockquote: instance.isActive("blockquote"),
            link: instance.isActive("link"),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo(),
          }
        : null,
  });

  /**
   * Link and image used to call `window.prompt`. Both now open a real dialog
   * (`prompt-dialog.tsx` records why), which is also where a URL is checked
   * before it reaches the document. Tiptap already refuses disallowed
   * protocols itself, so this is not what stops a `javascript:` link — it is
   * what TELLS the owner, instead of silently dropping the value.
   */
  const [urlPrompt, setUrlPrompt] = useState<"link" | "image" | null>(null);
  const linkHref = editor
    ? ((editor.getAttributes("link").href as string | undefined) ?? "")
    : "";

  const applyLink = useCallback(
    (url: string) => {
      if (!editor) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    },
    [editor],
  );

  const applyImage = useCallback(
    (url: string) => {
      if (!editor || !url) return;
      editor.chain().focus().setImage({ src: url }).run();
    },
    [editor],
  );

  const handleLink = useCallback(() => setUrlPrompt("link"), []);
  const handleImage = useCallback(() => setUrlPrompt("image"), []);

  const ready = Boolean(editor);

  return (
    <div className="rounded-lg border border-input bg-card transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {/* Keyed on the mode so each opening starts from the right value. */}
      <PromptDialog
        key={urlPrompt ?? "closed"}
        open={urlPrompt !== null}
        onOpenChange={(next) => {
          if (!next) setUrlPrompt(null);
        }}
        title={urlPrompt === "image" ? "Insert an image" : "Link"}
        description={
          urlPrompt === "image"
            ? "Paste the address of an image. Uploads live in the Media Library."
            : "Leave the field empty to remove the link."
        }
        label={urlPrompt === "image" ? "Image URL" : "Link URL"}
        placeholder="https://…"
        defaultValue={urlPrompt === "link" ? linkHref : ""}
        submitLabel={urlPrompt === "image" ? "Insert" : "Apply"}
        validate={(value) =>
          // An empty link means "remove it"; an empty image means nothing.
          urlPrompt === "link" && value === "" ? null : validateUrl(value)
        }
        onSubmit={urlPrompt === "image" ? applyImage : applyLink}
      />
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"
      >
        <ToolbarButton
          label="Bold"
          active={state?.bold}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={state?.italic}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={state?.strike}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Heading 2"
          active={state?.h2}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={state?.h3}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Bullet list"
          active={state?.bulletList}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Ordered list"
          active={state?.orderedList}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Blockquote"
          active={state?.blockquote}
          disabled={!ready}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <TextQuote className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          disabled={!ready}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="size-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Link"
          active={state?.link}
          disabled={!ready}
          onClick={handleLink}
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
        {/* Two ways in, because they are different jobs. The picker is the
            common one — the owner's images are already in the library, and
            re-pasting a URL for one of them is how duplicates get made. The
            URL button stays for an image that genuinely lives elsewhere. */}
        <MediaPicker
          defaultFolder="blog"
          onSelect={(item) => applyImage(item.url)}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Image from the media library"
              disabled={!ready}
              onMouseDown={(e) => e.preventDefault()}
              className="size-8 rounded-lg text-foreground/70"
            >
              <ImageIcon className="size-4" />
            </Button>
          }
        />
        <ToolbarButton
          label="Image from a URL"
          disabled={!ready}
          onClick={handleImage}
        >
          <ImagePlus className="size-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Undo"
          disabled={!ready || !state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!ready || !state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className={CONTENT_CLASS} />
    </div>
  );
}
