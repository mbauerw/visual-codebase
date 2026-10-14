/**
 * React context shared by everything rendered inside a GraphCanvas.
 *
 * Kept deliberately small: the viewport store is read through
 * useSyncExternalStore hooks (see useViewport.ts) so panning never re-renders
 * consumers; only structural values (scene, theme, highlights, callbacks) live
 * here. Per-node highlight is passed as a prop by NodeLayer/EdgeLayer so that
 * memoised nodes/edges only re-render when their own state changes.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type {
  GraphCanvasCallbacks,
  GraphCanvasHandle,
  GraphNode,
  GraphScene,
  HighlightMap,
  NodeRendererRegistry,
} from './types';
import type { GraphTheme, NodeThemeOverrideFn } from '../theme/types';
import type { ViewportStore } from './viewportStore';
import type { PositionStore } from './positionStore';

export interface GraphContextValue {
  store: ViewportStore;
  theme: GraphTheme;
  renderers: NodeRendererRegistry;
  scene: GraphScene;
  nodeIndex: Map<string, GraphNode>;
  highlights: HighlightMap;
  callbacks: GraphCanvasCallbacks;
  nodeThemeOverride?: NodeThemeOverrideFn;
  actions: GraphCanvasHandle;
  /** Per-node position overrides (node dragging). One store per canvas. */
  positions: PositionStore;
  /** `GraphCanvas` prop `nodesDraggable` (default false). */
  nodesDraggable: boolean;
  /** `GraphCanvas` prop `cullNodes` (default false): the 'nodes' layer only mounts nodes near the viewport. */
  cullNodes: boolean;
  /** Ids of all transitive descendants of a node (memoised per scene; a container drag moves them too). */
  descendantIds: (id: string) => readonly string[];
}

export const GraphContext = createContext<GraphContextValue | null>(null);

export function GraphProvider({ value, children }: { value: GraphContextValue; children: ReactNode }) {
  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export function useGraphContext(): GraphContextValue {
  const ctx = useContext(GraphContext);
  if (!ctx) {
    throw new Error('Graph hooks must be used inside <GraphCanvas>');
  }
  return ctx;
}

export function useGraphStore(): ViewportStore {
  return useGraphContext().store;
}

export function useGraphTheme(): GraphTheme {
  return useGraphContext().theme;
}

export function useGraphRenderers(): NodeRendererRegistry {
  return useGraphContext().renderers;
}

export function useGraphScene(): GraphScene {
  return useGraphContext().scene;
}

export function useGraphNodeIndex(): Map<string, GraphNode> {
  return useGraphContext().nodeIndex;
}

export function useGraphHighlights(): HighlightMap {
  return useGraphContext().highlights;
}

export function useGraphCallbacks(): GraphCanvasCallbacks {
  return useGraphContext().callbacks;
}

export function useGraphActions(): GraphCanvasHandle {
  return useGraphContext().actions;
}

export function useNodeThemeOverride(): NodeThemeOverrideFn | undefined {
  return useGraphContext().nodeThemeOverride;
}

export function useGraphPositions(): PositionStore {
  return useGraphContext().positions;
}
