/**
 * Level-of-detail selection from a node's on-screen width, with hysteresis so
 * nodes near a threshold don't flicker between levels while zooming.
 */

import type { GraphNode, LodLevel, LodThresholds } from './types';

/** On-screen width of a node's slot: `width * (scale ?? 1) * zoom`. */
export function nodeScreenWidth(node: GraphNode, zoom: number): number {
  return node.width * (node.scale ?? 1) * zoom;
}

/**
 * Pick a LOD level for a node whose on-screen width is `screenPx`.
 *
 * Without `prev` (plain thresholds):
 *   - `screenPx <  farBelowPx`  → 'far'
 *   - `screenPx >  nearAbovePx` → 'near'
 *   - otherwise                 → 'mid'
 *
 * With `prev`, each threshold the node would have to cross to LEAVE `prev` is
 * pushed outward by `hysteresis` (a fraction, default 0.15), so a level is only
 * left after the value crosses the whole band. Concretely the effective
 * `[lower, upper]` thresholds are:
 *
 *   prev = 'far'  : lower = farBelowPx * (1 + h)   upper = nearAbovePx * (1 + h)
 *   prev = 'mid'  : lower = farBelowPx * (1 - h)   upper = nearAbovePx * (1 + h)
 *   prev = 'near' : lower = farBelowPx * (1 - h)   upper = nearAbovePx * (1 - h)
 *
 * and the result is `screenPx < lower → 'far'`, `screenPx > upper → 'near'`,
 * else `'mid'`. Entering 'near' from below therefore always requires exceeding
 * `nearAbovePx * (1 + h)`; entering 'far' from above requires dropping below
 * `farBelowPx * (1 - h)`; entering 'mid' requires crossing the outer edge of the
 * band of the level being left.
 */
export function getLod(
  screenPx: number,
  thresholds: LodThresholds,
  prev?: LodLevel,
  hysteresis = 0.15,
): LodLevel {
  const { farBelowPx, nearAbovePx } = thresholds;
  const h = Number.isFinite(hysteresis) && hysteresis > 0 ? hysteresis : 0;

  let lower = farBelowPx;
  let upper = nearAbovePx;
  if (prev === 'far') {
    lower = farBelowPx * (1 + h);
    upper = nearAbovePx * (1 + h);
  } else if (prev === 'mid') {
    lower = farBelowPx * (1 - h);
    upper = nearAbovePx * (1 + h);
  } else if (prev === 'near') {
    lower = farBelowPx * (1 - h);
    upper = nearAbovePx * (1 - h);
  }

  if (screenPx < lower) return 'far';
  if (screenPx > upper) return 'near';
  return 'mid';
}
