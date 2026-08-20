/**
 * SVG layer holding every edge of the scene. Sits inside the transformed
 * world element, so paths are in world coordinates. The svg itself is 1×1 with
 * `overflow: visible` so it never affects layout or captures pointer events
 * (only the hit paths do).
 */

import { memo, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import {
  useGraphCallbacks,
  useGraphHighlights,
  useGraphNodeIndex,
  useGraphScene,
  useGraphTheme,
} from '../core/GraphContext';
import type { EdgeHighlight, GraphEdge, GraphNode } from '../core/types';
import type { AnchorSide, GraphTheme, ResolvedEdgeStyle } from '../theme/types';
import { resolveEdgeStyle } from '../theme/resolve';
import { useOffsetNode } from '../core/usePositions';
import { EdgeItem } from './EdgeItem';
import { MarkerDefs, type MarkerEntry } from './markers';

const EDGE_HIGHLIGHTS: readonly EdgeHighlight[] = ['none', 'selected', 'connected', 'connected-tierlist', 'dimmed'];

const LAYER_STYLE = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: 1,
  height: 1,
  overflow: 'visible',
  pointerEvents: 'none',
} as const;

interface EdgeLayerItemProps {
  edge: GraphEdge;
  source: GraphNode;
  target: GraphNode;
  highlight: EdgeHighlight;
  style: ResolvedEdgeStyle;
  anchors: { source: AnchorSide; target: AnchorSide };
  onClick: (edge: GraphEdge, e: ReactMouseEvent) => void;
}

/**
 * Subscribes to the drag offsets of the edge's two endpoints so only edges
 * touching a dragged node re-render; EdgeItem itself stays a pure function of
 * its (offset-adjusted) endpoint nodes.
 */
const EdgeLayerItem = memo(function EdgeLayerItem({ edge, source, target, highlight, style, anchors, onClick }: EdgeLayerItemProps) {
  const s = useOffsetNode(source);
  const t = useOffsetNode(target);
  return <EdgeItem edge={edge} source={s} target={t} highlight={highlight} style={style} anchors={anchors} onClick={onClick} />;
});

/** Resolve the style of every highlight state once per theme. */
export function resolveEdgeStyles(theme: GraphTheme): Record<EdgeHighlight, ResolvedEdgeStyle> {
  const out = {} as Record<EdgeHighlight, ResolvedEdgeStyle>;
  for (const h of EDGE_HIGHLIGHTS) out[h] = resolveEdgeStyle(theme, h);
  return out;
}

function EdgeLayerInner() {
  const scene = useGraphScene();
  const nodeIndex = useGraphNodeIndex();
  const highlights = useGraphHighlights();
  const theme = useGraphTheme();
  const callbacks = useGraphCallbacks();

  const styles = useMemo(() => resolveEdgeStyles(theme), [theme]);
  const anchors = theme.anchors;

  const onEdgeClick = callbacks.onEdgeClick;
  const handleClick = useCallback(
    (edge: GraphEdge, e: ReactMouseEvent) => {
      e.stopPropagation();
      onEdgeClick?.(edge, { x: e.clientX, y: e.clientY });
    },
    [onEdgeClick],
  );

  // Edges whose endpoints both exist, with their highlight state.
  const items = useMemo(() => {
    const out: Array<{ edge: GraphEdge; highlight: EdgeHighlight }> = [];
    for (const edge of scene.edges) {
      if (!nodeIndex.has(edge.source) || !nodeIndex.has(edge.target)) continue;
      out.push({ edge, highlight: highlights.edges.get(edge.id) ?? 'none' });
    }
    return out;
  }, [scene.edges, nodeIndex, highlights]);

  const markers = useMemo(() => {
    const used = new Set<EdgeHighlight>();
    for (const it of items) used.add(it.highlight);
    const entries: MarkerEntry[] = [];
    for (const h of used) entries.push({ color: styles[h].stroke, size: styles[h].markerSize });
    return entries;
  }, [items, styles]);

  return (
    <svg data-graph-edges className="graph-layer-edges" style={LAYER_STYLE}>
      <MarkerDefs entries={markers} />
      {items.map(({ edge, highlight }) => (
        <EdgeLayerItem
          key={edge.id}
          edge={edge}
          source={nodeIndex.get(edge.source)!}
          target={nodeIndex.get(edge.target)!}
          highlight={highlight}
          style={styles[highlight]}
          anchors={anchors}
          onClick={handleClick}
        />
      ))}
    </svg>
  );
}

/** Memoised: re-renders only when the graph context value changes (scene/highlights/theme). */
export const EdgeLayer = memo(EdgeLayerInner);
EdgeLayer.displayName = 'EdgeLayer';
