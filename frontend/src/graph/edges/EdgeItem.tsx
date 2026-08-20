/**
 * One edge: a visible smooth-step path plus a wide transparent hit path.
 * Memoised — EdgeLayer passes referentially stable style objects per
 * highlight state so an edge only re-renders when its own inputs change.
 */

import { memo, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import type { EdgeHighlight, GraphEdge, GraphNode } from '../core/types';
import type { AnchorSide, ResolvedEdgeStyle } from '../theme/types';
import { computeEdgeGeometry } from './geometry';
import { markerId } from './markers';

export interface EdgeItemProps {
  edge: GraphEdge;
  source: GraphNode;
  target: GraphNode;
  highlight: EdgeHighlight;
  style: ResolvedEdgeStyle;
  anchors: { source: AnchorSide; target: AnchorSide };
  onClick?: (edge: GraphEdge, e: ReactMouseEvent) => void;
  onHoverChange?: (edge: GraphEdge | null) => void;
}

/** Minimum hit-target stroke width in world px. */
export const MIN_HIT_WIDTH = 12;

export const EdgeItem = memo(function EdgeItem({
  edge,
  source,
  target,
  highlight,
  style,
  anchors,
  onClick,
  onHoverChange,
}: EdgeItemProps) {
  const { source: sourceSide, target: targetSide } = anchors;
  const path = useMemo(
    () => computeEdgeGeometry(source, target, { source: sourceSide, target: targetSide }).path,
    // Depend on the numeric inputs only so a new node object with the same
    // geometry does not recompute the path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      source.x, source.y, source.width, source.height, source.scale,
      target.x, target.y, target.width, target.height, target.scale,
      sourceSide, targetSide,
    ],
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<SVGPathElement>) => {
      onClick?.(edge, e);
    },
    [edge, onClick],
  );
  const handleEnter = useCallback(() => onHoverChange?.(edge), [edge, onHoverChange]);
  const handleLeave = useCallback(() => onHoverChange?.(null), [onHoverChange]);

  const { stroke, strokeWidth, markerSize, dasharray, opacity } = style;
  const hitWidth = Math.max(MIN_HIT_WIDTH, strokeWidth * 3);

  return (
    <g data-edge-id={edge.id} data-testid={`graph-edge-${edge.id}`} data-highlight={highlight}>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        opacity={opacity}
        markerEnd={`url(#${markerId(stroke, markerSize)})`}
        style={{ pointerEvents: 'none' }}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={handleClick}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
      />
    </g>
  );
});
