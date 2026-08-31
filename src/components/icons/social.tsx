import type { SVGProps } from "react";

/**
 * Brand glyphs for the social row — lucide-react no longer ships brand
 * icons, so these are the classic lucide brand paths inlined (A4: 1.5px
 * stroke via strokeWidth prop parity with our lucide usage; currentColor
 * so token classes color them). Same prop surface as a lucide icon:
 * className/aria/strokeWidth pass straight through.
 */
type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number };

function BrandSvg({
  children,
  strokeWidth = 1.5,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <BrandSvg {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </BrandSvg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <BrandSvg {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </BrandSvg>
  );
}

export function YoutubeIcon(props: IconProps) {
  return (
    <BrandSvg {...props}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </BrandSvg>
  );
}

/** Pinterest has no lucide heritage glyph — a minimal "P in a circle". */
export function PinterestIcon(props: IconProps) {
  return (
    <BrandSvg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 16.5 12 8.8a2.4 2.4 0 1 1 2.4 3.2c-.9 0-1.6-.4-2-1" />
    </BrandSvg>
  );
}
