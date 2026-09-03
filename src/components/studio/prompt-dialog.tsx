"use client";

import { useId, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/studio/field-error";

/**
 * The Studio's replacement for `window.prompt` (roadmap Phase 11).
 *
 * Three call sites used the browser prompt — the rich-text editor's link and
 * image buttons, and "name this view". Beyond looking like 1998, that dialog
 * has three properties that matter here:
 *
 * 1. **It is suppressible.** A browser that decides a tab is showing too many
 *    dialogs discards the call and returns `null`, which is indistinguishable
 *    from the owner pressing Cancel. The action silently does nothing.
 * 2. **It cannot validate.** Whatever is typed comes straight back, so a typo
 *    was only discovered by looking at the published page. `validate` below
 *    is where a bad URL gets named at the point of entry instead.
 * 3. **It steals focus out of the editor** and returns it somewhere the
 *    editor no longer tracks, so the selection the link was meant to wrap is
 *    already gone by the time the value arrives.
 *
 * Controlled by the caller: `open`, `onOpenChange`, and an `onSubmit` that
 * receives the trimmed value. Returning a string from `validate` blocks the
 * submit and shows that string as the field error.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  submitLabel = "Save",
  validate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  /** Return a message to block the submit, or null/undefined to allow it. */
  validate?: (value: string) => string | null | undefined;
  onSubmit: (value: string) => void;
}) {
  const fieldId = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  // Remounting per opening (see the `key` at every call site) is what resets
  // `value` to a fresh `defaultValue`, rather than an effect syncing state.
  const submit = () => {
    const trimmed = value.trim();
    const problem = validate?.(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={fieldId}>{label}</Label>
          <Input
            id={fieldId}
            autoFocus
            value={value}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              // Enter submits; the field is alone in the dialog, so there is
              // no form to own that behaviour.
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shared by the link and image buttons: allow only http(s) and site-root
 * paths.
 *
 * NOT the thing standing between this editor and an injected `javascript:`
 * URL — @tiptap/extension-link carries `isAllowedUri` and refuses disallowed
 * protocols on its own. This is defence in depth plus, mainly, FEEDBACK: the
 * old prompt accepted anything and said nothing, so a mistyped URL was
 * silently dropped by tiptap and the owner was left wondering why the link
 * button had not worked.
 */
export function validateUrl(value: string): string | null {
  if (!value) return "Enter a URL.";
  if (value.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "That is not a valid URL. Use https://… or a path beginning with /.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http and https links are allowed.";
  }
  return null;
}
