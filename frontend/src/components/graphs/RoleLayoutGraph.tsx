/**
 * RoleLayoutGraph - Role-based layout rendered on the in-house graph engine.
 *
 * Files are grouped by architectural role in a circular arrangement per
 * Frontend / Backend / Test section. This component is a thin wrapper:
 *
 *   filterGraph → computeRoleLayout → toRoleScene → <GraphCanvas>
 *
 * - Filtering, layout and scene building are pure and memoised
 * - Selection is controlled: `selectedNodeId` / `selectionSource` come from
 *   the page, the clicked edge id is local; the canvas derives highlights
 * - Click dispatch by `node.kind`: file → onNodeSelect, category (anywhere on
 *   the box or its pill) → onCategorySelect, edge → onEdgeClick with the
 *   ORIGINAL API edge, background → onPaneClick
 * - Categories are draggable (grab anywhere that isn't a file node; files move
 *   with their category). Files/sections are not. Offsets reset on filter/search
 *   changes; hold space to pan from anywhere
 * - External selections (tier list / file tree / rundown — anything the graph
 *   did not emit itself) pan the camera to the node via `focusNode`
 * - Chrome (filter panel, zoom controls, minimap) lives in the canvas overlay
 * - The LOOK comes from a theme pack (`graph/themes`): theme tokens, node
 *   renderers and the scene builder. Collapsible packs hide a category's files
 *   until it is clicked; that click toggles the category instead of opening
 *   the category panel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ReactFlowEdge, ReactFlowNodeData } from '../../types';
import { GraphCanvas } from '../../graph/core/GraphCanvas';
import type { GraphCanvasHandle, GraphEdge, GraphNode, Point, SelectionState } from '../../graph/core/types';
import { GraphControls, GraphMiniMap, GraphPanel } from '../../graph/chrome';
import type { RoleCategoryNodeData } from '../../graph/theme/roleTheme';
import { filterGraph } from '../../graph/layouts/filterGraph';
import { activeRoleThemePack, useThemeSceneState } from '../../graph/themes';
import GraphFilterPanel from './GraphFilterPanel';
import type { RoleLayoutGraphProps } from './SharedGraphTypes';

/**
 * Below this zoom a focused node would still be a sliver, so an external
 * selection zooms in to `FOCUS_REVEAL_ZOOM` instead of keeping the camera zoom.
 */
export const FOCUS_MIN_ZOOM = 0.35;
export const FOCUS_REVEAL_ZOOM = 0.6;
const FOCUS_DURATION_MS = 300;

/**
 * Should a `selectedNodeId` change move the camera? Only when the selection did
 * NOT originate from the graph's own `onNodeSelect` (tracked as `lastEmittedId`):
 * the user is already looking at a node they clicked, but a pick from the tier
 * list / file tree / rundown may be off-screen.
 */
export function shouldFocusExternalSelection(
  lastEmittedId: string | null,
  selectedNodeId: string | null
): boolean {
  return selectedNodeId !== null && selectedNodeId !== lastEmittedId;
}

/** Zoom to use when focusing: keep the current zoom unless it is too far out to reveal a node. */
export function focusZoomFor(currentZoom: number): number | undefined {
  return currentZoom < FOCUS_MIN_ZOOM ? FOCUS_REVEAL_ZOOM : undefined;
}

export default function RoleLayoutGraph({
  graphData,
  searchQuery,
  languageFilter,
  roleFilter,
  onNodeSelect,
  onCategorySelect,
  onEdgeClick,
  onPaneClick,
  selectedNodeId,
  selectionSource,
  onLanguageFilterChange,
  onRoleFilterChange,
  onSearchChange,
  nodeThemeOverride,
}: RoleLayoutGraphProps) {
  const pack = activeRoleThemePack;
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const { state: themeState, actions: themeActions } = useThemeSceneState();
  /** Last file id this graph emitted via onNodeSelect (consumed by the focus effect). */
  const lastEmittedNodeIdRef = useRef<string | null>(null);

  // ---- data flow: filter → layout → scene ---------------------------------
  const filtered = useMemo(
    () => filterGraph(graphData, { searchQuery, languageFilter, roleFilter }),
    [graphData, searchQuery, languageFilter, roleFilter]
  );

  const scene = useMemo(
    () => pack.buildScene({ nodes: filtered.nodes, edges: filtered.edges, state: themeState }),
    [pack, filtered, themeState]
  );

  // Original API edges by id (onEdgeClick hands the API edge back to the page)
  const edgesById = useMemo(() => {
    const map = new Map<string, ReactFlowEdge>();
    graphData.edges.forEach((edge) => map.set(edge.id, edge));
    return map;
  }, [graphData]);

  // ---- selection ------------------------------------------------------------
  // A node selection (from the graph, tier list or file tree) supersedes any
  // locally selected edge, mirroring the previous behaviour.
  useEffect(() => {
    if (selectedNodeId) setSelectedEdgeId(null);
  }, [selectedNodeId]);

  // Camera follows selections that came from outside the graph (tier list,
  // file tree, rundown). Selections the graph emitted itself are already in view.
  useEffect(() => {
    const emitted = lastEmittedNodeIdRef.current;
    lastEmittedNodeIdRef.current = null; // consumed: the next change starts clean
    if (!shouldFocusExternalSelection(emitted, selectedNodeId) || !selectedNodeId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.focusNode(selectedNodeId, {
      duration: FOCUS_DURATION_MS,
      zoom: focusZoomFor(canvas.getViewport().zoom),
    });
  }, [selectedNodeId]);

  const selection = useMemo<SelectionState>(
    () => ({
      nodeId: selectedNodeId,
      source: selectionSource,
      edgeId: selectedEdgeId,
      containerId: null,
    }),
    [selectedNodeId, selectionSource, selectedEdgeId]
  );

  // ---- interaction ----------------------------------------------------------
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.kind === 'file') {
        setSelectedEdgeId(null);
        lastEmittedNodeIdRef.current = node.id;
        onNodeSelect(node.id, node.data as ReactFlowNodeData);
        return;
      }
      if (node.kind === 'category') {
        if (pack.collapsible) {
          themeActions.toggle(node.id);
          return;
        }
        const catData = node.data as RoleCategoryNodeData;
        const roleFiles = graphData.nodes
          .filter((n) => n.data.role === catData.role)
          .map((n) => n.data);
        setSelectedEdgeId(null);
        onCategorySelect({
          label: catData.label,
          role: catData.role,
          nodeCount: catData.nodeCount,
          description: '',
          files: roleFiles,
        });
      }
      // folder / section: nothing to do in this layout
    },
    [graphData, onNodeSelect, onCategorySelect, pack, themeActions]
  );

  const handleEdgeClick = useCallback(
    (edge: GraphEdge, clientPos: Point) => {
      setSelectedEdgeId(edge.id);
      const apiEdge = edgesById.get(edge.id) ?? (edge as ReactFlowEdge);
      onEdgeClick?.(apiEdge, clientPos);
    },
    [edgesById, onEdgeClick]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedEdgeId(null);
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
      data-testid="role-layout-graph"
      className="w-full h-full relative"
      style={{ background: pack.theme.background }}
    >
      <GraphCanvas
        ref={canvasRef}
        scene={scene}
        theme={pack.theme}
        renderers={pack.renderers}
        selection={selection}
        nodeThemeOverride={nodeThemeOverride}
        nodesDraggable={pack.canvas?.nodesDraggable ?? true}
        // Refit on filter changes only — a scene rebuilt for a category toggle keeps the camera.
        fitViewKey={filtered}
        fitViewOnSceneChange={{ padding: pack.canvas?.fitPadding }}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onBackgroundClick={handleBackgroundClick}
        className={`w-full h-full ${pack.canvasClassName ?? ''}`}
      >
        <GraphPanel position="top-left" className="m-4">
          <GraphFilterPanel
            palette={pack.filterPalette ?? 'dark'}
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
        {pack.Overlay && <pack.Overlay scene={scene} state={themeState} actions={themeActions} />}
      </GraphCanvas>
    </div>
  );
}
