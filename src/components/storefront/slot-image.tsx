import Image, { getImageProps, type ImageProps } from "next/image";

import { isOptimizableImageSrc } from "@/lib/image-src";
import { getLqipBlur } from "@/lib/lqip";
import type { SiteImageRef } from "@/lib/site-images";

/**
 * A named site-image slot, rendered with the owner's crop choices.
 *
 * The slot registry has carried a URL for a while; Phase B added two more
 * decisions the owner can make about the same picture — a separate file below
 * 768px, and where in the frame the subject sits. Both are properties of the
 * slot rather than of any one layout, so they belong in one component instead
 * of being spelled out at each of the call sites that render a hero.
 *
 * **Why `<picture>` and not two `<Image>`s toggled by CSS.** A `display: none`
 * image is still fetched by most browsers, so the CSS approach downloads both
 * files on every phone. `<picture>` chooses before the fetch: exactly one file
 * is requested, and the choice is made by the browser rather than by a media
 * query the layout has to keep in step.
 *
 * `getImageProps` runs the same optimizer pipeline `<Image>` does, so the
 * mobile file gets its own responsive `srcSet` rather than one fixed URL.
 *
 * This does NOT reveal — it is used for full-bleed heroes and band backdrops,
 * which are `priority` and therefore never animated (REDESIGN.md Part 14: the
 * LCP is never delayed). A slot that wants the meniscus reveal passes the same
 * two values to `MeniscusImage`, which accepts them under the same names.
 */
export function SlotImage({
  slot,
  alt,
  ...props
}: Omit<ImageProps, "src" | "alt" | "slot"> & {
  // `slot` is also a global HTML attribute (web components), which would
  // intersect with this one as `string & SiteImageRef`. Omitted above, because
  // "slot" is the domain word here and nothing on this site uses shadow DOM.
  slot: SiteImageRef;
  /** Empty string for a decorative frame — most full-bleed heroes are. */
  alt: string;
}) {
  const desktopBlur = props.blurDataURL ?? getLqipBlur(slot.url);
  const mobileBlur = slot.mobileUrl
    ? (props.blurDataURL ?? getLqipBlur(slot.mobileUrl))
    : undefined;

  const shared = {
    ...props,
    alt,
    unoptimized: !isOptimizableImageSrc(slot.url),
    ...(desktopBlur && !props.placeholder
      ? { placeholder: "blur" as const, blurDataURL: desktopBlur }
      : {}),
  };

  const mobile = slot.mobileUrl
    ? getImageProps({
        ...props,
        alt,
        src: slot.mobileUrl,
        unoptimized: !isOptimizableImageSrc(slot.mobileUrl),
        ...(mobileBlur && !props.placeholder
          ? { placeholder: "blur" as const, blurDataURL: mobileBlur }
          : {}),
      }).props
    : null;

  // Centred is CSS's own default, so an untouched slot emits no inline style
  // and whatever `className` sets still applies.
  const moved = slot.focalX !== 0.5 || slot.focalY !== 0.5;
  const style = moved
    ? {
        ...props.style,
        objectPosition: `${slot.focalX * 100}% ${slot.focalY * 100}%`,
      }
    : props.style;

  if (!mobile?.srcSet) {
    // `alt` is in `shared`; the rule cannot see through the spread.
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image {...shared} src={slot.url} style={style} />;
  }

  return (
    <picture className="block h-full w-full">
      <source
        media="(max-width: 767px)"
        srcSet={mobile.srcSet}
        sizes={mobile.sizes}
      />
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image {...shared} src={slot.url} style={style} />
    </picture>
  );
}
