/**
 * Edge anchor points. Anchors sit on the edge of the node's *scaled* box
 * (scale is applied about the slot centre), so edges meet the visible border
 * of scaled-up nodes rather than the layout slot.
 */

import type { GraphNode, Point } from '../core/types';
import type { AnchorSide } from '../theme/types';

export interface EdgeEndpoints {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: AnchorSide;
  targetPosition: AnchorSide;
}

/** Slot centre ± half the scaled size on the given side. */
export function getAnchor(node: GraphNode, side: AnchorSide): Point {
  const scale = node.scale ?? 1;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const halfW = (node.width * scale) / 2;
  const halfH = (node.height * scale) / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: cy - halfH };
    case 'bottom':
      return { x: cx, y: cy + halfH };
    case 'left':
      return { x: cx - halfW, y: cy };
    case 'right':
      return { x: cx + halfW, y: cy };
    case 'center':
      return { x: cx, y: cy };
  }
}

export function getEdgeEndpoints(
  source: GraphNode,
  target: GraphNode,
  anchors: { source: AnchorSide; target: AnchorSide },
): EdgeEndpoints {
  const s = getAnchor(source, anchors.source);
  const t = getAnchor(target, anchors.target);
  return {
    sourceX: s.x,
    sourceY: s.y,
    targetX: t.x,
    targetY: t.y,
    sourcePosition: anchors.source,
    targetPosition: anchors.target,
  };
}
