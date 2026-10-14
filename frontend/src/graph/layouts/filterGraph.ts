/**
 * filterGraph - pure search / language / role filtering for a ReactFlowGraph.
 *
 * Extracted from the identical filter blocks in RoleLayoutGraph and
 * NestedLayoutGraph so both wrappers (and later the graph engine) share one
 * definition. Semantics:
 *  - search: case-insensitive substring match on `data.label` OR `data.path`;
 *    an empty query matches everything
 *  - language / role: exact match, or 'all'
 *  - edges are kept only when BOTH endpoints survive the node filter
 */

import type {
  ArchitecturalRole,
  Language,
  ReactFlowEdge,
  ReactFlowGraph,
  ReactFlowNode,
} from '../../types';

export interface GraphFilters {
  searchQuery: string;
  languageFilter: Language | 'all';
  roleFilter: ArchitecturalRole | 'all';
}

export interface FilteredGraph {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export function filterGraph(graph: ReactFlowGraph, filters: GraphFilters): FilteredGraph {
  const { searchQuery, languageFilter, roleFilter } = filters;
  const query = searchQuery.toLowerCase();

  const nodes = graph.nodes.filter((node) => {
    const matchesSearch =
      searchQuery === '' ||
      node.data.label.toLowerCase().includes(query) ||
      node.data.path.toLowerCase().includes(query);

    const matchesLanguage = languageFilter === 'all' || node.data.language === languageFilter;

    const matchesRole = roleFilter === 'all' || node.data.role === roleFilter;

    return matchesSearch && matchesLanguage && matchesRole;
  });

  const visibleNodeIds = new Set(nodes.map((n) => n.id));

  const edges = graph.edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  return { nodes, edges };
}
