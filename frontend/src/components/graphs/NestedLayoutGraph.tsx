/**
 * NestedLayoutGraph - Nested folder containment layout rendered on the
 * in-house graph engine (amber theme).
 *
 *   filterGraph → computeNestedLayout → toNestedScene → <GraphCanvas>
 *
 * - Filtering, layout and scene building are pure and memoised
 * - Selection is controlled: `selectedNodeId` / `selectionSource` come from
 *   the page; the clicked edge id and the clicked folder id are local; the
 *   canvas derives highlights (folder → `container-selected` ring)
 * - Click dispatch by `node.kind`: file → onNodeSelect with the ORIGINAL API
 *   node data, folder → local ring only (never onNodeSelect — parity), edge →
 *   onEdgeClick with the ORIGINAL API edge, background → onPaneClick
 * - Chrome (filter panel, zoom controls, minimap) lives in the canvas overlay
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ReactFlowEdge, ReactFlowNodeData } from '../../types';
import { GraphCanvas } from '../../graph/core/GraphCanvas';
import type { GraphCanvasHandle, GraphEdge, GraphNode, Point, SelectionState } from '../../graph/core/types';
import { GraphControls, GraphMiniMap, GraphPanel } from '../../graph/chrome';
import { nestedTheme } from '../../graph/theme/nestedTheme';
import { nestedRenderers } from '../../graph/renderers/nested';
import { filterGraph } from '../../graph/layouts/filterGraph';
import { computeNestedLayout, toNestedScene } from '../../graph/layouts/nestedLayout';
import GraphFilterPanel from './GraphFilterPanel';
import type { NestedLayoutGraphProps } from './SharedGraphTypes';
import { GRAPH_BACKGROUNDS } from './SharedGraphTypes';

export default function NestedLayoutGraph({
  graphData,
  searchQuery,
  languageFilter,
  roleFilter,
  onNodeSelect,
  onEdgeClick,
  onPaneClick,
  selectedNodeId,
  selectionSource,
  onLanguageFilterChange,
  onRoleFilterChange,
  onSearchChange,
}: NestedLayoutGraphProps) {
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);

  // ---- data flow: filter → layout → scene ---------------------------------
  const filtered = useMemo(
    () => filterGraph(graphData, { searchQuery, languageFilter, roleFilter }),
    [graphData, searchQuery, languageFilter, roleFilter]
  );

  const scene = useMemo(() => {
    const layout = computeNestedLayout(filtered.nodes);
    return toNestedScene(layout, filtered.edges);
  }, [filtered]);

  // Original API edges by id (onEdgeClick hands the API edge back to the page)
  const edgesById = useMemo(() => {
    const map = new Map<string, ReactFlowEdge>();
    graphData.edges.forEach((edge) => map.set(edge.id, edge));
    return map;
  }, [graphData]);

  // ---- selection ------------------------------------------------------------
  // A node selection (from the graph, tier list or file tree) supersedes any
  // locally selected edge or folder, mirroring the previous behaviour.
  useEffect(() => {
    if (selectedNodeId) {
      setSelectedEdgeId(null);
      setSelectedContainerId(null);
    }
  }, [selectedNodeId]);

  const selection = useMemo<SelectionState>(
    () => ({
      nodeId: selectedNodeId,
      source: selectionSource,
      edgeId: selectedEdgeId,
      containerId: selectedContainerId,
    }),
    [selectedNodeId, selectionSource, selectedEdgeId, selectedContainerId]
  );

  // ---- interaction ----------------------------------------------------------
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.kind === 'file') {
        setSelectedEdgeId(null);
        setSelectedContainerId(null);
        onNodeSelect(node.id, node.data as ReactFlowNodeData);
        return;
      }
      if (node.kind === 'folder') {
        // Folder click only rings the folder locally (parity: no onNodeSelect)
        setSelectedContainerId(node.id);
        setSelectedEdgeId(null);
      }
    },
    [onNodeSelect]
  );

  const handleEdgeClick = useCallback(
    (edge: GraphEdge, clientPos: Point) => {
      setSelectedEdgeId(edge.id);
      setSelectedContainerId(null);
      const apiEdge = edgesById.get(edge.id) ?? (edge as ReactFlowEdge);
      onEdgeClick?.(apiEdge, clientPos);
    },
    [edgesById, onEdgeClick]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedEdgeId(null);
    setSelectedContainerId(null);
    onPaneClick();
  }, [onPaneClick]);

  // ---- filter panel data ----------------------------------------------------
  const availableLanguages = useMemo(
    () => [...new Set(graphData.nodes.map((n) => n.data.language))],
    [graphData]
  );

  const availableRoles = useMemo(
    () => [...new Set(graphData.nodes.map((n) => n.data.role))],
    [graphData]
  );

  return (
    <div
      data-testid="nested-layout-graph"
      className="w-full h-full relative"
      style={{ background: GRAPH_BACKGROUNDS.nested }}
    >
      <GraphCanvas
        ref={canvasRef}
        scene={scene}
        theme={nestedTheme}
        renderers={nestedRenderers}
        selection={selection}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onBackgroundClick={handleBackgroundClick}
        className="w-full h-full"
      >
        <GraphPanel position="top-left" className="m-4">
          <GraphFilterPanel
            palette="amber"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            languageFilter={languageFilter}
            onLanguageFilterChange={onLanguageFilterChange}
            roleFilter={roleFilter}
            onRoleFilterChange={onRoleFilterChange}
            availableLanguages={availableLanguages}
            availableRoles={availableRoles}
            visibleCount={filtered.nodes.length}
            totalCount={graphData.nodes.length}
          />
        </GraphPanel>
        <GraphControls />
        <GraphMiniMap />
      </GraphCanvas>
    </div>
  );
}
