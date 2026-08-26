/**
 * RoleLayoutGraph on the in-house graph engine — renders the real component
 * with the mock analysis graph and checks the wrapper's contract: node/category/
 * edge/background dispatch, filtering + "Showing X of Y", and selection rings.
 *
 * jsdom has no layout, so getBoundingClientRect() is 0 and no fitView runs;
 * the DOM structure and callbacks are unaffected.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import RoleLayoutGraph, {
  FOCUS_MIN_ZOOM,
  FOCUS_REVEAL_ZOOM,
  focusZoomFor,
  shouldFocusExternalSelection,
} from '../RoleLayoutGraph';
import type { RoleLayoutGraphProps } from '../SharedGraphTypes';
import { mockReactFlowGraph } from '../../../test/mocks/handlers';
import { filterGraph } from '../../../graph/layouts/filterGraph';
import { computeRoleLayout } from '../../../graph/layouts/roleLayout';
import { toRoleScene } from '../../../graph/layouts/roleScene';
import { getViewportForCenter } from '../../../graph/core/viewportMath';
import type { Viewport } from '../../../graph/core/types';

function renderGraph(overrides: Partial<RoleLayoutGraphProps> = {}) {
  const props: RoleLayoutGraphProps = {
    graphData: mockReactFlowGraph,
    searchQuery: '',
    languageFilter: 'all',
    roleFilter: 'all',
    onNodeSelect: vi.fn(),
    onCategorySelect: vi.fn(),
    onEdgeClick: vi.fn(),
    onPaneClick: vi.fn(),
    selectedNodeId: null,
    selectionSource: null,
    onSearchChange: vi.fn(),
    onLanguageFilterChange: vi.fn(),
    onRoleFilterChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<RoleLayoutGraph {...props} />);
  return { ...utils, props };
}

const fileNodeIds = mockReactFlowGraph.nodes.map((n) => n.id);

describe('RoleLayoutGraph (graph engine)', () => {
  it('renders the canvas inside the wrapper root', () => {
    renderGraph();
    const root = screen.getByTestId('role-layout-graph');
    expect(root).toBeInTheDocument();
    expect(root.querySelector('[data-testid="graph-canvas"]')).toBeInTheDocument();
    // No React Flow DOM
    expect(document.querySelector('.react-flow')).toBeNull();
  });

  it('renders one file node per mock node plus category and section nodes', () => {
    renderGraph();
    fileNodeIds.forEach((id) => {
      const el = screen.getByTestId(`graph-node-${id}`);
      expect(el).toHaveAttribute('data-node-kind', 'file');
    });
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(fileNodeIds.length);
    // Both mock files are frontend react_component → one category, one frontend section
    expect(document.querySelectorAll('[data-node-kind="category"]').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll('[data-node-kind="section"]').length).toBeGreaterThanOrEqual(1);
    // One edge for the mock graph
    expect(document.querySelectorAll('[data-testid^="graph-edge-"]')).toHaveLength(mockReactFlowGraph.edges.length);
  });

  it('shows the filter panel with "Showing X of Y"', () => {
    renderGraph();
    expect(screen.getByPlaceholderText('Search files...')).toBeInTheDocument();
    expect(screen.getByText(`Showing ${fileNodeIds.length} of ${fileNodeIds.length} files`)).toBeInTheDocument();
  });

  it('clicking a file node calls onNodeSelect with the API id and original data', () => {
    const { props } = renderGraph();
    fireEvent.click(screen.getByTestId('graph-node-node1'));
    expect(props.onNodeSelect).toHaveBeenCalledTimes(1);
    const [id, data] = (props.onNodeSelect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('node1');
    expect(data).toMatchObject(mockReactFlowGraph.nodes[0].data);
    expect(props.onPaneClick).not.toHaveBeenCalled();
  });

  it('clicking the category pill calls onCategorySelect with role + files', () => {
    const { props } = renderGraph();
    const category = document.querySelector('[data-node-kind="category"]') as HTMLElement;
    expect(category).not.toBeNull();
    const pill = category.querySelector('[data-testid="role-category-pill"]') as HTMLElement;
    expect(pill).not.toBeNull();
    fireEvent.click(pill);
    expect(props.onCategorySelect).toHaveBeenCalledTimes(1);
    const payload = (props.onCategorySelect as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.role).toBe('react_component');
    expect(payload.label).toBe('React Component');
    expect(payload.nodeCount).toBe(2);
    expect(payload.description).toBe('');
    expect(payload.files).toHaveLength(2);
    expect(props.onNodeSelect).not.toHaveBeenCalled();
  });

  it('clicking an edge calls onEdgeClick with the ORIGINAL API edge and a client position', () => {
    const { props } = renderGraph();
    const edge = screen.getByTestId('graph-edge-edge1');
    // second path = the wide transparent hit path
    const hit = edge.querySelector('path:nth-child(2)') as SVGPathElement;
    expect(hit).not.toBeNull();
    fireEvent.click(hit, { clientX: 40, clientY: 50 });
    expect(props.onEdgeClick).toHaveBeenCalledTimes(1);
    const [apiEdge, pos] = (props.onEdgeClick as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(apiEdge).toBe(mockReactFlowGraph.edges[0]);
    expect(pos).toEqual({ x: 40, y: 50 });
    // edge selection → endpoints get the edge-endpoint ring
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'edge-endpoint');
    expect(screen.getByTestId('graph-node-node2')).toHaveAttribute('data-highlight', 'edge-endpoint');
  });

  it('search filters file nodes and updates "Showing X of Y"', () => {
    const { rerender, props } = renderGraph();
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(2);
    rerender(<RoleLayoutGraph {...props} searchQuery="index" />);
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(1);
    expect(screen.getByTestId('graph-node-node1')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-node-node2')).toBeNull();
    expect(screen.getByText('Showing 1 of 2 files')).toBeInTheDocument();
    // the edge lost an endpoint → gone
    expect(document.querySelectorAll('[data-testid^="graph-edge-"]')).toHaveLength(0);
  });

  it('role filter with no match renders zero file nodes', () => {
    renderGraph({ roleFilter: 'model' });
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(0);
    expect(screen.getByText('Showing 0 of 2 files')).toBeInTheDocument();
  });

  it('selectedNodeId highlights the node and its neighbour', () => {
    renderGraph({ selectedNodeId: 'node1', selectionSource: 'node' });
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'selected');
    expect(screen.getByTestId('graph-node-node2')).toHaveAttribute('data-highlight', 'connected');
  });

  it('selectionSource="tierlist" applies the tierlist highlight', () => {
    renderGraph({ selectedNodeId: 'node2', selectionSource: 'tierlist' });
    expect(screen.getByTestId('graph-node-node2')).toHaveAttribute('data-highlight', 'tierlist');
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'connected-tierlist');
  });

  it('a new node selection clears a previously selected edge', () => {
    const { rerender, props } = renderGraph();
    const hit = screen.getByTestId('graph-edge-edge1').querySelector('path:nth-child(2)') as SVGPathElement;
    fireEvent.click(hit, { clientX: 1, clientY: 1 });
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'edge-endpoint');
    rerender(<RoleLayoutGraph {...props} selectedNodeId="node2" selectionSource="node" />);
    expect(screen.getByTestId('graph-node-node2')).toHaveAttribute('data-highlight', 'selected');
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'connected');
  });

  it('clicking the canvas background calls onPaneClick', () => {
    const { props } = renderGraph();
    fireEvent.click(screen.getByTestId('graph-canvas'));
    expect(props.onPaneClick).toHaveBeenCalledTimes(1);
    expect(props.onNodeSelect).not.toHaveBeenCalled();
  });

  it('clicking inside the filter panel does not count as a background click', () => {
    const { props } = renderGraph();
    fireEvent.click(screen.getByPlaceholderText('Search files...'));
    expect(props.onPaneClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Category dragging: grab anywhere on the category box that isn't a file node
// ---------------------------------------------------------------------------

describe('RoleLayoutGraph category dragging', () => {
  const nodeTranslate = (el: HTMLElement) => {
    const m = /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/.exec(el.style.transform);
    if (!m) throw new Error(`unexpected transform: ${el.style.transform}`);
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
  };

  it('categories are draggable, files and sections are not', () => {
    renderGraph();
    const category = document.querySelector('[data-node-kind="category"]') as HTMLElement;
    expect(category).toHaveAttribute('data-node-draggable');
    fileNodeIds.forEach((id) => {
      expect(screen.getByTestId(`graph-node-${id}`)).not.toHaveAttribute('data-node-draggable');
    });
    const section = document.querySelector('[data-node-kind="section"]') as HTMLElement;
    expect(section).not.toHaveAttribute('data-node-draggable');
  });

  it('dragging the category box moves the category and its files; the drag-end click does not open the panel', () => {
    const { props } = renderGraph();
    const category = document.querySelector('[data-node-kind="category"]') as HTMLElement;
    const file = screen.getByTestId('graph-node-node1');
    const categoryStart = nodeTranslate(category);
    const fileStart = nodeTranslate(file);

    fireEvent.pointerDown(category, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    // within the 4px threshold: nothing moves yet
    fireEvent.pointerMove(category, { pointerId: 1, clientX: 102, clientY: 101 });
    expect(nodeTranslate(category)).toEqual(categoryStart);
    // beyond the threshold: category + descendant files follow (zoom 1 → world delta = client delta)
    fireEvent.pointerMove(category, { pointerId: 1, clientX: 130, clientY: 120 });
    expect(category).toHaveAttribute('data-dragging');
    expect(nodeTranslate(category)).toEqual({ x: categoryStart.x + 30, y: categoryStart.y + 20 });
    expect(nodeTranslate(file)).toEqual({ x: fileStart.x + 30, y: fileStart.y + 20 });

    fireEvent.pointerUp(category, { pointerId: 1, button: 0, clientX: 130, clientY: 120 });
    expect(category).not.toHaveAttribute('data-dragging');
    // the click the browser fires after the drag is swallowed …
    fireEvent.click(category);
    expect(props.onCategorySelect).not.toHaveBeenCalled();
    // … but only that one
    fireEvent.click(category);
    expect(props.onCategorySelect).toHaveBeenCalledTimes(1);
  });

  it('a plain click anywhere on the category box (not just the pill) opens the category panel', () => {
    const { props } = renderGraph();
    const category = document.querySelector('[data-node-kind="category"]') as HTMLElement;
    fireEvent.pointerDown(category, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(category, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    fireEvent.click(category);
    expect(props.onCategorySelect).toHaveBeenCalledTimes(1);
    expect(props.onPaneClick).not.toHaveBeenCalled();
  });

  it('a pointer drag starting on a file pans the canvas instead of moving the file', () => {
    renderGraph();
    const file = screen.getByTestId('graph-node-node1');
    const canvas = screen.getByTestId('graph-canvas');
    const start = nodeTranslate(file);
    fireEvent.pointerDown(file, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(file, { pointerId: 1, clientX: 40, clientY: 30 });
    expect(nodeTranslate(file)).toEqual(start);
    expect(canvas.dataset.panning).toBe('true');
    fireEvent.pointerUp(file, { pointerId: 1, button: 0, clientX: 40, clientY: 30 });
  });
});

// ---------------------------------------------------------------------------
// Phase 3: camera follows EXTERNAL selections (tier list / file tree / rundown)
// ---------------------------------------------------------------------------

describe('shouldFocusExternalSelection / focusZoomFor (pure)', () => {
  it('focuses when a non-null selection was not emitted by the graph', () => {
    expect(shouldFocusExternalSelection(null, 'node1')).toBe(true);
    expect(shouldFocusExternalSelection('node2', 'node1')).toBe(true);
  });
  it('does not focus for the graph\'s own emission or a cleared selection', () => {
    expect(shouldFocusExternalSelection('node1', 'node1')).toBe(false);
    expect(shouldFocusExternalSelection(null, null)).toBe(false);
    expect(shouldFocusExternalSelection('node1', null)).toBe(false);
  });
  it('keeps the camera zoom unless it is too far out, then reveals at FOCUS_REVEAL_ZOOM', () => {
    expect(focusZoomFor(1)).toBeUndefined();
    expect(focusZoomFor(FOCUS_MIN_ZOOM)).toBeUndefined();
    expect(focusZoomFor(FOCUS_MIN_ZOOM - 0.01)).toBe(FOCUS_REVEAL_ZOOM);
    expect(focusZoomFor(0.05)).toBe(FOCUS_REVEAL_ZOOM);
  });
});

describe('RoleLayoutGraph focusNode on external selection', () => {
  const SIZE = { width: 800, height: 600 };
  const originalRect = HTMLElement.prototype.getBoundingClientRect;

  /** jsdom has no layout: pretend every element is `size` so the canvas gets a container size. */
  function mockLayout(size = SIZE) {
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height, width: size.width, height: size.height, toJSON() {} } as DOMRect;
    };
  }
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  /** Expected viewport after focusing `id` at `zoom` (same maths as GraphCanvas.focusNode). */
  function expectedFocusViewport(id: string, zoom: number, size = SIZE): Viewport {
    const filtered = filterGraph(mockReactFlowGraph, { searchQuery: '', languageFilter: 'all', roleFilter: 'all' });
    const scene = toRoleScene(computeRoleLayout(filtered.nodes, filtered.edges), filtered.edges);
    const node = scene.nodes.find((n) => n.id === id)!;
    return getViewportForCenter({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, size, zoom);
  }
  const worldTransform = () => (document.querySelector('[data-graph-world]') as HTMLElement).style.transform;
  /** Parse `translate(Xpx, Ypx) scale(Z)` back into a viewport. */
  function parseTransform(t: string): Viewport {
    const m = /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\((-?[\d.e-]+)\)/.exec(t);
    if (!m) throw new Error(`unexpected transform: ${t}`);
    return { x: parseFloat(m[1]), y: parseFloat(m[2]), zoom: parseFloat(m[3]) };
  }
  function expectViewportClose(actual: Viewport, expected: Viewport) {
    expect(actual.x).toBeCloseTo(expected.x, 3);
    expect(actual.y).toBeCloseTo(expected.y, 3);
    expect(actual.zoom).toBeCloseTo(expected.zoom, 6);
  }

  it('a selection present from the start (external) moves the camera onto the node', async () => {
    mockLayout();
    renderGraph({ selectedNodeId: 'node2', selectionSource: 'tierlist' });
    // store starts at zoom 1 (>= FOCUS_MIN_ZOOM) → keeps zoom 1 and centres node2; the 300ms tween must finish
    await waitFor(() => expectViewportClose(parseTransform(worldTransform()), expectedFocusViewport('node2', 1)), { timeout: 2000 });
  });

  it('a selection the graph emitted itself does NOT move the camera', async () => {
    mockLayout();
    const { rerender, props } = renderGraph();
    // auto-fit happens once the container size is known
    await waitFor(() => expect(worldTransform()).not.toBe(''));
    const fitted = worldTransform();
    fireEvent.click(screen.getByTestId('graph-node-node1'));
    expect(props.onNodeSelect).toHaveBeenCalledWith('node1', expect.anything());
    rerender(<RoleLayoutGraph {...props} selectedNodeId="node1" selectionSource="node" />);
    await new Promise((r) => setTimeout(r, 400));
    expect(worldTransform()).toBe(fitted);
    // ...but a later external pick of ANOTHER node does move it
    rerender(<RoleLayoutGraph {...props} selectedNodeId="node2" selectionSource="node" />);
    await waitFor(() => expect(worldTransform()).not.toBe(fitted), { timeout: 2000 });
  });

  it('zooms in to FOCUS_REVEAL_ZOOM when the camera is far out', async () => {
    // a small container makes the auto-fit of the mock scene (huge section ellipses) land below FOCUS_MIN_ZOOM
    const small = { width: 400, height: 300 };
    mockLayout(small);
    const { rerender, props } = renderGraph();
    await waitFor(() => expect(parseTransform(worldTransform()).zoom).toBeLessThan(FOCUS_MIN_ZOOM));
    rerender(<RoleLayoutGraph {...props} selectedNodeId="node1" selectionSource="tierlist" />);
    await waitFor(
      () => expectViewportClose(parseTransform(worldTransform()), expectedFocusViewport('node1', FOCUS_REVEAL_ZOOM, small)),
      { timeout: 2000 }
    );
  });
});
