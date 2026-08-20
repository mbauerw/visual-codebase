/**
 * Derive per-node / per-edge highlight states from the current selection.
 * Pure; the returned maps are never mutated after creation.
 */

import type {
  EdgeHighlight,
  GraphEdge,
  HighlightMap,
  NodeHighlight,
  SelectionState,
} from './types';

const EMPTY_NODE_MAP: ReadonlyMap<string, NodeHighlight> = new Map();
const EMPTY_EDGE_MAP: ReadonlyMap<string, EdgeHighlight> = new Map();

/** Stable, frozen "nothing highlighted" map. Returned by `computeHighlights` for an empty selection. */
export const EMPTY_HIGHLIGHTS: HighlightMap = Object.freeze({
  nodes: EMPTY_NODE_MAP,
  edges: EMPTY_EDGE_MAP,
});

/**
 * Rules (first match wins):
 *  1. `sel.nodeId`      → that node 'selected' (or 'tierlist' when `sel.source === 'tierlist'`);
 *                         every incident edge 'connected' / 'connected-tierlist' and its other
 *                         endpoint the same; every non-incident edge 'dimmed'.
 *                         (`edgeId` / `containerId` are ignored — node selection wins.)
 *  2. `sel.edgeId`      → that edge 'selected', all other edges 'dimmed', its endpoints
 *                         'edge-endpoint'; PLUS rule 3 when `containerId` is also set.
 *  3. `sel.containerId` → that node 'container-selected'.
 *  4. otherwise         → `EMPTY_HIGHLIGHTS` (same object every time).
 */
export function computeHighlights(sel: SelectionState, edges: readonly GraphEdge[]): HighlightMap {
  if (sel.nodeId) {
    const nodeId = sel.nodeId;
    const tier = sel.source === 'tierlist';
    const nodes = new Map<string, NodeHighlight>();
    const edgeMap = new Map<string, EdgeHighlight>();
    const connected: NodeHighlight & EdgeHighlight = tier ? 'connected-tierlist' : 'connected';

    for (const e of edges) {
      const isSource = e.source === nodeId;
      const isTarget = e.target === nodeId;
      if (isSource || isTarget) {
        edgeMap.set(e.id, connected);
        const other = isSource ? e.target : e.source;
        if (other !== nodeId) nodes.set(other, connected);
      } else {
        edgeMap.set(e.id, 'dimmed');
      }
    }
    // Set last so a self-loop or duplicate id can never downgrade the selected node.
    nodes.set(nodeId, tier ? 'tierlist' : 'selected');
    return { nodes, edges: edgeMap };
  }

  if (sel.edgeId) {
    const edgeId = sel.edgeId;
    const nodes = new Map<string, NodeHighlight>();
    const edgeMap = new Map<string, EdgeHighlight>();
    for (const e of edges) {
      if (e.id === edgeId) {
        edgeMap.set(e.id, 'selected');
        nodes.set(e.source, 'edge-endpoint');
        nodes.set(e.target, 'edge-endpoint');
      } else {
        edgeMap.set(e.id, 'dimmed');
      }
    }
    if (sel.containerId && !nodes.has(sel.containerId)) {
      nodes.set(sel.containerId, 'container-selected');
    }
    return { nodes, edges: edgeMap };
  }

  if (sel.containerId) {
    return {
      nodes: new Map<string, NodeHighlight>([[sel.containerId, 'container-selected']]),
      edges: EMPTY_EDGE_MAP,
    };
  }

  return EMPTY_HIGHLIGHTS;
}

export function getNodeHighlight(map: HighlightMap, id: string): NodeHighlight {
  return map.nodes.get(id) ?? 'none';
}

export function getEdgeHighlight(map: HighlightMap, id: string): EdgeHighlight {
  return map.edges.get(id) ?? 'none';
}
