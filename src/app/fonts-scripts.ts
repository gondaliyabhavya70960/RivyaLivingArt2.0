import {
  Noto_Sans_Arabic,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_JP,
  Noto_Sans_SC,
} from "next/font/google";

/**
 * Per-script body fonts for the non-Latin locales — a SEPARATE module from
 * fonts.ts so their @font-face CSS attaches to the [locale] layout's chunk
 * only, keeping /studio and the root-level error routes on the lean
 * Playfair/Manrope stylesheet (PERF-311).
 *
 * v3 (design.md): the body face moved from a serif to the Manrope grotesk, so
 * the script faces move with it — Noto SANS Devanagari/Gujarati/Arabic/JP/SC
 * replace the previous Noto Serif set. One face per script keeps the payload
 * flat; display type in non-Latin locales falls back to the same sans face,
 * which is the intended modern register.
 *
 * Every instance defines the SAME CSS variable (`--font-script`); the
 * [locale] layout applies exactly one class per locale and the shared stacks
 * in globals.css (`--font-sans` / `--font-display`) pick it up as the second
 * family after Manrope/Playfair — Latin glyphs keep the brand fonts, native
 * script renders in its Noto sans face.
 *
 * `preload: false` on all five (PERF-310): next/font preloads per module
 * graph, not per applied class, so preloading would force every script's
 * woff2 onto every visitor. Without preload the @font-face rules still ship,
 * and the applied locale's face loads on demand via font matching +
 * unicode-range (CJK faces are additionally sliced by Google so only used
 * glyph ranges transfer).
 */
export const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

export const notoGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

export const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

export const notoJapanese = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

export const notoChinese = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

/** The `.variable` class for a locale's script font, or undefined for Latin. */
export function scriptFontClass(locale: string): string | undefined {
  switch (locale) {
    case "hi":
      return notoDevanagari.variable;
    case "gu":
      return notoGujarati.variable;
    case "ar":
      return notoArabic.variable;
    case "ja":
      return notoJapanese.variable;
    case "zh":
      return notoChinese.variable;
    default:
      return undefined;
  }
}
