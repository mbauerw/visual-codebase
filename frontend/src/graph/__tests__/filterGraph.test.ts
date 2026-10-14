import { describe, it, expect } from 'vitest';

import { filterGraph, type GraphFilters } from '../layouts/filterGraph';
import type {
  ArchitecturalRole,
  Category,
  Language,
  ReactFlowEdge,
  ReactFlowGraph,
  ReactFlowNode,
} from '../../types';
import { mockReactFlowGraph } from '../../test/mocks/handlers';

function makeNode(
  id: string,
  overrides: { label?: string; path?: string; language?: Language; role?: ArchitecturalRole; category?: Category } = {}
): ReactFlowNode {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: overrides.label ?? `${id}.ts`,
      path: overrides.path ?? `/src/${id}.ts`,
      folder: '/src',
      language: overrides.language ?? 'typescript',
      role: overrides.role ?? 'utility',
      description: '',
      category: overrides.category ?? 'frontend',
      imports: [],
      size_bytes: 10,
      line_count: 1,
    },
  };
}

function makeEdge(source: string, target: string): ReactFlowEdge {
  return { id: `${source}->${target}`, source, target, type: 'import', animated: false };
}

function makeGraph(nodes: ReactFlowNode[], edges: ReactFlowEdge[]): ReactFlowGraph {
  return { nodes, edges, metadata: mockReactFlowGraph.metadata };
}

const ALL: GraphFilters = { searchQuery: '', languageFilter: 'all', roleFilter: 'all' };

const graph = makeGraph(
  [
    makeNode('app', { label: 'App.tsx', path: '/src/App.tsx', role: 'react_component' }),
    makeNode('useAuth', { label: 'useAuth.ts', path: '/src/hooks/useAuth.ts', role: 'hook' }),
    makeNode('client', { label: 'client.py', path: '/backend/api/client.py', language: 'python', role: 'api_service', category: 'backend' }),
    makeNode('model', { label: 'User.java', path: '/backend/models/User.java', language: 'java', role: 'model', category: 'backend' }),
  ],
  [makeEdge('app', 'useAuth'), makeEdge('useAuth', 'client'), makeEdge('client', 'model')]
);

const ids = (nodes: ReactFlowNode[]) => nodes.map((n) => n.id);

describe('filterGraph', () => {
  it('returns everything when no filter is active', () => {
    const result = filterGraph(graph, ALL);
    expect(ids(result.nodes)).toEqual(['app', 'useAuth', 'client', 'model']);
    expect(result.edges).toHaveLength(3);
  });

  it('works on the shared mock graph', () => {
    const result = filterGraph(mockReactFlowGraph, ALL);
    expect(result.nodes).toEqual(mockReactFlowGraph.nodes);
    expect(result.edges).toEqual(mockReactFlowGraph.edges);
  });

  describe('search', () => {
    it('matches on label', () => {
      const result = filterGraph(graph, { ...ALL, searchQuery: 'App.tsx' });
      expect(ids(result.nodes)).toEqual(['app']);
    });

    it('matches on path even when the label does not match', () => {
      const result = filterGraph(graph, { ...ALL, searchQuery: 'hooks/' });
      expect(ids(result.nodes)).toEqual(['useAuth']);
    });

    it('is case-insensitive for both label and path', () => {
      expect(ids(filterGraph(graph, { ...ALL, searchQuery: 'USEAUTH' }).nodes)).toEqual(['useAuth']);
      expect(ids(filterGraph(graph, { ...ALL, searchQuery: 'BACKEND/API' }).nodes)).toEqual(['client']);
    });

    it('is a substring match, not a prefix match', () => {
      const result = filterGraph(graph, { ...ALL, searchQuery: 'ser' }); // only 'User.java' contains "ser"
      expect(ids(result.nodes)).toEqual(['model']);
    });

    it('returns no nodes and no edges when nothing matches', () => {
      const result = filterGraph(graph, { ...ALL, searchQuery: 'does-not-exist' });
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('language filter', () => {
    it('keeps only nodes of the selected language', () => {
      const result = filterGraph(graph, { ...ALL, languageFilter: 'python' });
      expect(ids(result.nodes)).toEqual(['client']);
    });

    it("'all' keeps every language", () => {
      const result = filterGraph(graph, { ...ALL, languageFilter: 'all' });
      expect(result.nodes).toHaveLength(4);
    });
  });

  describe('role filter', () => {
    it('keeps only nodes with the selected role', () => {
      const result = filterGraph(graph, { ...ALL, roleFilter: 'hook' });
      expect(ids(result.nodes)).toEqual(['useAuth']);
    });

    it('combines with language and search (AND semantics)', () => {
      expect(
        ids(filterGraph(graph, { searchQuery: 'backend', languageFilter: 'java', roleFilter: 'model' }).nodes)
      ).toEqual(['model']);
      expect(
        ids(filterGraph(graph, { searchQuery: 'backend', languageFilter: 'java', roleFilter: 'hook' }).nodes)
      ).toEqual([]);
    });
  });

  describe('edge pruning', () => {
    it('keeps an edge only when both endpoints survive', () => {
      // typescript keeps app + useAuth; the useAuth->client edge loses its target
      const result = filterGraph(graph, { ...ALL, languageFilter: 'typescript' });
      expect(ids(result.nodes)).toEqual(['app', 'useAuth']);
      expect(result.edges.map((e) => e.id)).toEqual(['app->useAuth']);
    });

    it('drops edges whose source is filtered out', () => {
      const result = filterGraph(graph, { ...ALL, roleFilter: 'hook' });
      expect(result.edges).toEqual([]);
    });

    it('drops dangling edges even with no active filter', () => {
      const dangling = makeGraph(graph.nodes, [...graph.edges, makeEdge('app', 'ghost')]);
      const result = filterGraph(dangling, ALL);
      expect(result.edges.map((e) => e.id)).toEqual(['app->useAuth', 'useAuth->client', 'client->model']);
    });
  });

  it('does not mutate the input graph', () => {
    const before = JSON.stringify(graph);
    filterGraph(graph, { searchQuery: 'app', languageFilter: 'typescript', roleFilter: 'react_component' });
    expect(JSON.stringify(graph)).toBe(before);
  });
});
