/**
 * NodeLayer — renders every node belonging to one paint layer.
 *
 * Layers (bottom → top): background (sections) → containers (category /
 * folder, sorted by depth so children paint over parents) → nodes (files).
 * Per-node highlight is passed as a prop so memoised NodeWrappers only
 * re-render when their own highlight changes.
 *
 * Culling (`GraphCanvas cullNodes`, default off): the 'nodes' layer only mounts
 * nodes whose rect (with any drag offset) intersects the visible world rect,
 * padded by 25% and snapped to a 512-world-px grid so the mounted set only
 * changes when the view crosses a grid line. Containers/sections are never
 * culled. When culling is off this component does not subscribe to the
 * viewport at all, so pans never re-render it.
 */

import { memo, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { KIND_LAYER, type NodeLayer as NodeLayerName, type Rect } from './types';
import { useGraphContext, useGraphHighlights, useGraphScene } from './GraphContext';
import { getNodeHighlight } from './highlights';
import { NodeWrapper } from './NodeWrapper';
import { quantiseCullRect, rectsIntersect, sameRect } from './viewportMath';
import { usePositionsVersion } from './usePositions';

export interface NodeLayerProps {
  layer: NodeLayerName;
}

export const CULL_PAD_FRACTION = 0.25;
export const CULL_GRID_WORLD_PX = 512;

/**
 * Quantised culling rect from the committed viewport, or `null` when disabled.
 * Referentially stable while the quantised rect does not change.
 */
function useCullRect(enabled: boolean): Rect | null {
  const { store } = useGraphContext();
  const lastRef = useRef<Rect | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => (enabled ? store.subscribe(listener) : () => {}),
    [store, enabled],
  );
  const getSnapshot = useCallback((): Rect | null => {
    if (!enabled) return null;
    const q = quantiseCullRect(store.getVisibleWorldRect(), CULL_PAD_FRACTION, CULL_GRID_WORLD_PX);
    const prev = lastRef.current;
    if (prev && sameRect(prev, q)) return prev;
    lastRef.current = q;
    return q;
  }, [store, enabled]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function NodeLayerInner({ layer }: NodeLayerProps) {
  const scene = useGraphScene();
  const highlights = useGraphHighlights();
  const { cullNodes, positions } = useGraphContext();
  const culling = cullNodes && layer === 'nodes';
  const cullRect = useCullRect(culling);
  // Dragged nodes move; re-evaluate the visible set when offsets change (only while culling).
  const positionsVersion = usePositionsVersion(culling);

  const layerNodes = useMemo(() => {
    const picked = scene.nodes.filter((n) => KIND_LAYER[n.kind] === layer);
    if (layer === 'containers') {
      // stable sort by depth ascending
      return picked
        .map((n, i) => ({ n, i }))
        .sort((a, b) => a.n.depth - b.n.depth || a.i - b.i)
        .map((x) => x.n);
    }
    return picked;
  }, [scene.nodes, layer]);

  const nodes = useMemo(() => {
    if (!cullRect) return layerNodes;
    void positionsVersion; // dependency: offsets moved
    return layerNodes.filter((n) => {
      const o = positions.get(n.id);
      const rect: Rect = o
        ? { x: n.x + o.dx, y: n.y + o.dy, width: n.width, height: n.height }
        : { x: n.x, y: n.y, width: n.width, height: n.height };
      return rectsIntersect(rect, cullRect);
    });
  }, [layerNodes, cullRect, positions, positionsVersion]);

  return (
    <div className={`graph-layer graph-layer-${layer}`} data-graph-layer={layer} style={{ position: 'absolute', left: 0, top: 0 }}>
      {nodes.map((node) => (
        <NodeWrapper key={node.id} node={node} highlight={getNodeHighlight(highlights, node.id)} />
      ))}
    </div>
  );
}

export const NodeLayer = memo(NodeLayerInner);
NodeLayer.displayName = 'NodeLayer';
