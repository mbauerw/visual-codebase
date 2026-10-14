/**
 * NestedLayoutGraph on the in-house graph engine — renders the real component
 * with the mock analysis graph and checks the wrapper's contract: file/folder/
 * edge/background dispatch, filtering + "Showing X of Y", and selection rings.
 *
 * jsdom has no layout, so getBoundingClientRect() is 0 and no fitView runs;
 * the DOM structure and callbacks are unaffected.
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import NestedLayoutGraph from '../NestedLayoutGraph';
import type { NestedLayoutGraphProps } from '../SharedGraphTypes';
import { mockReactFlowGraph } from '../../../test/mocks/handlers';

function renderGraph(overrides: Partial<NestedLayoutGraphProps> = {}) {
  const props: NestedLayoutGraphProps = {
    graphData: mockReactFlowGraph,
    searchQuery: '',
    languageFilter: 'all',
    roleFilter: 'all',
    onNodeSelect: vi.fn(),
    onEdgeClick: vi.fn(),
    onPaneClick: vi.fn(),
    selectedNodeId: null,
    selectionSource: null,
    onSearchChange: vi.fn(),
    onLanguageFilterChange: vi.fn(),
    onRoleFilterChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<NestedLayoutGraph {...props} />);
  return { ...utils, props };
}

const fileNodeIds = mockReactFlowGraph.nodes.map((n) => n.id);
// both mock files live in /src → one folder
const FOLDER_ID = 'folder-src';

describe('NestedLayoutGraph (graph engine)', () => {
  it('renders the canvas inside the wrapper root', () => {
    renderGraph();
    const root = screen.getByTestId('nested-layout-graph');
    expect(root).toBeInTheDocument();
    expect(root.querySelector('[data-testid="graph-canvas"]')).toBeInTheDocument();
    // No React Flow DOM
    expect(document.querySelector('.react-flow')).toBeNull();
  });

  it('renders one file node per mock node plus the folder container', () => {
    renderGraph();
    fileNodeIds.forEach((id) => {
      expect(screen.getByTestId(`graph-node-${id}`)).toHaveAttribute('data-node-kind', 'file');
    });
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(fileNodeIds.length);
    const folder = screen.getByTestId(`graph-node-${FOLDER_ID}`);
    expect(folder).toHaveAttribute('data-node-kind', 'folder');
    expect(folder.querySelector('[data-testid="nested-folder-node"]')).toHaveTextContent('src');
    expect(document.querySelectorAll('[data-testid^="graph-edge-"]')).toHaveLength(mockReactFlowGraph.edges.length);
  });

  it('shows the amber filter panel with "Showing X of Y"', () => {
    renderGraph();
    expect(screen.getByPlaceholderText('Search files...')).toBeInTheDocument();
    expect(screen.getByText(`Showing ${fileNodeIds.length} of ${fileNodeIds.length} files`)).toBeInTheDocument();
  });

  it('clicking a file node calls onNodeSelect with the API id and the ORIGINAL data object', () => {
    const { props } = renderGraph();
    fireEvent.click(screen.getByTestId('graph-node-node1'));
    expect(props.onNodeSelect).toHaveBeenCalledTimes(1);
    const [id, data] = (props.onNodeSelect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('node1');
    expect(data).toBe(mockReactFlowGraph.nodes[0].data);
    expect(data.size_bytes).toBe(1000);
    expect(data.line_count).toBe(50);
    expect(props.onPaneClick).not.toHaveBeenCalled();
  });

  it('clicking a folder rings it (container-selected) and does NOT call onNodeSelect', () => {
    const { props } = renderGraph();
    const folder = screen.getByTestId(`graph-node-${FOLDER_ID}`);
    fireEvent.click(folder);
    expect(folder).toHaveAttribute('data-highlight', 'container-selected');
    expect(folder.querySelector('[data-testid="nested-folder-node"]')!.className).toContain('ring-amber-800');
    expect(props.onNodeSelect).not.toHaveBeenCalled();
    expect(props.onPaneClick).not.toHaveBeenCalled();
    // files stay unhighlighted
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'none');
  });

  it('clicking a file after a folder clears the folder ring', () => {
    renderGraph();
    const folder = screen.getByTestId(`graph-node-${FOLDER_ID}`);
    fireEvent.click(folder);
    expect(folder).toHaveAttribute('data-highlight', 'container-selected');
    fireEvent.click(screen.getByTestId('graph-node-node1'));
    expect(folder).toHaveAttribute('data-highlight', 'none');
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
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'edge-endpoint');
    expect(screen.getByTestId('graph-node-node2')).toHaveAttribute('data-highlight', 'edge-endpoint');
  });

  it('an edge click clears a selected folder', () => {
    renderGraph();
    const folder = screen.getByTestId(`graph-node-${FOLDER_ID}`);
    fireEvent.click(folder);
    const hit = screen.getByTestId('graph-edge-edge1').querySelector('path:nth-child(2)') as SVGPathElement;
    fireEvent.click(hit, { clientX: 1, clientY: 1 });
    expect(folder).toHaveAttribute('data-highlight', 'none');
  });

  it('search filters file nodes and updates "Showing X of Y"', () => {
    const { rerender, props } = renderGraph();
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(2);
    rerender(<NestedLayoutGraph {...props} searchQuery="index" />);
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(1);
    expect(screen.getByTestId('graph-node-node1')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-node-node2')).toBeNull();
    expect(screen.getByText('Showing 1 of 2 files')).toBeInTheDocument();
    // the edge lost an endpoint → gone
    expect(document.querySelectorAll('[data-testid^="graph-edge-"]')).toHaveLength(0);
  });

  it('role filter with no match renders zero file nodes and no folders', () => {
    renderGraph({ roleFilter: 'model' });
    expect(document.querySelectorAll('[data-node-kind="file"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-node-kind="folder"]')).toHaveLength(0);
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

  it('a new node selection clears a previously selected folder and edge', () => {
    const { rerender, props } = renderGraph();
    const folder = screen.getByTestId(`graph-node-${FOLDER_ID}`);
    fireEvent.click(folder);
    expect(folder).toHaveAttribute('data-highlight', 'container-selected');
    rerender(<NestedLayoutGraph {...props} selectedNodeId="node2" selectionSource="node" />);
    expect(folder).toHaveAttribute('data-highlight', 'none');
    expect(screen.getByTestId('graph-node-node2')).toHaveAttribute('data-highlight', 'selected');
    expect(screen.getByTestId('graph-node-node1')).toHaveAttribute('data-highlight', 'connected');
  });

  it('clicking the canvas background calls onPaneClick and clears the folder ring', () => {
    const { props } = renderGraph();
    const folder = screen.getByTestId(`graph-node-${FOLDER_ID}`);
    fireEvent.click(folder);
    fireEvent.click(screen.getByTestId('graph-canvas'));
    expect(props.onPaneClick).toHaveBeenCalledTimes(1);
    expect(props.onNodeSelect).not.toHaveBeenCalled();
    expect(folder).toHaveAttribute('data-highlight', 'none');
  });

  it('clicking inside the filter panel does not count as a background click', () => {
    const { props } = renderGraph();
    fireEvent.click(screen.getByPlaceholderText('Search files...'));
    expect(props.onPaneClick).not.toHaveBeenCalled();
  });
});
