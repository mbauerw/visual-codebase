import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GraphProvider, type GraphContextValue } from '../core/GraphContext';
import { createViewportStore } from '../core/viewportStore';
import { createPositionStore } from '../core/positionStore';
import { EdgeLayer } from '../edges/EdgeLayer';
import { EdgeLabelLayer } from '../edges/EdgeLabelLayer';
import type { GraphCanvasCallbacks, GraphEdge, GraphNode, HighlightMap } from '../core/types';
import type { GraphTheme } from '../theme/types';

const nodeTokens = { ring: {} };

const theme: GraphTheme = {
  background: '#0f172a',
  nodes: { file: nodeTokens, folder: nodeTokens, category: nodeTokens, section: nodeTokens },
  edges: {
    base: { stroke: '#475569', strokeWidth: 1.5, markerSize: 20 },
    byHighlight: {
      selected: { stroke: '#3b82f6', strokeWidth: 3, markerSize: 24 },
      dimmed: { opacity: 0.2 },
    },
  },
  anchors: { source: 'top', target: 'bottom' },
  lod: { farBelowPx: 40, nearAbovePx: 140 },
  zoom: { min: 0.05, max: 2 },
  chrome: {
    panelClassName: '',
    buttonClassName: '',
    minimap: { maskColor: 'rgba(0,0,0,0.5)', className: '', nodeColor: () => '#fff' },
  },
};

const nodes: GraphNode[] = [
  { id: 'a', kind: 'file', x: 0, y: 0, width: 100, height: 40, depth: 0, data: null },
  { id: 'b', kind: 'file', x: 300, y: 300, width: 100, height: 40, depth: 0, data: null },
];

const edges: GraphEdge[] = [
  {
    id: 'e-ab',
    source: 'a',
    target: 'b',
    data: { imported_names: ['thing'], module_path: './a', import_type: 'import' },
  },
  { id: 'e-dangling', source: 'a', target: 'missing' },
];

const noopActions: GraphContextValue['actions'] = {
  fitView: () => {},
  focusNode: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  zoomTo: () => {},
  getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  setViewport: () => {},
  screenToWorld: (p) => p,
  worldToScreen: (p) => p,
};

function renderLayers(opts: {
  highlights?: HighlightMap;
  callbacks?: GraphCanvasCallbacks;
  onOuterClick?: () => void;
  zoom?: number;
  edgesOverride?: GraphEdge[];
  withLabels?: boolean;
} = {}) {
  const store = createViewportStore({ viewport: { x: 0, y: 0, zoom: opts.zoom ?? 1 }, limits: theme.zoom });
  const positions = createPositionStore();
  const sceneEdges = opts.edgesOverride ?? edges;
  const value: GraphContextValue = {
    store,
    theme,
    renderers: {},
    scene: { nodes, edges: sceneEdges, bounds: { x: 0, y: 0, width: 400, height: 340 } },
    nodeIndex: new Map(nodes.map((n) => [n.id, n])),
    highlights: opts.highlights ?? { nodes: new Map(), edges: new Map() },
    callbacks: opts.callbacks ?? {},
    actions: noopActions,
    positions,
    nodesDraggable: false,
    cullNodes: false,
    descendantIds: () => [],
  };
  const utils = render(
    <div onClick={opts.onOuterClick}>
      <GraphProvider value={value}>
        <EdgeLayer />
        {opts.withLabels && <EdgeLabelLayer />}
      </GraphProvider>
    </div>,
  );
  return { ...utils, store, positions };
}

describe('EdgeLayer', () => {
  it('renders the svg layer with an edge per resolvable edge and skips dangling ones', () => {
    const { container } = renderLayers();
    const svg = container.querySelector('svg[data-graph-edges]') as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.classList.contains('graph-layer-edges')).toBe(true);
    expect(svg.style.position).toBe('absolute');
    expect(svg.style.overflow).toBe('visible');
    expect(svg.style.pointerEvents).toBe('none');
    expect(screen.getByTestId('graph-edge-e-ab')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-edge-e-dangling')).toBeNull();
    expect(container.querySelectorAll('[data-edge-id]')).toHaveLength(1);
  });

  it('renders a marker def for the styles in use and references it from the path', () => {
    const { container } = renderLayers();
    const marker = container.querySelector('marker#gm-arrow-_475569-20');
    expect(marker).not.toBeNull();
    const visible = screen.getByTestId('graph-edge-e-ab').querySelector('path')!;
    expect(visible.getAttribute('marker-end')).toBe('url(#gm-arrow-_475569-20)');
    // only the used (stroke,size) pair is emitted
    expect(container.querySelectorAll('marker')).toHaveLength(1);
  });

  it('applies the highlight state and resolved style', () => {
    const highlights: HighlightMap = { nodes: new Map(), edges: new Map([['e-ab', 'dimmed']]) };
    const { container } = renderLayers({ highlights });
    const g = screen.getByTestId('graph-edge-e-ab');
    expect(g.getAttribute('data-highlight')).toBe('dimmed');
    const visible = g.querySelector('path')!;
    expect(visible.getAttribute('opacity')).toBe('0.2');
    expect(visible.getAttribute('stroke')).toBe('#475569');
    expect(container.querySelectorAll('marker')).toHaveLength(1);
  });

  it('uses the selected style + marker for a selected edge', () => {
    const highlights: HighlightMap = { nodes: new Map(), edges: new Map([['e-ab', 'selected']]) };
    const { container } = renderLayers({ highlights });
    const visible = screen.getByTestId('graph-edge-e-ab').querySelector('path')!;
    expect(visible.getAttribute('stroke')).toBe('#3b82f6');
    expect(visible.getAttribute('stroke-width')).toBe('3');
    expect(visible.getAttribute('marker-end')).toBe('url(#gm-arrow-_3b82f6-24)');
    expect(container.querySelector('marker#gm-arrow-_3b82f6-24')).not.toBeNull();
  });

  it('the path follows a dragged endpoint (positions.set on the source id) and only that edge re-renders', () => {
    const { positions } = renderLayers({
      withLabels: true,
      edgesOverride: [...edges, { id: 'e-plain', source: 'b', target: 'b' }],
    });
    const visible = () => screen.getByTestId('graph-edge-e-ab').querySelector('path')!;
    const before = visible().getAttribute('d')!;
    const labelBefore = screen.getByTestId('graph-edge-label-e-ab').style.transform;
    const otherBefore = screen.getByTestId('graph-edge-e-plain').querySelector('path')!.getAttribute('d');
    act(() => positions.set('a', { dx: 100, dy: 50 }));
    const after = visible().getAttribute('d')!;
    expect(after).not.toBe(before);
    // source top anchor moved from (50,0) to (150,50): the path now starts there
    expect(after.startsWith('M150 50') || after.startsWith('M 150 50') || after.startsWith('M150,50')).toBe(true);
    // label midpoint moved by half the delta
    expect(screen.getByTestId('graph-edge-label-e-ab').style.transform).not.toBe(labelBefore);
    expect(screen.getByTestId('graph-edge-label-e-ab').style.transform).toBe('translate(-50%,-50%) translate(250px, 195px)');
    // an edge not touching 'a' is untouched
    expect(screen.getByTestId('graph-edge-e-plain').querySelector('path')!.getAttribute('d')).toBe(otherBefore);
    // clearing restores the original geometry
    act(() => positions.clear());
    expect(visible().getAttribute('d')).toBe(before);
  });

  it('click on the hit path calls onEdgeClick with client coords and stops propagation', () => {
    const onEdgeClick = vi.fn();
    const outer = vi.fn();
    renderLayers({ callbacks: { onEdgeClick }, onOuterClick: outer });
    const [, hit] = screen.getByTestId('graph-edge-e-ab').querySelectorAll('path');
    fireEvent.click(hit, { clientX: 123, clientY: 456 });
    expect(onEdgeClick).toHaveBeenCalledTimes(1);
    expect(onEdgeClick).toHaveBeenCalledWith(edges[0], { x: 123, y: 456 });
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('EdgeLabelLayer', () => {
  it('renders a positioned label for edges with data, at the same label point as the geometry', () => {
    const { container } = renderLayers({ withLabels: true });
    const layer = container.querySelector('.graph-layer-edge-labels') as HTMLElement;
    expect(layer).not.toBeNull();
    const label = screen.getByTestId('graph-edge-label-e-ab');
    expect(label.getAttribute('data-edge-id')).toBe('e-ab');
    expect(label.style.position).toBe('absolute');
    // source top anchor (50,0), target bottom anchor (350,340) → label centre midway
    expect(label.style.transform).toBe('translate(-50%,-50%) translate(200px, 170px)');
    expect(label.style.pointerEvents).toBe('auto');
    expect(label).toHaveTextContent('thing');
    expect(screen.queryByTestId('graph-edge-label-e-dangling')).toBeNull();
  });

  it('skips edges without label data', () => {
    renderLayers({ withLabels: true, edgesOverride: [{ id: 'plain', source: 'a', target: 'b' }] });
    expect(screen.getByTestId('graph-edge-plain')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-edge-label-plain')).toBeNull();
  });

  it('is hidden when zoomed far out', () => {
    // 200 world px * 0.1 = 20 screen px < farBelowPx 40 → 'far'
    const { container } = renderLayers({ withLabels: true, zoom: 0.1 });
    expect(container.querySelector('.graph-layer-edge-labels')).toBeNull();
    expect(screen.queryByTestId('graph-edge-label-e-ab')).toBeNull();
  });

  it('label click calls onEdgeClick with client coords and stops propagation', () => {
    const onEdgeClick = vi.fn();
    const outer = vi.fn();
    renderLayers({ withLabels: true, callbacks: { onEdgeClick }, onOuterClick: outer });
    fireEvent.click(screen.getByTestId('graph-edge-label-e-ab'), { clientX: 5, clientY: 6 });
    expect(onEdgeClick).toHaveBeenCalledWith(edges[0], { x: 5, y: 6 });
    expect(outer).not.toHaveBeenCalled();
  });

  it('passes the highlight to the label content', () => {
    const highlights: HighlightMap = { nodes: new Map(), edges: new Map([['e-ab', 'dimmed']]) };
    renderLayers({ withLabels: true, highlights });
    const label = screen.getByTestId('graph-edge-label-e-ab');
    expect((label.firstElementChild as HTMLElement).className).toContain('opacity-30');
  });
});
