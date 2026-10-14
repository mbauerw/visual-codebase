# `src/graph` — in-house graph engine

Renders a `GraphScene` (absolute-positioned nodes + edges) inside a CSS-transformed
world element. Nodes are ordinary React components picked from a renderer
registry; edges are SVG paths; the viewport is an external store that writes the
world transform imperatively (no React re-render per frame). See
`implementations/visualization-overhaul-plan.md` for the rationale.

Import rules: relative imports only (no `@/` alias in vite.config.ts).
`@xyflow/react` (and `@dagrejs/dagre`) are no longer dependencies of the
frontend at all — nothing may import them (`grep -rn "@xyflow" src` must stay
empty; `edges/smoothStepPath.ts` is a pure port). `framer-motion` (not
`motion`) for components.

## Module map & public signatures

### core/types.ts — data model (see file)
`Point, Rect, Size, Viewport, ZoomLimits, NodeKind, NodeLayer, KIND_LAYER, GraphNode, GraphEdge, GraphScene,
SelectionState, EMPTY_SELECTION, NodeHighlight, EdgeHighlight, HighlightMap, LodLevel, LodThresholds, ZoomBucket,
NodeRenderProps, NodeRenderer, NodeRendererRegistry, GraphCanvasCallbacks, FitViewOptions, FocusNodeOptions, GraphCanvasHandle`

### theme/types.ts — theme contract (see file)
`AnchorSide, NodeThemeTokens, ResolvedNodeTheme, EdgeThemeTokens, ResolvedEdgeStyle, GraphTheme, NodeThemeOverrideFn`

### theme/resolve.ts (pure)
```ts
mergeNodeTokens(base: NodeThemeTokens, ...overrides: (Partial<NodeThemeTokens> | undefined)[]): NodeThemeTokens
   // shallow merge; `ring` merged per key; `className` concatenated with a space; `style` shallow-merged; `motion` shallow-merged
resolveNodeTheme(theme: GraphTheme, node: GraphNode, override?: NodeThemeOverrideFn): ResolvedNodeTheme
   // theme.nodes[node.kind] → override?.(node) → node.themeOverride; fills every NodeHighlight key of `ring` with '' when absent; className/style always defined
resolveEdgeStyle(theme: GraphTheme, highlight: EdgeHighlight): ResolvedEdgeStyle
   // { ...theme.edges.base, ...theme.edges.byHighlight[highlight] }
```

### core/viewportMath.ts (pure)
```ts
clampZoom(zoom: number, limits: ZoomLimits): number
zoomAtPoint(vp: Viewport, screenPoint: Point, factor: number, limits: ZoomLimits): Viewport
   // z' = clamp(z*factor); t' = p - ((p - t) / z) * z'   → the world point under `screenPoint` stays fixed
screenToWorld(vp: Viewport, p: Point): Point      // (p - t) / z
worldToScreen(vp: Viewport, p: Point): Point      // p * z + t
getViewportForBounds(bounds: Rect, size: Size, opts: { padding?: number; limits: ZoomLimits }): Viewport
   // padding default 0.1 (fraction of the container); zoom = clamp(min(w/(bw*(1+2p)), h/(bh*(1+2p)))); bounds centred; degenerate bounds/size → zoom clamp(1)
getViewportForCenter(worldPoint: Point, size: Size, zoom: number): Viewport
getVisibleWorldRect(vp: Viewport, size: Size, padWorld?: number): Rect
rectsIntersect(a: Rect, b: Rect): boolean
```

### core/tween.ts (pure, injectable timing)
```ts
type Easing = (t: number) => number
easeInOutCubic: Easing   // default
lerp(a: number, b: number, t: number): number
lerpViewport(a: Viewport, b: Viewport, t: number): Viewport
interface TweenOptions { duration: number; easing?: Easing; onUpdate: (t01: number) => void; onComplete?: () => void;
                         now?: () => number; raf?: (cb: FrameRequestCallback) => number; caf?: (id: number) => void }
interface TweenHandle { cancel(): void; finished: Promise<void> }   // finished resolves on complete AND on cancel
tween(opts: TweenOptions): TweenHandle   // duration <= 0 → onUpdate(1) + onComplete synchronously
```

### core/lod.ts (pure)
```ts
nodeScreenWidth(node: GraphNode, zoom: number): number          // width * (scale ?? 1) * zoom
getLod(screenPx: number, thresholds: LodThresholds, prev?: LodLevel, hysteresis?: number /* default 0.15 */): LodLevel
   // 'far' below farBelowPx, 'near' above nearAbovePx, else 'mid'; with prev, thresholds widen by ±hysteresis fraction so a level is only left after crossing the band
```

### core/highlights.ts (pure)
```ts
EMPTY_HIGHLIGHTS: HighlightMap
computeHighlights(sel: SelectionState, edges: readonly GraphEdge[]): HighlightMap
   // 1) nodeId → node 'selected'|'tierlist'; incident edges 'connected'|'connected-tierlist'; other endpoints same; all other edges 'dimmed'
   // 2) else edgeId → edge 'selected', all others 'dimmed', endpoints 'edge-endpoint'; plus rule 3 if containerId
   // 3) else containerId → node 'container-selected'
   // 4) else EMPTY_HIGHLIGHTS
getNodeHighlight(map: HighlightMap, id: string): NodeHighlight   // default 'none'
getEdgeHighlight(map: HighlightMap, id: string): EdgeHighlight   // default 'none'
```

### core/sceneUtils.ts (pure)
```ts
nodeRect(node: GraphNode): Rect
getSceneBounds(nodes: readonly GraphNode[]): Rect                 // union; empty → {0,0,0,0}
getNodesBounds(nodes: readonly GraphNode[], ids: ReadonlySet<string> | readonly string[]): Rect
buildNodeIndex(nodes: readonly GraphNode[]): Map<string, GraphNode>
buildParentMap(nodes: readonly GraphNode[]): Map<string, GraphNode[]>   // parentId → children
getDescendants(nodes: readonly GraphNode[], id: string): GraphNode[]
createScene(nodes: GraphNode[], edges: GraphEdge[]): GraphScene     // computes bounds; drops edges whose endpoints aren't both present
```

### core/viewportStore.ts
```ts
interface ViewportStore {
  get(): Viewport                    // last COMMITTED snapshot (stable object until it changes)
  peek(): Viewport                   // latest value passed to set() (may be uncommitted)
  getContainerSize(): Size
  getVisibleWorldRect(): Rect        // cached per commit
  getLimits(): ZoomLimits
  subscribe(listener: () => void): () => void
  set(v: Viewport): void             // clamps zoom; writes world.style.transform NOW; schedules ONE commit via raf
  setContainerSize(size: Size): void // commits immediately (notifies)
  setLimits(limits: ZoomLimits): void
  attachWorld(el: HTMLElement | null): void   // applies current transform to the element immediately
  animateTo(v: Viewport, durationMs: number): Promise<void>  // tween via set(); cancels any running animation; 0 → set() directly
  cancelAnimation(): void
  destroy(): void                    // cancels raf/animation
}
createViewportStore(init?: { viewport?: Viewport; limits?: ZoomLimits; containerSize?: Size;
                            raf?: (cb: FrameRequestCallback) => number; caf?: (id: number) => void; now?: () => number }): ViewportStore
// transform string: `translate(${x}px, ${y}px) scale(${zoom})`; transform-origin is set by GraphCanvas ('0 0')
```

### core/GraphContext.tsx
```ts
interface GraphContextValue { store: ViewportStore; theme: GraphTheme; renderers: NodeRendererRegistry; scene: GraphScene;
                              nodeIndex: Map<string, GraphNode>; highlights: HighlightMap; callbacks: GraphCanvasCallbacks;
                              nodeThemeOverride?: NodeThemeOverrideFn; actions: GraphCanvasHandle }
GraphContext, GraphProvider, useGraphContext(), useGraphStore(), useGraphTheme(), useGraphRenderers(), useGraphScene(),
useGraphNodeIndex(), useGraphHighlights(), useGraphCallbacks(), useGraphActions(), useNodeThemeOverride()
```

### core/useViewport.ts (hooks; all read the store from GraphContext unless a store is passed)
```ts
useViewport(store?): Viewport
useZoom(store?): number
useContainerSizeValue(store?): Size
useVisibleWorldRect(store?): Rect
useZoomBucket(referenceWidth?: number /* default 200 world px */): ZoomBucket   // getLod(referenceWidth * zoom, theme.lod, prev) with hysteresis via a ref
useLod(node: GraphNode): LodLevel                                              // getLod(nodeScreenWidth(node, zoom), theme.lod, prev)
// implemented with useSyncExternalStore; snapshots are primitives/stable objects so no render loops
```

### core/useContainerSize.ts
```ts
useContainerSizeObserver(ref: RefObject<HTMLElement>, store: ViewportStore): void
   // initial getBoundingClientRect measure + ResizeObserver → store.setContainerSize (only when changed)
```

### core/useCanvasGestures.ts
```ts
interface CanvasGestureOptions { enabled?: boolean; zoomOnDoubleClick?: boolean; panButtons?: number[] /* default [0,1,2] */;
                                 onBackgroundClick?: () => void; wheelSensitivity?: number }
useCanvasGestures(containerRef: RefObject<HTMLElement>, store: ViewportStore, opts?: CanvasGestureOptions): void
// Native listeners attached in useEffect:
//  pointerdown: ignore if target.closest('[data-graph-nopan]'); phase 'pending'; preventDefault ONLY for button 1
//  pointermove: pending && dist>4px → 'panning': setPointerCapture, container.dataset.panning='true'; store.set(start + delta)
//  pointerup/cancel: release; if panned → suppress next click (setTimeout 0); delete dataset.panning
//  click: if suppressed → ignore; else if !target.closest('[data-node-id],[data-edge-id],[data-graph-overlay]') → onBackgroundClick()
//  wheel {passive:false}: ignore if target.closest('[data-graph-nowheel]'); preventDefault;
//         k = exp(-deltaY * (deltaMode===1 ? 0.05 : deltaMode ? 1 : 0.002) * (ctrlKey ? 10 : 1)) * (wheelSensitivity ?? 1 factor);
//         store.set(zoomAtPoint(store.peek(), cursorInContainer, k, limits))
//  gesturestart/change/end (Safari): preventDefault
//  dblclick on background (same closest test): store.animateTo(zoomAtPoint(vp, p, 1.5), 200)
//  contextmenu: preventDefault
```

### edges/smoothStepPath.ts (pure port of @xyflow/system getSmoothStepPath, MIT)
```ts
interface SmoothStepParams { sourceX: number; sourceY: number; sourcePosition?: AnchorSide /* 'bottom' */; targetX: number; targetY: number;
                             targetPosition?: AnchorSide /* 'top' */; borderRadius?: number /* 5 */; centerX?: number; centerY?: number; offset?: number /* 20 */ }
getSmoothStepPath(p: SmoothStepParams): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number]
```

### edges/anchors.ts (pure)
```ts
getAnchor(node: GraphNode, side: AnchorSide): Point   // slot centre ± (size * (scale ?? 1)) / 2 on the given side
getEdgeEndpoints(source: GraphNode, target: GraphNode, anchors: { source: AnchorSide; target: AnchorSide }):
   { sourceX, sourceY, targetX, targetY, sourcePosition: AnchorSide, targetPosition: AnchorSide }
```

### edges/markers.tsx, EdgeItem.tsx, EdgeLayer.tsx, EdgeLabelLayer.tsx
```ts
markerId(color: string, size: number): string                          // `gm-arrow-${sanitized color}-${size}`
<MarkerDefs entries={Array<{color,size}>} />                            // one <marker markerUnits="userSpaceOnUse" orient="auto-start-reverse"> each
<EdgeItem edge source target highlight style={ResolvedEdgeStyle} anchors onClick onHover />   // memo; visible path (pointer-events:none) + hit path (stroke transparent, width max(12, w*3), pointer-events:stroke)
<EdgeLayer />          // reads scene/highlights/theme/callbacks from context; <svg data-graph-edges style=position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none>
<EdgeLabelLayer />     // HTML layer (class graph-layer-edge-labels); hidden when useZoomBucket() === 'far'; each label: absolute, transform translate(-50%,-50%) translate(lx,ly); data-edge-id; click → onEdgeClick(edge,{x:clientX,y:clientY})
```

### chrome/
```ts
<GraphPanel position="top-left|top-right|bottom-left|bottom-right" className>   // absolute in overlay, pointer-events:auto, data-graph-nopan data-graph-nowheel data-graph-overlay
<GraphControls className? />        // zoom in / zoom out / fit via useGraphActions(); theme.chrome.buttonClassName
<GraphMiniMap width=200 height=150 className? />   // svg viewBox=scene.bounds; rect per node (skip 'section'); viewport mask; drag → setViewport centring
```

### core/GraphCanvas.tsx
```ts
interface GraphCanvasProps extends GraphCanvasCallbacks {
  scene: GraphScene; theme: GraphTheme; renderers: NodeRendererRegistry; selection?: SelectionState;
  nodeThemeOverride?: NodeThemeOverrideFn; fitViewOnSceneChange?: boolean | FitViewOptions /* default true */;
  zoomOnDoubleClick?: boolean; className?: string; style?: CSSProperties; children?: ReactNode; debugMeasure?: boolean
}
GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>
// DOM: div[data-testid=graph-canvas][data-graph-canvas] (relative w-full h-full overflow-hidden select-none; bg theme.background; touch-action:none)
//   > div[data-graph-world] (absolute left/top 0; transform-origin 0 0; transform managed by store)
//       > NodeLayer background | NodeLayer containers | EdgeLayer | NodeLayer nodes | EdgeLabelLayer
//   > div[data-graph-overlay] (absolute inset-0 pointer-events-none) > children
// CSS (module-level, injected once or in index.css): [data-graph-canvas][data-panning] .graph-layer-nodes,.graph-layer-containers,.graph-layer-edge-labels { pointer-events:none } ; [data-panning] { cursor:grabbing }
```

### core/NodeLayer.tsx, NodeWrapper.tsx
```ts
<NodeLayer layer="background|containers|nodes" />   // class `graph-layer-${layer}`; picks nodes by KIND_LAYER; containers sorted by depth asc; passes highlight prop
<NodeWrapper node highlight />   // React.memo; div[data-testid=graph-node-<id>][data-node-id][data-node-kind] absolute; transform translate(x,y); width/height;
                                 // pointer-events none when interactive===false; onClick stopPropagation → callbacks.onNodeClick; dbl/hover; contextmenu prevented;
                                 // resolves theme; useLod(node); renders registry[kind] or a fallback grey box
```

### layouts/
```ts
filterGraph(graph, { searchQuery, languageFilter, roleFilter }): { nodes, edges }   // edges kept only when both endpoints survive
computeRoleLayout(fileNodes, edges, config?): RoleLayoutResult; toRoleScene(layout, edges): GraphScene   // role layout (roleLayout.ts / roleScene.ts)
computeNestedLayout(fileNodes: ReactFlowNode[], config?: Partial<NestedLayoutConfig>): NestedLayoutResult
   // { folders: NestedFolderBox[]; files: NestedFileBox[] } — ABSOLUTE coords, parents before children; folder ids `folder-<path>`;
   // folder depth 1 = top-level (drives the amber ramp), file depth = parent + 1; top-level entries side by side (`topLevelGap`)
toNestedScene(layout: NestedLayoutResult, edges: readonly GraphEdge[]): GraphScene
   // folders → kind 'folder' (interactive, data NestedFolderNodeData); files → kind 'file' (parentId = folder id, data = the ORIGINAL ReactFlowNodeData)
DEFAULT_NESTED_LAYOUT_CONFIG   // fileNodeWidth/Height 150×60 = the nested file slot; renderers must fit it
```

### renderers/
`renderers/role` (`roleRenderers`: file/category/section), `renderers/nested` (`nestedRenderers`: file/folder) and
`renderers/rundown` (`rundownRenderers`: category → `RundownLayerNode`, file → `RundownEntryPointNode` — the read-only
Rundown flow diagram, `components/rundown/RundownFlowDiagram.tsx`; scene from `components/rundown/layoutUtils.ts`,
theme `theme/rundownTheme.ts`: light `#f8fafc` background, indigo dashed edges with a CSS marching animation in
`index.css` (`.rundown-flow-canvas`), anchors bottom→top, zoom 0.5–1.5, LOD pinned to `near`, no chrome/selection). Nested:
`NestedFileNode` (white card, language-coloured left border, name + language pill/role label; `far` hides the second row),
`NestedFolderNode` (depth-coloured box, header with icon/label/count pill; `far` hides the pill; ring `container-selected`
comes from the theme — use a Tailwind shadow class, never an inline `box-shadow`, or the ring is overridden).

## Renderer conventions
- The wrapper positions/sizes the slot and applies `node.className`/`node.style`; it does NOT apply `node.scale`
  or ring classes. A renderer's root should be `w-full h-full`, apply `transform: scale(node.scale ?? 1)` with
  `transformOrigin: 'center center'` when it wants the visual scale (anchor math already assumes it), and apply
  `theme.ring[highlight]` (plus any selection scale bump) itself. Animate an inner element for hover; never use
  framer-motion `layout`/`drag` inside the world.
- `lod` is `'far' | 'mid' | 'near'` from `node.width * scale * zoom` vs `theme.lod` (hysteresis applied).
- Container renderers with `interactive: false` must set `pointer-events: auto` on the clickable part (header pill);
  the click bubbles to the wrapper and fires `onNodeClick(node)`.

## LOD & theming in practice (role renderers)

**Levels.** `useLod(node)` keys on on-screen slot width `node.width * (node.scale ?? 1) * zoom` against
`theme.lod` (±15 % hysteresis, see `core/lod.ts`). The role renderers make each level a deliberate design:

| level | `RoleFileNode` | `RoleCategoryNode` |
|---|---|---|
| `far`  | surface tile only, wide role-coloured left bar, **zero children** (cheapest DOM) | header pill = label + count (no icon) |
| `mid`  | icon + file name | icon + label + count |
| `near` | icon + file name + role/language pills; the pill row fades in/out with `AnimatePresence` (opacity/y only, `initial={false}` so first paint is static) | same as mid |

`roleTheme.lod = { farBelowPx: 90, nearAbovePx: 140 }`: file labels are 24 world px on a 240 px slot (label px ≈
width/10), pills 16 px (≈ width/15), so labels appear at ≈9 px text and pills at ≈9 px text; tuned on the
synthetic-200 scene (comment in `theme/roleTheme.ts`). `useZoomBucket(200)` shares the thresholds, so edge
labels hide below zoom ≈ 0.45.

**Animation.** Renderer root = `motion.div` that animates the visual scale (`animate={{ scale: tier × selection bump }}`,
`initial={false}`); an INNER `motion.div` (the surface) carries `whileHover={theme.motion?.whileHover}` — framer merges
`scale` per element, so hover on a scale-2 node composes (2 × 1.04) instead of collapsing to 1.04. The wrapper stays
the hit area; ring/brightness changes ease with `transition-[box-shadow,filter]`. Verified: hovering the edge of a
scaled surface does not jitter (the surface only grows under the cursor).

**Tokens.** `NodeThemeTokens.surface / border / text / radius` are consumed by both role renderers via inline style,
falling back to today's values (`#1e293b` / `#7d7d7de9` / `#fff` / 8 for files; role tint / role colour / role colour / 24
for categories). `ring[highlight]` and `motion` come from the theme too. Wrapper-level `className` / `style` are
applied by `NodeWrapper`.

**Overrides.** `GraphCanvas nodeThemeOverride?: (node) => Partial<NodeThemeTokens> | undefined` layers between
`theme.nodes[kind]` and `node.themeOverride` (`resolveNodeTheme`). `BaseGraphProps.nodeThemeOverride` threads it
through `RoleLayoutGraph`. Memoise the function — a new identity re-renders every node. Example (the "emphasise
search matches" checkbox on `/graph-dev`): dim non-matching files with `{ className: 'opacity-40' }` (the class lands
on the wrapper, so ring and tile fade together).

**Camera follows external selection.** `RoleLayoutGraph` remembers the last id it emitted via `onNodeSelect`; a
`useEffect` on `selectedNodeId` calls `focusNode(id, { duration: 300, zoom })` only when the new id was NOT the graph's
own emission (`shouldFocusExternalSelection`) — i.e. it came from the tier list / file tree / rundown. Zoom is kept
unless it is below `FOCUS_MIN_ZOOM` (0.35), in which case it reveals at `FOCUS_REVEAL_ZOOM` (0.6) (`focusZoomFor`).

## Verification without the Chrome extension
`/graph-dev` (`graph/dev/*`) is a kept dev harness: `App.tsx` registers the route only when `import.meta.env.DEV`
and lazy-loads the page, so it (and the MSW handlers it imports) never reach the production bundle.
Run `npm run dev` and drive `/graph-dev` (or the app) with a Playwright script placed in `frontend/` (so
`@playwright/test` resolves), e.g. `chromium.launch()` → `page.goto('http://localhost:5173/graph-dev')` →
screenshots to the scratchpad. StrictMode double-mounts effects in dev — never destroy the viewport store in an
effect cleanup. `/graph-dev` exposes `window.__graphDevGenerate(n, e, seed)` (seed `sessionStorage.analysisResult`
for `/visualize`) and `window.__graphDevHandle` (the `GraphCanvasHandle`: `focusNode(id, { zoom, duration: 0 })`
is the quickest way to screenshot a given LOD).

## Node dragging & position overrides (opt-in)
- `GraphCanvas` prop `nodesDraggable` (default **false**). When on, `useNodeDrag` (core/useNodeDrag.ts) runs in
  `NodeWrapper`: pointerdown on an interactive node → 4px threshold → capture on the wrapper, `data-dragging`,
  offsets written to the **position store** (`core/positionStore.ts`, `createPositionStore()`, per-id
  subscriptions via `useNodeOffset(id)` / `useOffsetNode(node)` in `core/usePositions.ts`). Container nodes
  (folder/category) move all descendants. On pointerup → `onNodeDragEnd(id, {x, y})` and the trailing click is
  suppressed. Holding Space forces a pan instead. With dragging off, a press on a node still pans (unchanged).
- Wrappers translate by `x + dx`; edges/labels subscribe to their two endpoints' offsets so only touched edges
  re-render. Offsets are cleared when the `scene` identity changes unless `preservePositionsOnSceneChange` is set.
- `applyPositionOverrides(scene, overrides)` (core/sceneUtils.ts) bakes offsets into a new scene — the hook for
  future "layout saving" (todo.md).
- The app wrappers do not enable dragging yet; the `/graph-dev` harness has a "draggable" checkbox.

## Viewport culling (opt-in)
- `GraphCanvas` prop `cullNodes` (default **false**): the `nodes` layer only mounts file nodes intersecting the
  visible world rect padded by 25% and quantised to a 512-world-px grid; container/section layers are never culled.
  Unmounting resets hover/animation state, so keep it off unless a scene is large enough to need it (measure on
  `/graph-dev` synthetic 2000 with the "cull" checkbox).
