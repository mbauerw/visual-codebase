/**
 * Core data model for the in-house graph engine.
 *
 * The engine renders a `GraphScene` (nodes + edges + bounds) inside a
 * CSS-transformed world element. Nodes are ordinary React components chosen
 * from a `NodeRendererRegistry`; edges are SVG paths. All coordinates are
 * ABSOLUTE world coordinates — layout adapters resolve any parent-relative
 * positions before building a scene.
 *
 * Nothing in this file depends on React Flow.
 */

import type { CSSProperties, ComponentType, MouseEvent as ReactMouseEvent } from 'react';
import type { ReactFlowEdgeData } from '../../types';
import type { NodeThemeTokens, ResolvedNodeTheme } from '../theme/types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Camera: world → screen is `screen = world * zoom + (x, y)`. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

/** A world-space translation applied on top of a node's layout position (node dragging). */
export interface PositionDelta {
  dx: number;
  dy: number;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

/**
 * - `file`     : a source file (the only kind whose id is an API node id)
 * - `folder`   : nested-layout folder container
 * - `category` : role-layout role container
 * - `section`  : role-layout Frontend/Backend/Test background ellipse
 */
export type NodeKind = 'file' | 'folder' | 'category' | 'section';

/** Paint layers, bottom → top. Edges are drawn between `containers` and `nodes`. */
export type NodeLayer = 'background' | 'containers' | 'nodes';

export const KIND_LAYER: Record<NodeKind, NodeLayer> = {
  section: 'background',
  category: 'containers',
  folder: 'containers',
  file: 'nodes',
};

export interface GraphNode<TData = unknown> {
  /** Files: the API node id, never remapped. Containers: synthetic (`folder-<path>`, `category-<role>`, `section-<name>`). */
  id: string;
  kind: NodeKind;
  /** Absolute world coordinates of the slot's top-left corner. */
  x: number;
  y: number;
  /** Layout slot. The renderer root must fill it (`w-full h-full`); anchors and containment use it. */
  width: number;
  height: number;
  /** Visual scale about the slot centre (e.g. role `scaleTier`). Anchor math honours it. Default 1. */
  scale?: number;
  parentId?: string;
  /** 0 = root. The containers layer paints depth ascending so children sit over parents. */
  depth: number;
  /** Default true. `false` → wrapper gets `pointer-events: none` (role category container body). */
  interactive?: boolean;
  /**
   * Default true. `false` → never draggable even when the canvas has `nodesDraggable`.
   * (Wrappers of `interactive: false` nodes only receive pointer events from parts
   * that re-enable them, e.g. the role category header pill, which is then the drag handle.)
   */
  draggable?: boolean;
  data: TData;
  /** Per-node override hooks (merged after the theme). */
  className?: string;
  style?: CSSProperties;
  themeOverride?: Partial<NodeThemeTokens>;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/** Structural subset of `ReactFlowEdge` — API edges can be passed straight through. */
export interface GraphEdge<TData = ReactFlowEdgeData> {
  id: string;
  /** Provider / imported file (matches API semantics). */
  source: string;
  /** Consumer / importing file. */
  target: string;
  data?: TData;
}

export interface GraphScene {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Union of node rects; used by fitView and the minimap. */
  bounds: Rect;
}

// ---------------------------------------------------------------------------
// Selection & highlight (derived, never mutated onto nodes)
// ---------------------------------------------------------------------------

export type SelectionSource = 'node' | 'tierlist';

export interface SelectionState {
  /** Selected file node id (API id) or null. */
  nodeId: string | null;
  /** How the node was selected — drives amber vs blue styling. */
  source: SelectionSource | null;
  /** Selected edge id or null. */
  edgeId: string | null;
  /** Selected container id (nested folder) or null. */
  containerId: string | null;
}

export const EMPTY_SELECTION: SelectionState = {
  nodeId: null,
  source: null,
  edgeId: null,
  containerId: null,
};

export type NodeHighlight =
  | 'none'
  | 'selected'            // node selected via 'node'
  | 'tierlist'            // node selected via 'tierlist'
  | 'connected'           // neighbour of a 'node' selection
  | 'connected-tierlist'  // neighbour of a 'tierlist' selection
  | 'edge-endpoint'       // endpoint of the selected edge
  | 'container-selected'; // selected folder

export type EdgeHighlight =
  | 'none'
  | 'selected'
  | 'connected'
  | 'connected-tierlist'
  | 'dimmed';

export interface HighlightMap {
  nodes: ReadonlyMap<string, NodeHighlight>;
  edges: ReadonlyMap<string, EdgeHighlight>;
}

// ---------------------------------------------------------------------------
// Level of detail
// ---------------------------------------------------------------------------

export type LodLevel = 'far' | 'mid' | 'near';

/** On-screen pixel thresholds for a node's width. */
export interface LodThresholds {
  /** Below this many on-screen px the node is 'far'. */
  farBelowPx: number;
  /** Above this many on-screen px the node is 'near'. */
  nearAbovePx: number;
}

export type ZoomBucket = LodLevel;

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export interface NodeRenderProps<TData = unknown> {
  node: GraphNode<TData>;
  highlight: NodeHighlight;
  lod: LodLevel;
  theme: ResolvedNodeTheme;
}

export type NodeRenderer<TData = unknown> = ComponentType<NodeRenderProps<TData>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NodeRendererRegistry = Partial<Record<NodeKind, NodeRenderer<any>>>;

// ---------------------------------------------------------------------------
// Canvas callbacks & imperative handle
// ---------------------------------------------------------------------------

export interface GraphCanvasCallbacks {
  onNodeClick?: (node: GraphNode, e: ReactMouseEvent) => void;
  onNodeDoubleClick?: (node: GraphNode, e: ReactMouseEvent) => void;
  /** `null` when the pointer leaves a node. */
  onNodeHover?: (node: GraphNode | null) => void;
  /** `clientPos` is viewport (clientX/clientY) space, for fixed-position popovers. */
  onEdgeClick?: (edge: GraphEdge, clientPos: Point) => void;
  onBackgroundClick?: () => void;
  /** rAF-committed viewport updates. */
  onViewportChange?: (viewport: Viewport) => void;
  /**
   * Fired when a node drag ends (`nodesDraggable`). `position` is the node's new
   * absolute world position (`node.x + dx`, `node.y + dy`); descendants of a
   * dragged container moved by the same delta (read them from the position store /
   * `applyPositionOverrides`).
   */
  onNodeDragEnd?: (id: string, position: Point) => void;
}

export interface FitViewOptions {
  /** Fraction of the container to leave as margin (0.1 = 10%). */
  padding?: number;
  /** ms; 0 = instant. */
  duration?: number;
  /** Fit only these nodes (default: whole scene). */
  nodeIds?: string[];
}

export interface FocusNodeOptions {
  zoom?: number;
  duration?: number;
}

export interface GraphCanvasHandle {
  fitView: (opts?: FitViewOptions) => void;
  focusNode: (id: string, opts?: FocusNodeOptions) => void;
  zoomIn: (duration?: number) => void;
  zoomOut: (duration?: number) => void;
  zoomTo: (zoom: number, duration?: number) => void;
  getViewport: () => Viewport;
  setViewport: (viewport: Viewport, duration?: number) => void;
  screenToWorld: (p: Point) => Point;
  worldToScreen: (p: Point) => Point;
}
