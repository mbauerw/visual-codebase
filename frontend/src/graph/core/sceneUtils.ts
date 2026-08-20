/**
 * Pure helpers over `GraphNode[]` / `GraphEdge[]`: rects, bounds, indexes,
 * hierarchy queries and `GraphScene` construction.
 */

import type { GraphEdge, GraphNode, GraphScene, PositionDelta, Rect } from './types';

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * The node's layout slot rect (`x, y, width, height`). `scale` is a visual
 * transform about the slot centre and is deliberately NOT applied here — the
 * slot is what layout, containment and anchors use.
 */
export function nodeRect(node: GraphNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

function unionRects(nodes: Iterable<GraphNode>): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const n of nodes) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.width) || !Number.isFinite(n.height)) {
      continue;
    }
    any = true;
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  if (!any) return { ...EMPTY_RECT };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Union of all node rects; empty input → `{ 0, 0, 0, 0 }`. */
export function getSceneBounds(nodes: readonly GraphNode[]): Rect {
  return unionRects(nodes);
}

/** Union of the rects of the nodes whose id is in `ids`; no match → `{ 0, 0, 0, 0 }`. */
export function getNodesBounds(nodes: readonly GraphNode[], ids: ReadonlySet<string> | readonly string[]): Rect {
  const idSet: ReadonlySet<string> = ids instanceof Set ? ids : new Set(ids as readonly string[]);
  return unionRects(nodes.filter((n) => idSet.has(n.id)));
}

/** id → node. Later duplicates win. */
export function buildNodeIndex(nodes: readonly GraphNode[]): Map<string, GraphNode> {
  const map = new Map<string, GraphNode>();
  for (const n of nodes) map.set(n.id, n);
  return map;
}

/** parentId → direct children (in input order). Root nodes (no `parentId`) are not keyed. */
export function buildParentMap(nodes: readonly GraphNode[]): Map<string, GraphNode[]> {
  const map = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.parentId === undefined) continue;
    const list = map.get(n.parentId);
    if (list) list.push(n);
    else map.set(n.parentId, [n]);
  }
  return map;
}

/**
 * All transitive descendants of `id` (children, grandchildren, …) in depth-first
 * pre-order. `id` itself is not included. Cycles are guarded.
 */
export function getDescendants(nodes: readonly GraphNode[], id: string): GraphNode[] {
  const byParent = buildParentMap(nodes);
  const out: GraphNode[] = [];
  const seen = new Set<string>([id]);
  const stack: GraphNode[] = [...(byParent.get(id) ?? [])].reverse();
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
    const children = byParent.get(n.id);
    if (children) {
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
  return out;
}

/**
 * Lazily cached `id → descendant ids` lookup over one node list (parent map built
 * once). Use for repeated queries against the same scene (e.g. container drags).
 */
export function createDescendantsIndex(nodes: readonly GraphNode[]): (id: string) => readonly string[] {
  const byParent = buildParentMap(nodes);
  const cache = new Map<string, readonly string[]>();
  return (id) => {
    const hit = cache.get(id);
    if (hit) return hit;
    const out: string[] = [];
    const seen = new Set<string>([id]);
    const stack: GraphNode[] = [...(byParent.get(id) ?? [])].reverse();
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n.id);
      const children = byParent.get(n.id);
      if (children) {
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      }
    }
    cache.set(id, out);
    return out;
  };
}

/**
 * Bake position overrides (`id → {dx, dy}`, e.g. `positions.getAll()`) into a
 * new scene: moved nodes get `x + dx, y + dy`, edges are shared, bounds are
 * recomputed. Returns the SAME scene when nothing moves. Descendants of a
 * dragged container are expected to carry their own entries (the drag hook
 * writes them), so nodes are moved independently.
 */
export function applyPositionOverrides(
  scene: GraphScene,
  overrides: ReadonlyMap<string, PositionDelta>,
): GraphScene {
  if (overrides.size === 0) return scene;
  let changed = false;
  const nodes = scene.nodes.map((n) => {
    const o = overrides.get(n.id);
    if (!o || (o.dx === 0 && o.dy === 0)) return n;
    changed = true;
    return { ...n, x: n.x + o.dx, y: n.y + o.dy };
  });
  if (!changed) return scene;
  return { nodes, edges: scene.edges, bounds: getSceneBounds(nodes) };
}

/**
 * Build a `GraphScene`: computes `bounds` from the nodes and drops every edge
 * whose `source` or `target` is not a node in `nodes`.
 */
export function createScene(nodes: GraphNode[], edges: GraphEdge[]): GraphScene {
  const ids = new Set<string>();
  for (const n of nodes) ids.add(n.id);
  const keptEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes, edges: keptEdges, bounds: getSceneBounds(nodes) };
}
