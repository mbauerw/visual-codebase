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

export function computeEdgeGeometry(
  source: GraphNode,
  target: GraphNode,
  anchors: { source: AnchorSide; target: AnchorSide },
): EdgeGeometry {
  const [path, labelX, labelY] = getSmoothStepPath(getEdgeEndpoints(source, target, anchors));
  return { path, labelX, labelY };
}
