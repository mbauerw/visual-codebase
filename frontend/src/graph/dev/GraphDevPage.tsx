/**
 * /graph-dev — development harness for the graph engine and its theme packs.
 * Renders the curated demo graph, the MSW mock graph or a synthetic N-node
 * graph through any registered role theme pack.
 *
 * URL params: `?theme=<pack id>&scene=demo|mock|200|1000|2000` (kept in sync
 * with the selects so a look can be linked/screenshotted directly).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GraphCanvas } from '../core/GraphCanvas';
import type { GraphCanvasHandle, GraphEdge, GraphNode, SelectionState, Viewport } from '../core/types';
import { EMPTY_SELECTION } from '../core/types';
import type { NodeThemeOverrideFn } from '../theme/types';
import type { ReactFlowNodeData } from '../../types';
import { GraphControls } from '../chrome/GraphControls';
import { GraphMiniMap } from '../chrome/GraphMiniMap';
import { GraphPanel } from '../chrome/GraphPanel';
import { findRoleThemePack, roleThemePacks, useThemeSceneState, type RoleThemePack } from '../themes';
import { generateSyntheticGraph } from './syntheticGraph';
import { demoGraph } from './demoGraph';
import { mockReactFlowGraph } from '../../test/mocks/handlers';
import type { ReactFlowGraph } from '../../types';

type SceneChoice = 'demo' | 'mock' | '200' | '1000' | '2000';
const SCENE_CHOICES: SceneChoice[] = ['demo', 'mock', '200', '1000', '2000'];

function buildGraph(choice: SceneChoice): ReactFlowGraph {
  switch (choice) {
    case 'demo':
      return demoGraph;
    case 'mock':
      return mockReactFlowGraph;
    case '200':
      return generateSyntheticGraph(200, 500, 1);
    case '1000':
      return generateSyntheticGraph(1000, 2500, 2);
    case '2000':
      return generateSyntheticGraph(2000, 5000, 3);
  }
}

// Dev hooks so browser scripts can seed sessionStorage['analysisResult'] for
// /visualize and drive the canvas (zoomTo / focusNode) for LOD screenshots.
interface GraphDevWindow {
  __graphDevGenerate?: typeof generateSyntheticGraph;
  __graphDevHandle?: GraphCanvasHandle | null;
}
(window as unknown as GraphDevWindow).__graphDevGenerate = generateSyntheticGraph;

/**
 * Example `nodeThemeOverride`: dim files whose label/path does not contain the
 * query. Class goes on the wrapper, so the whole tile (ring included) fades.
 * Returning `undefined` leaves the theme untouched for non-file nodes.
 */
function makeSearchEmphasisOverride(query: string): NodeThemeOverrideFn {
  const q = query.trim().toLowerCase();
  return (node) => {
    if (node.kind !== 'file' || !q) return undefined;
    const d = node.data as ReactFlowNodeData;
    const match = d.label.toLowerCase().includes(q) || d.path.toLowerCase().includes(q);
    return match ? undefined : { className: 'opacity-40' };
  };
}

function readParams(): { theme: RoleThemePack; scene: SceneChoice } {
  const params = new URLSearchParams(window.location.search);
  const theme = findRoleThemePack(params.get('theme')) ?? roleThemePacks[roleThemePacks.length - 1];
  const s = params.get('scene');
  const scene = SCENE_CHOICES.includes(s as SceneChoice) ? (s as SceneChoice) : 'demo';
  return { theme, scene };
}

function writeParams(theme: string, scene: string) {
  const params = new URLSearchParams(window.location.search);
  params.set('theme', theme);
  params.set('scene', scene);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export default function GraphDevPage() {
  const initial = useMemo(readParams, []);
  const [pack, setPack] = useState<RoleThemePack>(initial.theme);
  const [choice, setChoice] = useState<SceneChoice>(initial.scene);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [lastEvent, setLastEvent] = useState<string>('—');
  const [emphasise, setEmphasise] = useState(false);
  const [query, setQuery] = useState('');
  const [draggable, setDraggable] = useState(false);
  const [cull, setCull] = useState(false);
  const { state: themeState, actions: themeActions } = useThemeSceneState();
  const handleRef = useRef<GraphCanvasHandle>(null);
  const renders = useRef(0);
  renders.current += 1;

  useEffect(() => {
    (window as unknown as GraphDevWindow).__graphDevHandle = handleRef.current;
    return () => {
      (window as unknown as GraphDevWindow).__graphDevHandle = null;
    };
  }, []);

  useEffect(() => writeParams(pack.id, choice), [pack.id, choice]);

  // Memoised: a new override function re-renders every node.
  const nodeThemeOverride = useMemo<NodeThemeOverrideFn | undefined>(
    () => (emphasise ? makeSearchEmphasisOverride(query) : undefined),
    [emphasise, query]
  );

  const graph = useMemo(() => buildGraph(choice), [choice]);

  const scene = useMemo(() => {
    const t0 = performance.now();
    const s = pack.buildScene({ nodes: graph.nodes, edges: graph.edges, state: themeState });
    // eslint-disable-next-line no-console
    console.log(
      `[graph-dev] ${pack.id}/${choice}: ${s.nodes.length} nodes, ${s.edges.length} edges in ${(performance.now() - t0).toFixed(1)}ms`
    );
    return s;
  }, [pack, graph, choice, themeState]);

  const onNodeClick = useCallback(
    (node: GraphNode) => {
      setLastEvent(`node ${node.kind} ${node.id}`);
      if (node.kind === 'file') {
        setSelection({ nodeId: node.id, source: 'node', edgeId: null, containerId: null });
      } else if (node.kind === 'category' && pack.collapsible) {
        themeActions.toggle(node.id);
      }
    },
    [pack.collapsible, themeActions]
  );
  const onEdgeClick = useCallback((edge: GraphEdge, pos: { x: number; y: number }) => {
    setLastEvent(`edge ${edge.id} @ ${pos.x},${pos.y}`);
    setSelection({ nodeId: null, source: null, edgeId: edge.id, containerId: null });
  }, []);
  const onBackgroundClick = useCallback(() => {
    setLastEvent('background');
    setSelection(EMPTY_SELECTION);
  }, []);
  const onNodeDragEnd = useCallback((id: string, pos: { x: number; y: number }) => {
    setLastEvent(`dragEnd ${id} → ${pos.x.toFixed(0)},${pos.y.toFixed(0)}`);
  }, []);

  const Overlay = pack.Overlay;

  return (
    <div className="w-screen h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="h-12 flex items-center gap-4 px-4 border-b border-slate-700 text-sm">
        <span className="font-semibold">graph-dev</span>
        <label className="flex items-center gap-2" title={pack.description}>
          theme
          <select
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1"
            data-testid="theme-select"
            value={pack.id}
            onChange={(e) => {
              const next = findRoleThemePack(e.target.value);
              if (next) {
                setPack(next);
                themeActions.collapseAll();
                setSelection(EMPTY_SELECTION);
              }
            }}
          >
            {roleThemePacks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          scene
          <select
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1"
            data-testid="scene-select"
            value={choice}
            onChange={(e) => setChoice(e.target.value as SceneChoice)}
          >
            <option value="demo">demo (curated)</option>
            <option value="mock">mock (4 nodes)</option>
            <option value="200">synthetic 200</option>
            <option value="1000">synthetic 1000</option>
            <option value="2000">synthetic 2000</option>
          </select>
        </label>
        <button className="px-2 py-1 bg-slate-700 rounded" onClick={() => handleRef.current?.fitView({ duration: 300 })}>
          fit
        </button>
        <button
          className="px-2 py-1 bg-slate-700 rounded"
          onClick={() => {
            const first = scene.nodes.find((n) => n.kind === 'file');
            if (first) handleRef.current?.focusNode(first.id, { zoom: 1 });
          }}
        >
          focus first file
        </button>
        <label className="flex items-center gap-2" title="nodeThemeOverride demo: dims files not matching the query">
          <input
            type="checkbox"
            data-testid="emphasise-toggle"
            checked={emphasise}
            onChange={(e) => setEmphasise(e.target.checked)}
          />
          emphasise search matches
        </label>
        <input
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 w-32"
          data-testid="emphasise-query"
          placeholder="query…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-2" title="GraphCanvas nodesDraggable: drag nodes (space = pan)">
          <input type="checkbox" data-testid="draggable-toggle" checked={draggable} onChange={(e) => setDraggable(e.target.checked)} />
          draggable
        </label>
        <label className="flex items-center gap-2" title="GraphCanvas cullNodes: only mount file nodes near the viewport">
          <input type="checkbox" data-testid="cull-toggle" checked={cull} onChange={(e) => setCull(e.target.checked)} />
          cull
        </label>
        <span className="text-slate-400 truncate">
          {scene.nodes.length} nodes · {scene.edges.length} edges · renders {renders.current} · vp{' '}
          {viewport.x.toFixed(0)},{viewport.y.toFixed(0)} z{viewport.zoom.toFixed(3)} · last: {lastEvent}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <GraphCanvas
          ref={handleRef}
          scene={scene}
          theme={pack.theme}
          renderers={pack.renderers}
          selection={selection}
          nodeThemeOverride={nodeThemeOverride}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onBackgroundClick={onBackgroundClick}
          onViewportChange={setViewport}
          onNodeDragEnd={onNodeDragEnd}
          nodesDraggable={draggable}
          cullNodes={cull}
          fitViewKey={graph}
          fitViewOnSceneChange={{ padding: pack.canvas?.fitPadding }}
          className={pack.canvasClassName}
          debugMeasure
        >
          <GraphPanel position="top-left" className="m-4">
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 text-xs space-y-1 w-56 text-slate-200">
              <div className="uppercase tracking-wide text-slate-500">{pack.label}</div>
              <div>{pack.description}</div>
              <div className="text-slate-400">
                Drag to pan; wheel to zoom; dblclick zooms in. Click a file to select it
                {pack.collapsible ? '; click a category to open / close it' : ''}.
              </div>
            </div>
          </GraphPanel>
          <GraphControls />
          <GraphMiniMap />
          {Overlay && <Overlay scene={scene} state={themeState} actions={themeActions} />}
        </GraphCanvas>
      </div>
    </div>
  );
}
