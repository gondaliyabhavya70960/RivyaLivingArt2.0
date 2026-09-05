import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium tracking-[0.01em] outline-none transition-[color,background-color,border-color,box-shadow] duration-(--dur-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          // Primary CTA — v4: SAPPHIRE fill (owner: dark blue is the primary
          // color; gold is a hairline accent only). Porcelain ink clears AA
          // on the primary fill in both scopes. The v7 shine sweep was
          // retired with the token-layer re-point (md-sweep): semantic
          // primary + A5 e1 elevation, no decorative ::after.
          "bg-primary text-primary-foreground shadow-e1 hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          // v3 secondary register (design.md § CTA voice): hairline outline in
          // the LOCAL ink, so the same variant reads porcelain on the dark
          // canvas and midnight inside paper bands.
          "border border-foreground/25 bg-transparent text-foreground hover:border-foreground/50 hover:bg-foreground/[0.05]",
        // Light chip for dark gradient bands (gradient-dopamine, midnight hero).
        // Fixed porcelain/midnight — must NOT flip with the theme token, since
        // it always sits on a dark surface (DS-702).
        inverse: "bg-mineral text-obsidian shadow-e1 hover:bg-sand",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // Text, so the AA companion: identical to sapphire on the light ground,
        // lifted in the Studio's dark scheme where raw sapphire is 1.7:1 on a card.
        link: "text-sapphire-ink underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
      },
      size: {
        sm: "h-9 gap-1.5 px-5 text-sm",
        default: "h-11 px-7 text-sm",
        lg: "h-12 px-8 text-sm",
        xl: "h-14 px-10 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
