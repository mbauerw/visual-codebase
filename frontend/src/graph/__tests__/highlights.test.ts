import { describe, expect, it } from 'vitest';
import {
  EMPTY_HIGHLIGHTS,
  computeHighlights,
  getEdgeHighlight,
  getNodeHighlight,
} from '../core/highlights';
import { EMPTY_SELECTION, type GraphEdge, type SelectionState } from '../core/types';
import { mockReactFlowGraph } from '../../test/mocks/handlers';

/*
 * a → b, a → c, b → c, d → e   (source = provider, target = consumer)
 * Selecting `a` touches e1, e2 (neighbours b, c); e3, e4 are dimmed.
 */
const EDGES: GraphEdge[] = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'a', target: 'c' },
  { id: 'e3', source: 'b', target: 'c' },
  { id: 'e4', source: 'd', target: 'e' },
];

const sel = (partial: Partial<SelectionState>): SelectionState => ({ ...EMPTY_SELECTION, ...partial });

describe('EMPTY_HIGHLIGHTS', () => {
  it('is a frozen object with empty read-only maps', () => {
    expect(Object.isFrozen(EMPTY_HIGHLIGHTS)).toBe(true);
    expect(EMPTY_HIGHLIGHTS.nodes.size).toBe(0);
    expect(EMPTY_HIGHLIGHTS.edges.size).toBe(0);
  });

  it('is returned (same reference) for an empty selection', () => {
    expect(computeHighlights(EMPTY_SELECTION, EDGES)).toBe(EMPTY_HIGHLIGHTS);
    expect(computeHighlights(sel({}), [])).toBe(EMPTY_HIGHLIGHTS);
    // a bogus source without a nodeId is still "nothing selected"
    expect(computeHighlights(sel({ source: 'node' }), EDGES)).toBe(EMPTY_HIGHLIGHTS);
  });
});

describe('getNodeHighlight / getEdgeHighlight', () => {
  it('default to none', () => {
    expect(getNodeHighlight(EMPTY_HIGHLIGHTS, 'x')).toBe('none');
    expect(getEdgeHighlight(EMPTY_HIGHLIGHTS, 'x')).toBe('none');
    const m = computeHighlights(sel({ nodeId: 'a', source: 'node' }), EDGES);
    expect(getNodeHighlight(m, 'a')).toBe('selected');
    expect(getNodeHighlight(m, 'zzz')).toBe('none');
    expect(getEdgeHighlight(m, 'e1')).toBe('connected');
    expect(getEdgeHighlight(m, 'zzz')).toBe('none');
  });
});

describe('rule 1 — node selection', () => {
  it("source 'node': selected / connected / dimmed", () => {
    const m = computeHighlights(sel({ nodeId: 'a', source: 'node' }), EDGES);
    expect(getNodeHighlight(m, 'a')).toBe('selected');
    expect(getNodeHighlight(m, 'b')).toBe('connected');
    expect(getNodeHighlight(m, 'c')).toBe('connected');
    expect(getNodeHighlight(m, 'd')).toBe('none');
    expect(getNodeHighlight(m, 'e')).toBe('none');
    expect(getEdgeHighlight(m, 'e1')).toBe('connected');
    expect(getEdgeHighlight(m, 'e2')).toBe('connected');
    expect(getEdgeHighlight(m, 'e3')).toBe('dimmed');
    expect(getEdgeHighlight(m, 'e4')).toBe('dimmed');
    expect(m.nodes.size).toBe(3);
    expect(m.edges.size).toBe(4);
  });

  it("source 'tierlist': tierlist / connected-tierlist / dimmed", () => {
    const m = computeHighlights(sel({ nodeId: 'c', source: 'tierlist' }), EDGES);
    expect(getNodeHighlight(m, 'c')).toBe('tierlist');
    expect(getNodeHighlight(m, 'a')).toBe('connected-tierlist');
    expect(getNodeHighlight(m, 'b')).toBe('connected-tierlist');
    expect(getEdgeHighlight(m, 'e2')).toBe('connected-tierlist');
    expect(getEdgeHighlight(m, 'e3')).toBe('connected-tierlist');
    expect(getEdgeHighlight(m, 'e1')).toBe('dimmed');
    expect(getEdgeHighlight(m, 'e4')).toBe('dimmed');
  });

  it('a null source is treated as a plain node selection', () => {
    const m = computeHighlights(sel({ nodeId: 'a', source: null }), EDGES);
    expect(getNodeHighlight(m, 'a')).toBe('selected');
    expect(getNodeHighlight(m, 'b')).toBe('connected');
  });

  it('a node without incident edges dims every edge', () => {
    const m = computeHighlights(sel({ nodeId: 'lonely', source: 'node' }), EDGES);
    expect(getNodeHighlight(m, 'lonely')).toBe('selected');
    for (const e of EDGES) expect(getEdgeHighlight(m, e.id)).toBe('dimmed');
    expect(m.nodes.size).toBe(1);
  });

  it('a self-loop never downgrades the selected node', () => {
    const m = computeHighlights(sel({ nodeId: 'a', source: 'node' }), [{ id: 'loop', source: 'a', target: 'a' }]);
    expect(getNodeHighlight(m, 'a')).toBe('selected');
    expect(getEdgeHighlight(m, 'loop')).toBe('connected');
  });

  it('node selection wins over edge and container selection', () => {
    const m = computeHighlights(
      sel({ nodeId: 'a', source: 'node', edgeId: 'e4', containerId: 'folder-src' }),
      EDGES,
    );
    expect(getNodeHighlight(m, 'a')).toBe('selected');
    expect(getEdgeHighlight(m, 'e4')).toBe('dimmed');
    expect(getNodeHighlight(m, 'd')).toBe('none');
    expect(getNodeHighlight(m, 'folder-src')).toBe('none');
  });
});

describe('rule 2 — edge selection', () => {
  it('selected edge, endpoints, everything else dimmed', () => {
    const m = computeHighlights(sel({ edgeId: 'e3' }), EDGES);
    expect(getEdgeHighlight(m, 'e3')).toBe('selected');
    expect(getEdgeHighlight(m, 'e1')).toBe('dimmed');
    expect(getEdgeHighlight(m, 'e2')).toBe('dimmed');
    expect(getEdgeHighlight(m, 'e4')).toBe('dimmed');
    expect(getNodeHighlight(m, 'b')).toBe('edge-endpoint');
    expect(getNodeHighlight(m, 'c')).toBe('edge-endpoint');
    expect(getNodeHighlight(m, 'a')).toBe('none');
    expect(m.nodes.size).toBe(2);
  });

  it('edge + container → endpoints AND container-selected', () => {
    const m = computeHighlights(sel({ edgeId: 'e4', containerId: 'folder-src' }), EDGES);
    expect(getEdgeHighlight(m, 'e4')).toBe('selected');
    expect(getNodeHighlight(m, 'd')).toBe('edge-endpoint');
    expect(getNodeHighlight(m, 'e')).toBe('edge-endpoint');
    expect(getNodeHighlight(m, 'folder-src')).toBe('container-selected');
    expect(getEdgeHighlight(m, 'e1')).toBe('dimmed');
  });

  it('an unknown edge id still dims all edges and highlights no endpoints', () => {
    const m = computeHighlights(sel({ edgeId: 'nope' }), EDGES);
    for (const e of EDGES) expect(getEdgeHighlight(m, e.id)).toBe('dimmed');
    expect(m.nodes.size).toBe(0);
  });
});

describe('rule 3 — container selection', () => {
  it('marks only the container', () => {
    const m = computeHighlights(sel({ containerId: 'folder-src' }), EDGES);
    expect(getNodeHighlight(m, 'folder-src')).toBe('container-selected');
    expect(m.nodes.size).toBe(1);
    expect(m.edges.size).toBe(0);
    for (const e of EDGES) expect(getEdgeHighlight(m, e.id)).toBe('none');
  });
});

describe('with the ReactFlow mock fixture', () => {
  it('works on API-shaped edges passed straight through', () => {
    const edges: GraphEdge[] = mockReactFlowGraph.edges;
    const m = computeHighlights(sel({ nodeId: 'node1', source: 'node' }), edges);
    expect(getNodeHighlight(m, 'node1')).toBe('selected');
    expect(getNodeHighlight(m, 'node2')).toBe('connected');
    expect(getEdgeHighlight(m, 'edge1')).toBe('connected');

    const m2 = computeHighlights(sel({ edgeId: 'edge1' }), edges);
    expect(getEdgeHighlight(m2, 'edge1')).toBe('selected');
    expect(getNodeHighlight(m2, 'node1')).toBe('edge-endpoint');
    expect(getNodeHighlight(m2, 'node2')).toBe('edge-endpoint');
  });
});
