/**
 * FLIP ("First, Last, Invert, Play") delta between two rects — the shared
 * lightbox's entrance transform (A3). Pure and DOM-free so it is unit
 * testable: callers pass plain `{left, top, width, height}` measurements
 * (from `getBoundingClientRect()`), never the `DOMRect` object itself.
 *
 * `from` is the origin element (a thumbnail, a wall tile) — where the frame
 * visually starts. `to` is the lightbox stage — where it ends up, at its
 * natural size. The returned delta is meant to be applied to the STAGE
 * (already rendered at its final position/size) so it appears to sit exactly
 * over `from`; clearing the transform on the next frame animates it to `to`.
 *
 * Centre-to-centre translation (not edge-to-edge) because the transform is
 * applied with the default `transform-origin: center`, so a scale computed
 * around the centre and a translation computed between centres compose
 * correctly — an edge-aligned delta would drift as the scale changes.
 */
export type FlipRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FlipDelta = {
  /** Horizontal translation, in px, to apply to the stage. */
  x: number;
  /** Vertical translation, in px, to apply to the stage. */
  y: number;
  /** Horizontal scale factor. */
  sx: number;
  /** Vertical scale factor. */
  sy: number;
};

export function flipDelta(from: FlipRect, to: FlipRect): FlipDelta {
  const sx = to.width === 0 ? 1 : from.width / to.width;
  const sy = to.height === 0 ? 1 : from.height / to.height;
  const fromCenterX = from.left + from.width / 2;
  const fromCenterY = from.top + from.height / 2;
  const toCenterX = to.left + to.width / 2;
  const toCenterY = to.top + to.height / 2;
  return {
    x: fromCenterX - toCenterX,
    y: fromCenterY - toCenterY,
    sx,
    sy,
  };
}

/** The delta as a CSS `transform` value ready to assign to `el.style.transform`. */
export function flipTransform(delta: FlipDelta): string {
  return `translate(${delta.x}px, ${delta.y}px) scale(${delta.sx}, ${delta.sy})`;
}
