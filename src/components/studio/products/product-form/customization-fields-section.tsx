import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { templateForCategorySlug } from "@/lib/category-templates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, FieldError } from "./form-section";
import { FIELD_TYPES, FIELD_TYPE_LABEL, typeHasOptions, type FormValues } from "./schema";

/** The public customization form builder — a react-hook-form field array. */
export function CustomizationFieldsSection({
  categories,
}: {
  categories: { id: string; name: string; slug: string }[];
}) {
  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useFormContext<FormValues>();
  const fieldsArray = useFieldArray({ control, name: "customFields" });
  const watchedFields = useWatch({ control, name: "customFields" });

  return (
    <FormSection
      title="Customization form"
      description="These fields render on the public product page and flow into the WhatsApp order message."
    >
      {fieldsArray.fields.length > 0 && (
        <div className="space-y-4">
          {fieldsArray.fields.map((item, index) => {
            const type = watchedFields[index]?.type ?? "TEXT";
            return (
              <div
                key={item.id}
                className="space-y-3 rounded-card border border-border p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`field-label-${index}`}>Label</Label>
                    <Input
                      id={`field-label-${index}`}
                      placeholder="e.g. Couple names"
                      aria-invalid={!!errors.customFields?.[index]?.label}
                      aria-describedby={
                        errors.customFields?.[index]?.label
                          ? `field-label-${index}-error`
                          : undefined
                      }
                      {...register(`customFields.${index}.label`)}
                    />
                    <FieldError id={`field-label-${index}-error`}>
                      {errors.customFields?.[index]?.label?.message}
                    </FieldError>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Controller
                      control={control}
                      name={`customFields.${index}.type`}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label="Field type"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((fieldType) => (
                              <SelectItem key={fieldType} value={fieldType}>
                                {FIELD_TYPE_LABEL[fieldType]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {typeHasOptions(type) && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`field-options-${index}`}>Options</Label>
                    <Input
                      id={`field-options-${index}`}
                      placeholder="Comma-separated, e.g. Small, Medium, Large"
                      {...register(`customFields.${index}.options`)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor={`field-help-${index}`}>Help text</Label>
                  <Input
                    id={`field-help-${index}`}
                    placeholder="Shown under the field on the product page"
                    {...register(`customFields.${index}.helpText`)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Controller
                    control={control}
                    name={`customFields.${index}.required`}
                    render={({ field }) => (
                      <Label className="cursor-pointer font-normal">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                        Required
                      </Label>
                    )}
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Move field up"
                      disabled={index === 0}
                      onClick={() => fieldsArray.move(index, index - 1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Move field down"
                      disabled={index === fieldsArray.fields.length - 1}
                      onClick={() => fieldsArray.move(index, index + 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove field"
                      onClick={() => fieldsArray.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            fieldsArray.append({
              label: "",
              type: "TEXT",
              options: "",
              required: false,
              helpText: "",
            })
          }
        >
          <Plus /> Add field
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const slug = categories.find(
              (c) => c.id === getValues("categoryId"),
            )?.slug;
            const template = templateForCategorySlug(slug);
            for (const f of template) {
              fieldsArray.append({
                label: f.label,
                type: f.type,
                options: f.options.join(", "),
                required: f.required,
                helpText: f.helpText ?? "",
              });
            }
            toast.success(`Added ${template.length} template fields — edit freely.`);
          }}
        >
          Apply category template
        </Button>
        <p className="text-xs text-muted-foreground">
          One-click starter fields for the selected category.
        </p>
      </div>
    </FormSection>
  );
}
