import { Controller, useFormContext } from "react-hook-form";
import { TriangleAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FormValues } from "./schema";

/** Banner shown on scraped products until the owner confirms a rewrite. */
export function RewriteWarning() {
  const { control } = useFormContext<FormValues>();
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-warning"
        />
        <div className="space-y-3">
          <p className="text-sm text-foreground/90">
            Scraped reference content — rewrite the description in original
            ResinRiva words and replace all images with ResinRiva photos before
            publishing.
          </p>
          <Controller
            control={control}
            name="confirmRewrite"
            render={({ field }) => (
              <Label className="cursor-pointer font-normal">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                I have rewritten this content — it is now original.
              </Label>
            )}
          />
        </div>
      </div>
    </div>
  );
}
