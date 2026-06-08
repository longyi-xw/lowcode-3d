/**
 * Pure geometry helpers for asset drag-and-drop placement. No Three.js / DOM
 * deps so they unit-test headlessly; the ThreeAdapter and ThreeViewport
 * consume them at drop time.
 */

/** Canvas-relative screen pixels → normalized device coords ([-1, 1], y up). */
export function screenToNdc(
  px: number,
  py: number,
  w: number,
  h: number,
): [number, number] {
  // y is `1 - …` rather than `-( … - 1)` so the canvas center maps to a clean
  // +0 instead of -0 — vitest's toEqual uses Object.is, where -0 !== 0.
  return [(px / w) * 2 - 1, 1 - (py / h) * 2];
}

/**
 * New node position from a ground-plane hit: take the hit's x/z, keep the
 * library item's default y. So a box lifted to y=0.5 still rests on the floor
 * (not half-buried) and a light keeps its authored height.
 */
export function dropPositionFor(
  defaultPos: readonly [number, number, number],
  hit: readonly [number, number, number],
): [number, number, number] {
  return [hit[0], defaultPos[1], hit[2]];
}
