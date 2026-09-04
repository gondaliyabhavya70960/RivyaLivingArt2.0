"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadMediaFiles } from "@/actions/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/studio/field-error";

/**
 * URL input with an Upload button — files land in the media library's
 * "site" folder and the returned URL replaces the field value.
 */
export function UploadUrlField({
  id,
  label,
  value,
  onChange,
  accept,
  placeholder = "https://…",
  help,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** File-picker filter, e.g. "image/*" or "video/mp4,video/webm". */
  accept: string;
  placeholder?: string;
  help?: string;
  error?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "site");

    const result = await uploadMediaFiles(formData);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const url = result.data?.[0]?.url;
    if (url) {
      onChange(url);
      toast.success("File uploaded.");
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-64 flex-1"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload /> {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {/* The SEO form's only error path. As a bare paragraph it was neither
          announced nor tied to the field, so a screen-reader user typing an
          invalid sharing-image URL heard nothing and the form looked as
          though it had simply not saved. */}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
