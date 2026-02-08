import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import RundownFlowDiagram from '../RundownFlowDiagram';
import { mockRundown } from './fixtures';

// Mock ReactFlow since it requires DOM measurements not available in jsdom
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    ReactFlow: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => (
      <div data-testid="react-flow-mock">
        <span data-testid="node-count">{(nodes as unknown[]).length}</span>
        <span data-testid="edge-count">{(edges as unknown[]).length}</span>
      </div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow-provider">{children}</div>
    ),
  };
});

describe('RundownFlowDiagram', () => {
  const flow = mockRundown.flows[0];
  const layers = mockRundown.layers;
  const entryPoints = mockRundown.entry_points;

  it('should render with ReactFlowProvider wrapper', () => {
    render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();
  });

  it('should render ReactFlow with calculated nodes', () => {
    render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    expect(screen.getByTestId('react-flow-mock')).toBeInTheDocument();
    // 1 entry point + 3 layers = 4 nodes
    expect(screen.getByTestId('node-count')).toHaveTextContent('4');
  });

  it('should render with correct edge count', () => {
    render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    // 1 entry->layer + 2 step->step = 3 edges
    expect(screen.getByTestId('edge-count')).toHaveTextContent('3');
  });

  it('should have aria-hidden on the diagram container', () => {
    render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    const container = screen.getByTestId('react-flow-mock').parentElement;
    expect(container).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render with second flow (different active layers)', () => {
    const secondFlow = mockRundown.flows[1]; // presentation + data only
    render(
      <RundownFlowDiagram
        flow={secondFlow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    // Still 1 entry + 3 layers = 4 nodes (inactive ones still rendered, just dimmed)
    expect(screen.getByTestId('node-count')).toHaveTextContent('4');
    // entry->layer + 1 step edge (presentation->data) = 2
    expect(screen.getByTestId('edge-count')).toHaveTextContent('2');
  });
});
