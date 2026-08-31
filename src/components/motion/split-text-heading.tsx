import {
  KineticHeading,
  type KineticHeadingProps,
} from "@/components/motion/kinetic-heading";

/**
 * The v2.0 SplitTextHeading (DESIGN.md B4/D2): GSAP SplitText staggered
 * line/word reveals for display headlines (Fraunces on 2.0 sections). The
 * implementation IS the existing KineticHeading — fonts-ready wait, resize
 * re-split, static under reduced motion or with non-string children, runtime
 * dynamically imported after the guards pass — with the duration pulled into
 * A5's 400–800ms entrance window (0.8s vs the v7 default 1.1s). For B4's
 * line-reveal spec pass `split="lines"`.
 */
export function SplitTextHeading(props: KineticHeadingProps) {
  return <KineticHeading duration={0.8} {...props} />;
}
