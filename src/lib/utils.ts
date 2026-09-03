import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must be taught the custom design-system utilities,
 * otherwise `cn("text-display", "text-mineral")` treats both as the
 * same group and silently drops one.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Content shell width (tokens.css --shell-max) — registered so a
      // caller-passed max-w-* correctly REPLACES max-w-shell instead of both
      // surviving the merge.
      "max-w": [{ "max-w": ["shell"] }],
      "font-size": [
        {
          text: [
            // Master Redesign Part 3.2 — the fluid editorial scale.
            "hero",
            "h1",
            "h2",
            "h3",
            "body",
            "small",
            "micro",
            // The retained step scale (Studio + form primitives) — without
            // these, twMerge classifies `text-16` as a text COLOR and
            // silently strips the real color from the same cn() call
            // (`text-white text-16` → `text-16`), which broke every
            // storefront Button's variant ink.
            "12",
            "14",
            "16",
            "20",
            "25",
            "31",
            "39",
            "49",
            "61",
            "76",
          ],
        },
      ],
      "font-family": [{ font: ["display", "body", "mono", "sans"] }],
      shadow: [{ shadow: ["e1", "e2", "e3"] }],
      tracking: [{ tracking: ["display"] }],
      rounded: [{ rounded: ["image", "input", "card", "modal"] }],
      // The three custom keyframe utilities (globals.css :144, :153, :165).
      // Unregistered they sit outside twMerge's built-in `animate` group, so
      // `cn("animate-marquee", "animate-none")` kept BOTH and the reduced-
      // motion override lost silently. Only these three exist — the
      // `animate-mesh-drift` family was removed in the Phase 7 perf review
      // (globals.css:5-12) and must not be re-added here speculatively.
      animate: [{ animate: ["marquee", "droplet"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Trim a string and collapse empty/whitespace-only values to null — the shape
 * Prisma wants for optional text columns. Single source for the helper that was
 * redeclared across 6 action files (ENG-810). Accepts null so callers can pass
 * already-nullable values straight through.
 */
export function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Up to two uppercase initials for image-less tile placeholders, so a
 * category/product with no photo reads as itself instead of an anonymous
 * gradient (UIUX-008). Single word → its first two letters; multi-word → first
 * + last initial.
 */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPriceBand(
  min?: number | null,
  max?: number | null,
): string {
  if (min == null && max == null) return "Enquire";
  if (min != null && max != null && min !== max)
    return `${formatINR(min)} – ${formatINR(max)}`;
  return formatINR((min ?? max) as number);
}
