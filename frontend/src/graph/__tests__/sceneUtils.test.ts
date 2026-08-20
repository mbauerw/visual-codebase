import { describe, expect, it } from 'vitest';
import {
  applyPositionOverrides,
  buildNodeIndex,
  buildParentMap,
  createDescendantsIndex,
  createScene,
  getDescendants,
  getNodesBounds,
  getSceneBounds,
  nodeRect,
} from '../core/sceneUtils';
import type { GraphEdge, GraphNode } from '../core/types';
import type { ReactFlowNodeData } from '../../types';
import { mockReactFlowGraph } from '../../test/mocks/handlers';

function n(id: string, x: number, y: number, w: number, h: number, extra: Partial<GraphNode> = {}): GraphNode {
  return { id, kind: 'file', x, y, width: w, height: h, depth: 0, data: null, ...extra };
}

/*
 * folder-src (0,0 400x300)
 *   ├─ folder-src/a (20,20 200x120)
 *   │    └─ f1 (40,40 100x40)
 *   └─ f2 (250,200 100x40)
 * folder-lib (500,0 100x100)   (root, no children)
 * loner (-50,-50 20x20)         (root file)
 */
const NODES: GraphNode[] = [
  n('folder-src', 0, 0, 400, 300, { kind: 'folder' }),
  n('folder-src/a', 20, 20, 200, 120, { kind: 'folder', parentId: 'folder-src', depth: 1 }),
  n('f1', 40, 40, 100, 40, { parentId: 'folder-src/a', depth: 2 }),
  n('f2', 250, 200, 100, 40, { parentId: 'folder-src', depth: 1 }),
  n('folder-lib', 500, 0, 100, 100, { kind: 'folder' }),
  n('loner', -50, -50, 20, 20),
];

describe('nodeRect', () => {
  it('returns the slot rect (scale is not applied)', () => {
    expect(nodeRect(n('a', 1, 2, 3, 4))).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(nodeRect(n('a', 1, 2, 3, 4, { scale: 2 }))).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});

describe('getSceneBounds', () => {
  it('is the union of every node rect', () => {
    expect(getSceneBounds(NODES)).toEqual({ x: -50, y: -50, width: 650, height: 350 });
  });
  it('is {0,0,0,0} for no nodes', () => {
    expect(getSceneBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
  it('is the node rect for a single node', () => {
    expect(getSceneBounds([n('a', 10, 20, 30, 40)])).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });
});

describe('getNodesBounds', () => {
  it('accepts an id array', () => {
    expect(getNodesBounds(NODES, ['f1', 'f2'])).toEqual({ x: 40, y: 40, width: 310, height: 200 });
  });
  it('accepts an id set', () => {
    expect(getNodesBounds(NODES, new Set(['folder-lib']))).toEqual({ x: 500, y: 0, width: 100, height: 100 });
  });
  it('ignores unknown ids and returns {0,0,0,0} when nothing matches', () => {
    expect(getNodesBounds(NODES, ['nope'])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(getNodesBounds(NODES, ['nope', 'loner'])).toEqual({ x: -50, y: -50, width: 20, height: 20 });
  });
});

describe('buildNodeIndex / buildParentMap', () => {
  it('indexes by id', () => {
    const idx = buildNodeIndex(NODES);
    expect(idx.size).toBe(NODES.length);
    expect(idx.get('f1')).toBe(NODES[2]);
    expect(idx.get('nope')).toBeUndefined();
  });

  it('groups children by parentId in input order and skips roots', () => {
    const pm = buildParentMap(NODES);
    expect([...pm.keys()].sort()).toEqual(['folder-src', 'folder-src/a']);
    expect(pm.get('folder-src')!.map((c) => c.id)).toEqual(['folder-src/a', 'f2']);
    expect(pm.get('folder-src/a')!.map((c) => c.id)).toEqual(['f1']);
    expect(pm.get('folder-lib')).toBeUndefined();
    expect(pm.get('loner')).toBeUndefined();
  });
});

describe('getDescendants', () => {
  it('returns all transitive descendants in DFS pre-order, excluding the node itself', () => {
    expect(getDescendants(NODES, 'folder-src').map((d) => d.id)).toEqual(['folder-src/a', 'f1', 'f2']);
    expect(getDescendants(NODES, 'folder-src/a').map((d) => d.id)).toEqual(['f1']);
  });
  it('is empty for leaves and unknown ids', () => {
    expect(getDescendants(NODES, 'f1')).toEqual([]);
    expect(getDescendants(NODES, 'folder-lib')).toEqual([]);
    expect(getDescendants(NODES, 'nope')).toEqual([]);
  });
  it('terminates on cyclic parent links', () => {
    const cyc: GraphNode[] = [
      n('a', 0, 0, 1, 1, { parentId: 'b' }),
      n('b', 0, 0, 1, 1, { parentId: 'a' }),
    ];
    expect(getDescendants(cyc, 'a').map((d) => d.id)).toEqual(['b']);
  });
});

describe('createDescendantsIndex', () => {
  it('matches getDescendants (ids, DFS pre-order) and caches per id', () => {
    const idx = createDescendantsIndex(NODES);
    expect(idx('folder-src')).toEqual(['folder-src/a', 'f1', 'f2']);
    expect(idx('folder-src')).toBe(idx('folder-src')); // cached array
    expect(idx('folder-src/a')).toEqual(['f1']);
    expect(idx('f1')).toEqual([]);
    expect(idx('nope')).toEqual([]);
  });
});

describe('applyPositionOverrides', () => {
  const scene = createScene(NODES, []);

  it('returns the same scene for an empty map or all-zero deltas', () => {
    expect(applyPositionOverrides(scene, new Map())).toBe(scene);
    expect(applyPositionOverrides(scene, new Map([['f1', { dx: 0, dy: 0 }]]))).toBe(scene);
    expect(applyPositionOverrides(scene, new Map([['unknown', { dx: 5, dy: 5 }]]))).toBe(scene);
  });

  it('bakes deltas into new node objects, keeps the others and edges, recomputes bounds', () => {
    const edges: GraphEdge[] = [{ id: 'e', source: 'f1', target: 'f2' }];
    const withEdges = createScene(NODES, edges);
    const out = applyPositionOverrides(
      withEdges,
      new Map([
        ['loner', { dx: -100, dy: 10 }],
        ['f1', { dx: 5, dy: 5 }],
      ]),
    );
    expect(out).not.toBe(withEdges);
    expect(out.edges).toBe(withEdges.edges);
    const byId = buildNodeIndex(out.nodes);
    expect(byId.get('loner')).toMatchObject({ x: -150, y: -40, width: 20, height: 20 });
    expect(byId.get('f1')).toMatchObject({ x: 45, y: 45 });
    // untouched nodes keep identity
    expect(byId.get('f2')).toBe(NODES[3]);
    expect(byId.get('folder-src')).toBe(NODES[0]);
    // input untouched
    expect(NODES[5]).toMatchObject({ x: -50, y: -50 });
    // bounds now start at the moved loner
    expect(out.bounds).toEqual({ x: -150, y: -40, width: 750, height: 340 });
    expect(out.nodes).toHaveLength(NODES.length);
  });
});

describe('createScene', () => {
  it('computes bounds and keeps edges whose endpoints both exist', () => {
    const edges: GraphEdge[] = [
      { id: 'ok', source: 'f1', target: 'f2' },
      { id: 'dangling-src', source: 'ghost', target: 'f2' },
      { id: 'dangling-tgt', source: 'f1', target: 'ghost' },
      { id: 'dangling-both', source: 'x', target: 'y' },
      { id: 'to-container', source: 'f1', target: 'folder-lib' },
    ];
    const scene = createScene(NODES, edges);
    expect(scene.nodes).toBe(NODES);
    expect(scene.edges.map((e) => e.id)).toEqual(['ok', 'to-container']);
    expect(scene.bounds).toEqual(getSceneBounds(NODES));
    expect(scene.bounds).toEqual({ x: -50, y: -50, width: 650, height: 350 });
  });

  it('handles the empty case', () => {
    const scene = createScene([], [{ id: 'e', source: 'a', target: 'b' }]);
    expect(scene.nodes).toEqual([]);
    expect(scene.edges).toEqual([]);
    expect(scene.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('builds from the ReactFlow mock fixture', () => {
    const nodes: GraphNode<ReactFlowNodeData>[] = mockReactFlowGraph.nodes.map((rf) => ({
      id: rf.id,
      kind: 'file',
      x: rf.position.x,
      y: rf.position.y,
      width: 180,
      height: 60,
      depth: 0,
      data: rf.data,
    }));
    const edges: GraphEdge[] = [
      ...mockReactFlowGraph.edges,
      { id: 'edge-dangling', source: 'node1', target: 'node-missing' },
    ];
    const scene = createScene(nodes, edges);
    expect(scene.edges.map((e) => e.id)).toEqual(['edge1']);
    expect(scene.bounds).toEqual({ x: 0, y: 0, width: 280, height: 160 });
    expect((buildNodeIndex(scene.nodes).get('node2')?.data as ReactFlowNodeData).label).toBe('App.tsx');
  });
});
