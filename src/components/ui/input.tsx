import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // The two `selection:*` utilities that used to sit here (sapphire
        // ground, mineral ink) are gone: §6.6 / owner decision 11 makes
        // selection champagne-on-obsidian for the whole document, and a
        // control that repaints it is a second answer visible only when you
        // drag across the one field that has it.
        "flex h-11 w-full min-w-0 rounded-input border border-input bg-transparent px-4 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
