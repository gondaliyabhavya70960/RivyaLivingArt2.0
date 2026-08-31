"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // The box stays 16px — the Studio's tables are dense and a bigger
        // square would change every row's rhythm. The TARGET grows to 24px
        // through a pseudo-element, which is WCAG 2.2 §2.5.8's minimum and
        // the difference between selecting a row and mis-tapping it on a
        // phone in the workshop. `relative` and `before:` cost no layout.
        "peer relative size-4 shrink-0 rounded-[4px] border border-input bg-transparent shadow-e1 transition-colors before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none aria-invalid:border-destructive data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
