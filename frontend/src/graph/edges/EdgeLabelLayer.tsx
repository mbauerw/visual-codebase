/**
 * HTML layer for edge labels (import names / cross-language badges). Lives in
 * the world element above the nodes layer so labels are clickable. Hidden
 * entirely when zoomed far out.
 */

import { memo, useCallback, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import {
  useGraphCallbacks,
  useGraphHighlights,
  useGraphNodeIndex,
  useGraphScene,
  useGraphTheme,
} from '../core/GraphContext';
import type { EdgeHighlight, GraphEdge, GraphNode } from '../core/types';
import type { AnchorSide } from '../theme/types';
import { useZoomBucket } from '../core/useViewport';
import { ImportEdgeLabel } from '../renderers/ImportEdgeLabel';
import { computeEdgeGeometry } from './geometry';
import { useOffsetNode } from '../core/usePositions';

const LAYER_STYLE = { position: 'absolute', left: 0, top: 0 } as const;

/** Whether an edge carries anything worth labelling. */
export function edgeHasLabel(edge: GraphEdge): boolean {
  const d = edge.data;
  if (!d) return false;
  return Boolean(d.imported_names?.length || d.module_path || d.is_cross_language);
}

interface EdgeLabelItemProps {
  edge: GraphEdge;
  source: GraphNode;
  target: GraphNode;
  highlight: EdgeHighlight;
  anchors: { source: AnchorSide; target: AnchorSide };
  onClick: (edge: GraphEdge, e: ReactMouseEvent) => void;
}

const EdgeLabelItem = memo(function EdgeLabelItem({
  edge,
  source,
  target,
  highlight,
  anchors,
  onClick,
}: EdgeLabelItemProps) {
  // Follow dragged endpoints (subscribes to the two ids only).
  const s = useOffsetNode(source);
  const t = useOffsetNode(target);
  const { labelX, labelY } = computeEdgeGeometry(s, t, anchors);
  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => onClick(edge, e), [edge, onClick]);
  return (
    <div
      data-edge-id={edge.id}
      data-testid={`graph-edge-label-${edge.id}`}
      style={{
        position: 'absolute',
        transform: `translate(-50%,-50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'auto',
      }}
      onClick={handleClick}
    >
      <ImportEdgeLabel edge={edge} highlight={highlight} />
    </div>
  );
});

function EdgeLabelLayerInner() {
  const bucket = useZoomBucket();
  const scene = useGraphScene();
  const nodeIndex = useGraphNodeIndex();
  const highlights = useGraphHighlights();
  const theme = useGraphTheme();
  const callbacks = useGraphCallbacks();

  const onEdgeClick = callbacks.onEdgeClick;
  const handleClick = useCallback(
    (edge: GraphEdge, e: ReactMouseEvent) => {
      e.stopPropagation();
      onEdgeClick?.(edge, { x: e.clientX, y: e.clientY });
    },
    [onEdgeClick],
  );

  if (bucket === 'far') return null;

  const anchors = theme.anchors;
  const items: ReactElement[] = [];
  for (const edge of scene.edges) {
    if (!edgeHasLabel(edge)) continue;
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);
    if (!source || !target) continue;
    items.push(
      <EdgeLabelItem
        key={edge.id}
        edge={edge}
        source={source}
        target={target}
        highlight={highlights.edges.get(edge.id) ?? 'none'}
        anchors={anchors}
        onClick={handleClick}
      />,
    );
  }

  return (
    <div className="graph-layer-edge-labels" style={LAYER_STYLE}>
      {items}
    </div>
  );
}

/** Memoised: re-renders only when the graph context value changes (scene/highlights/theme). */
export const EdgeLabelLayer = memo(EdgeLabelLayerInner);
EdgeLabelLayer.displayName = 'EdgeLabelLayer';
