/**
 * GraphCanvas — the engine's root component.
 *
 *   <div data-graph-canvas>                       container: gestures, sizing, background
 *     <div data-graph-world>                      world: transform managed imperatively by the viewport store
 *       NodeLayer background | NodeLayer containers | EdgeLayer | NodeLayer nodes | EdgeLabelLayer
 *     <div data-graph-overlay>{children}</div>    screen-space chrome (GraphPanel / Controls / MiniMap)
 *
 * The viewport store writes the world transform directly to the DOM, so
 * panning/zooming never re-renders React; only LOD flips and highlight changes
 * do. Selection is controlled (`selection` prop) and turned into a HighlightMap
 * with the pure `computeHighlights`.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './../graph.css';
import {
  EMPTY_SELECTION,
  type FitViewOptions,
  type FocusNodeOptions,
  type GraphCanvasCallbacks,
  type GraphCanvasHandle,
  type GraphScene,
  type NodeRendererRegistry,
  type Point,
  type SelectionState,
  type Viewport,
} from './types';
import type { GraphTheme, NodeThemeOverrideFn } from '../theme/types';
import { GraphProvider, useGraphActions, type GraphContextValue } from './GraphContext';
import { createViewportStore } from './viewportStore';
import { createPositionStore, ZERO_OFFSET } from './positionStore';
import { attachSpaceKeyTracking } from './spaceKey';
import { useContainerSizeObserver } from './useContainerSize';
import { useCanvasGestures } from './useCanvasGestures';
import { useContainerSizeValue } from './useViewport';
import { computeHighlights } from './highlights';
import { applyPositionOverrides, buildNodeIndex, createDescendantsIndex, getNodesBounds } from './sceneUtils';
import {
  clampZoom,
  getViewportForBounds,
  getViewportForCenter,
  screenToWorld as screenToWorldMath,
  worldToScreen as worldToScreenMath,
  zoomAtPoint,
} from './viewportMath';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from '../edges/EdgeLayer';
import { EdgeLabelLayer } from '../edges/EdgeLabelLayer';

export interface GraphCanvasProps extends GraphCanvasCallbacks {
  scene: GraphScene;
  theme: GraphTheme;
  renderers: NodeRendererRegistry;
  /** Controlled selection; turned into highlights via computeHighlights. */
  selection?: SelectionState;
  nodeThemeOverride?: NodeThemeOverrideFn;
  /** Fit the scene whenever its identity changes (default true). First fit is instant, later fits animate 200ms. */
  fitViewOnSceneChange?: boolean | FitViewOptions;
  zoomOnDoubleClick?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Screen-space chrome rendered in the overlay slot. */
  children?: ReactNode;
  /** Dev aid: warn when a renderer's DOM size deviates from its slot. */
  debugMeasure?: boolean;
  /**
   * Let nodes be dragged with the pointer (default false). Offsets live in the
   * canvas's position store (`positions` on the graph context) on top of the
   * scene's layout; `onNodeDragEnd(id, {x, y})` reports the new absolute position.
   * Space held while pressing pans instead. Containers drag their descendants.
   */
  nodesDraggable?: boolean;
  /** Keep drag offsets when the `scene` prop identity changes (default false → cleared). */
  preservePositionsOnSceneChange?: boolean;
  /**
   * Only mount file nodes near the viewport (default false; containers/sections
   * are never culled). See NodeLayer for the padding/quantisation rules.
   */
  cullNodes?: boolean;
}

const ZOOM_STEP = 1.2;
const DEFAULT_ANIM_MS = 150;

/**
 * Inner component so hooks that read the store through context
 * (useContainerSizeValue) can run below the provider.
 */
function AutoFit({ scene, option }: { scene: GraphScene; option: boolean | FitViewOptions }) {
  const size = useContainerSizeValue();
  const lastFitScene = useRef<GraphScene | null>(null);
  const actions = useGraphActions();

  useLayoutEffect(() => {
    if (option === false) return;
    if (size.width === 0 || size.height === 0) return;
    if (lastFitScene.current === scene) return;
    const isFirst = lastFitScene.current === null;
    lastFitScene.current = scene;
    const opts: FitViewOptions = typeof option === 'object' ? option : {};
    actions.fitView({ padding: opts.padding, duration: isFirst ? 0 : (opts.duration ?? 200), nodeIds: opts.nodeIds });
  }, [scene, size, option, actions]);

  return null;
}

/** Dev-only: compare each node's rendered layout size to its slot and warn on drift.
 *  Uses offsetWidth/offsetHeight (layout size, independent of world/zoom/framer transforms). */
function DebugMeasure({ containerRef, scene }: { containerRef: React.RefObject<HTMLDivElement>; scene: GraphScene }) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    scene.nodes.forEach((n) => {
      const nodeEl = el.querySelector(`[data-node-id="${CSS.escape(n.id)}"] > *`) as HTMLElement | null;
      if (!nodeEl) return;
      const w = nodeEl.offsetWidth;
      const h = nodeEl.offsetHeight;
      if (Math.abs(w - n.width) > 8 || Math.abs(h - n.height) > 8) {
        console.warn(`[graph] node ${n.id} (${n.kind}) renders ${w}x${h} but slot is ${n.width}x${n.height}`);
      }
    });
  }, [containerRef, scene]);
  return null;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  {
    scene,
    theme,
    renderers,
    selection = EMPTY_SELECTION,
    nodeThemeOverride,
    fitViewOnSceneChange = true,
    zoomOnDoubleClick = true,
    className = '',
    style,
    children,
    debugMeasure = false,
    nodesDraggable = false,
    preservePositionsOnSceneChange = false,
    cullNodes = false,
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onEdgeClick,
    onBackgroundClick,
    onViewportChange,
    onNodeDragEnd,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // One store per canvas instance.
  const [store] = useState(() => createViewportStore({ limits: theme.zoom }));
  useEffect(() => {
    store.setLimits(theme.zoom);
  }, [store, theme.zoom]);
  // Note: no store.destroy() in an effect cleanup — React 18 StrictMode
  // mounts → unmounts → remounts effects in dev, which would kill a store that
  // lives in component state. Cancel in-flight animation instead.
  useEffect(() => () => store.cancelAnimation(), [store]);

  useLayoutEffect(() => {
    store.attachWorld(worldRef.current);
    return () => store.attachWorld(null);
  }, [store]);

  // Position overrides (node dragging). Cleared when the scene identity changes
  // (new layout / filter) unless the caller wants to keep them.
  const [positions] = useState(() => createPositionStore());
  const lastSceneRef = useRef<GraphScene | null>(null);
  useLayoutEffect(() => {
    if (lastSceneRef.current !== null && lastSceneRef.current !== scene && !preservePositionsOnSceneChange) {
      positions.clear();
    }
    lastSceneRef.current = scene;
  }, [scene, positions, preservePositionsOnSceneChange]);

  // Space bar = force pan while dragging is enabled (window listeners, ref-counted).
  useEffect(() => (nodesDraggable ? attachSpaceKeyTracking() : undefined), [nodesDraggable]);

  useContainerSizeObserver(containerRef, store);

  // Viewport change notifications (rAF-committed).
  useEffect(() => {
    if (!onViewportChange) return;
    return store.subscribe(() => onViewportChange(store.get()));
  }, [store, onViewportChange]);

  // Stable callbacks object so memoised nodes/edges don't re-render on parent renders.
  const callbacks = useMemo<GraphCanvasCallbacks>(
    () => ({ onNodeClick, onNodeDoubleClick, onNodeHover, onEdgeClick, onBackgroundClick, onViewportChange, onNodeDragEnd }),
    [onNodeClick, onNodeDoubleClick, onNodeHover, onEdgeClick, onBackgroundClick, onViewportChange, onNodeDragEnd]
  );

  useCanvasGestures(containerRef, store, { zoomOnDoubleClick, onBackgroundClick });

  const nodeIndex = useMemo(() => buildNodeIndex(scene.nodes), [scene.nodes]);
  const descendantIds = useMemo(() => createDescendantsIndex(scene.nodes), [scene.nodes]);
  const highlights = useMemo(() => computeHighlights(selection, scene.edges), [selection, scene.edges]);

  // ---- imperative actions -------------------------------------------------
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const fitView = useCallback(
    (opts: FitViewOptions = {}) => {
      const size = store.getContainerSize();
      if (size.width === 0 || size.height === 0) return;
      const s = sceneRef.current;
      // Whole-scene fit uses the layout bounds; a subset fit honours drag offsets.
      const bounds =
        opts.nodeIds && opts.nodeIds.length > 0
          ? getNodesBounds(applyPositionOverrides(s, positions.getAll()).nodes, opts.nodeIds)
          : s.bounds;
      const target = getViewportForBounds(bounds, size, { padding: opts.padding ?? 0.1, limits: store.getLimits() });
      const duration = opts.duration ?? 0;
      if (duration > 0) void store.animateTo(target, duration);
      else store.set(target);
    },
    [store, positions]
  );

  const focusNode = useCallback(
    (id: string, opts: FocusNodeOptions = {}) => {
      const node = sceneRef.current.nodes.find((n) => n.id === id);
      if (!node) return;
      const size = store.getContainerSize();
      const zoom = clampZoom(opts.zoom ?? store.peek().zoom, store.getLimits());
      const off = positions.get(id) ?? ZERO_OFFSET; // dragged nodes are centred where they actually are
      const center: Point = { x: node.x + off.dx + node.width / 2, y: node.y + off.dy + node.height / 2 };
      const target = getViewportForCenter(center, size, zoom);
      const duration = opts.duration ?? 300;
      if (duration > 0) void store.animateTo(target, duration);
      else store.set(target);
    },
    [store, positions]
  );

  const zoomBy = useCallback(
    (factor: number, duration = DEFAULT_ANIM_MS) => {
      const size = store.getContainerSize();
      const center: Point = { x: size.width / 2, y: size.height / 2 };
      const target = zoomAtPoint(store.peek(), center, factor, store.getLimits());
      if (duration > 0) void store.animateTo(target, duration);
      else store.set(target);
    },
    [store]
  );

  const actions = useMemo<GraphCanvasHandle>(
    () => ({
      fitView,
      focusNode,
      zoomIn: (duration) => zoomBy(ZOOM_STEP, duration),
      zoomOut: (duration) => zoomBy(1 / ZOOM_STEP, duration),
      zoomTo: (zoom, duration = DEFAULT_ANIM_MS) => {
        const cur = store.peek();
        zoomBy(clampZoom(zoom, store.getLimits()) / cur.zoom, duration);
      },
      getViewport: () => store.peek(),
      setViewport: (viewport: Viewport, duration = 0) => {
        if (duration > 0) void store.animateTo(viewport, duration);
        else store.set(viewport);
      },
      /** `p` is container-relative screen px. */
      screenToWorld: (p) => screenToWorldMath(store.peek(), p),
      worldToScreen: (p) => worldToScreenMath(store.peek(), p),
    }),
    [fitView, focusNode, zoomBy, store]
  );

  useImperativeHandle(ref, () => actions, [actions]);

  const ctxValue = useMemo<GraphContextValue>(
    () => ({
      store,
      theme,
      renderers,
      scene,
      nodeIndex,
      highlights,
      callbacks,
      nodeThemeOverride,
      actions,
      positions,
      nodesDraggable,
      cullNodes,
      descendantIds,
    }),
    [store, theme, renderers, scene, nodeIndex, highlights, callbacks, nodeThemeOverride, actions, positions, nodesDraggable, cullNodes, descendantIds]
  );

  return (
    <GraphProvider value={ctxValue}>
      <div
        ref={containerRef}
        data-testid="graph-canvas"
        data-graph-canvas=""
        role="presentation"
        className={`relative w-full h-full overflow-hidden ${className}`}
        style={{ background: theme.background, ...style }}
      >
        <div
          ref={worldRef}
          data-graph-world=""
          style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', willChange: 'transform' }}
        >
          <NodeLayer layer="background" />
          <NodeLayer layer="containers" />
          <EdgeLayer />
          <NodeLayer layer="nodes" />
          <EdgeLabelLayer />
        </div>
        <div data-graph-overlay="" className="absolute inset-0 pointer-events-none">
          {children}
        </div>
        <AutoFit scene={scene} option={fitViewOnSceneChange} />
        {debugMeasure && <DebugMeasure containerRef={containerRef} scene={scene} />}
      </div>
    </GraphProvider>
  );
});

export default GraphCanvas;
