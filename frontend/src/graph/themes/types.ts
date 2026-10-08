/**
 * Role-layout theme packs.
 *
 * A pack bundles everything one *look* of the role layout needs: the engine
 * theme (colours, edge strokes, LOD thresholds, chrome), the node renderers,
 * and a pure scene builder that turns the filtered files/edges (+ UI state such
 * as which categories are expanded) into a `GraphScene`. `RoleLayoutGraph` and
 * the `/graph-dev` harness only ever talk to a pack, so swapping the look is a
 * one-line change (`activeRoleThemePack` in ./index.ts).
 *
 * Every pack keeps the role layout's containment contract:
 *
 *   section (Frontend / Backend / Tests)  ⊃  category (architectural role)  ⊃  file
 *
 * How those boxes are shaped, coloured, arranged and revealed is the pack's
 * business — that is the whole point of a theme.
 */

import type { ComponentType } from 'react';
import type { ReactFlowEdge, ReactFlowNode } from '../../types';
import type { GraphScene, NodeRendererRegistry } from '../core/types';
import type { GraphTheme } from '../theme/types';

/** UI state a pack's scene may depend on. Owned by the wrapper (useThemeSceneState). */
export interface ThemeSceneState {
  /** Ids of category nodes the user has expanded (collapsible packs only). */
  expanded: ReadonlySet<string>;
}

export interface ThemeSceneInput {
  /** Filtered file nodes (search / language / role filters already applied). */
  nodes: ReactFlowNode[];
  /** Filtered edges (both endpoints survive the filter). */
  edges: ReactFlowEdge[];
  state: ThemeSceneState;
}

export interface ThemeSceneActions {
  toggle(id: string): void;
  expandAll(ids: Iterable<string>): void;
  collapseAll(): void;
}

/** Props handed to a pack's optional screen-space overlay (legend, expand-all…). */
export interface ThemeOverlayProps {
  scene: GraphScene;
  state: ThemeSceneState;
  actions: ThemeSceneActions;
}

export interface RoleThemePack {
  /** Stable id — also the `?theme=` value on /graph-dev. */
  id: string;
  label: string;
  /** One-liner shown in the harness. */
  description: string;
  theme: GraphTheme;
  renderers: NodeRendererRegistry;
  /** Pure: filtered nodes/edges + UI state → scene. Memoised by the caller. */
  buildScene(input: ThemeSceneInput): GraphScene;
  /**
   * Clicking a category toggles it in `state.expanded` (files are hidden until
   * the category is opened) instead of opening the category panel.
   */
  collapsible?: boolean;
  /** Class put on the canvas root so the pack's stylesheet can scope engine-level rules. */
  canvasClassName?: string;
  canvas?: {
    /** Default true: categories can be dragged (files move with them). */
    nodesDraggable?: boolean;
    /** fitView padding fraction (default 0.1). */
    fitPadding?: number;
  };
  /** Screen-space chrome rendered inside the canvas overlay. */
  Overlay?: ComponentType<ThemeOverlayProps>;
  /** Palette of the shared search/filter panel. */
  filterPalette?: 'dark' | 'amber';
}
