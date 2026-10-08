/**
 * Shared edge geometry so the SVG path (EdgeItem) and the HTML label
 * (EdgeLabelLayer) always agree on where an edge runs and where its label sits.
 */

import type { GraphNode } from '../core/types';
import type { AnchorSide } from '../theme/types';
import { getEdgeEndpoints } from './anchors';
import { getSmoothStepPath } from './smoothStepPath';

export interface EdgeGeometry {
  path: string;
  labelX: number;
  labelY: number;
}

export type EdgePathType = 'smoothstep' | 'straight';

export interface EdgeGeometryOptions {
  path?: EdgePathType;
  /** Straight paths: world px trimmed off both ends. */
  inset?: number;
}

/** Straight segment from source to target, shortened by `inset` at both ends (never past the midpoint). */
export function getStraightPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  inset = 0,
): [path: string, labelX: number, labelY: number] {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy);
  const cut = Math.min(inset, len / 2 - 0.5);
  const ux = len > 0 ? dx / len : 0;
  const uy = len > 0 ? dy / len : 0;
  const ax = sx + ux * cut;
  const ay = sy + uy * cut;
  const bx = tx - ux * cut;
  const by = ty - uy * cut;
  return [`M${ax},${ay} L${bx},${by}`, (sx + tx) / 2, (sy + ty) / 2];
}

export function computeEdgeGeometry(
  source: GraphNode,
  target: GraphNode,
  anchors: { source: AnchorSide; target: AnchorSide },
  opts: EdgeGeometryOptions = {},
): EdgeGeometry {
  const ends = getEdgeEndpoints(source, target, anchors);
  if (opts.path === 'straight') {
    const [path, labelX, labelY] = getStraightPath(ends.sourceX, ends.sourceY, ends.targetX, ends.targetY, opts.inset ?? 0);
    return { path, labelX, labelY };
  }
  const [path, labelX, labelY] = getSmoothStepPath(ends);
  return { path, labelX, labelY };
}
