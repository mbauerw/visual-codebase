/**
 * Public surface of the in-house graph engine.
 */

// Core
export { GraphCanvas } from './core/GraphCanvas';
export type { GraphCanvasProps } from './core/GraphCanvas';
export * from './core/types';
export { computeHighlights, getNodeHighlight, getEdgeHighlight, EMPTY_HIGHLIGHTS } from './core/highlights';
export { getLod, nodeScreenWidth } from './core/lod';
export {
  createScene,
  getSceneBounds,
  getNodesBounds,
  buildNodeIndex,
  buildParentMap,
  getDescendants,
  createDescendantsIndex,
  applyPositionOverrides,
  nodeRect,
} from './core/sceneUtils';
export { createPositionStore, ZERO_OFFSET, isZeroDelta } from './core/positionStore';
export type { PositionStore } from './core/positionStore';
export { useNodeOffset, useOffsetNode, usePositionsVersion } from './core/usePositions';
export {
  clampZoom,
  zoomAtPoint,
  screenToWorld,
  worldToScreen,
  getViewportForBounds,
  getViewportForCenter,
  getVisibleWorldRect,
  rectsIntersect,
  quantiseCullRect,
} from './core/viewportMath';
export { createViewportStore } from './core/viewportStore';
export type { ViewportStore } from './core/viewportStore';
export { useViewport, useZoom, useContainerSizeValue, useVisibleWorldRect, useZoomBucket, useLod } from './core/useViewport';
export {
  useGraphContext,
  useGraphStore,
  useGraphTheme,
  useGraphRenderers,
  useGraphScene,
  useGraphNodeIndex,
  useGraphHighlights,
  useGraphCallbacks,
  useGraphActions,
  useNodeThemeOverride,
  useGraphPositions,
} from './core/GraphContext';

// Theme
export * from './theme/types';
export { resolveNodeTheme, resolveEdgeStyle, mergeNodeTokens } from './theme/resolve';
export { roleTheme, ROLE_BACKGROUND } from './theme/roleTheme';
export type { RoleCategoryNodeData, RoleSectionNodeData } from './theme/roleTheme';
export { nestedTheme, NESTED_BACKGROUND, getDepthColor, getDepthBorderColor, getDepthTextColor } from './theme/nestedTheme';
export type { NestedFolderNodeData } from './theme/nestedTheme';

// Edges
export { getSmoothStepPath } from './edges/smoothStepPath';
export { getAnchor, getEdgeEndpoints } from './edges/anchors';

// Chrome
export * from './chrome';

// Layouts
export { filterGraph } from './layouts/filterGraph';
export type { GraphFilters } from './layouts/filterGraph';
export { computeNestedLayout, toNestedScene, DEFAULT_NESTED_LAYOUT_CONFIG } from './layouts/nestedLayout';
export type { NestedLayoutConfig, NestedLayoutResult, NestedFolderBox, NestedFileBox } from './layouts/nestedLayout';

// Renderers
export { nestedRenderers } from './renderers/nested';
