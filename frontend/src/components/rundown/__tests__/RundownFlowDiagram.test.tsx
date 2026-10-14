import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import RundownFlowDiagram from '../RundownFlowDiagram';
import { mockRundown } from './fixtures';

function nodesByKind(container: HTMLElement, kind: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`[data-testid^="graph-node-"][data-node-kind="${kind}"]`));
}

describe('RundownFlowDiagram', () => {
  const flow = mockRundown.flows[0];
  const layers = mockRundown.layers;
  const entryPoints = mockRundown.entry_points;

  it('should render a graph canvas', () => {
    render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
  });

  it('should render the calculated nodes (entry points as file, layers as category)', () => {
    const { container } = render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    // 1 entry point + 3 layers = 4 nodes
    expect(container.querySelectorAll('[data-testid^="graph-node-"]')).toHaveLength(4);
    expect(nodesByKind(container, 'file')).toHaveLength(1);
    expect(nodesByKind(container, 'category')).toHaveLength(3);
    expect(screen.getByTestId('graph-node-entry-0')).toHaveTextContent('App.tsx');
    expect(screen.getByTestId('graph-node-layer-presentation')).toHaveTextContent('Presentation Layer');
  });

  it('should render with correct edge count', () => {
    const { container } = render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    // 1 entry->layer + 2 step->step = 3 edges
    expect(container.querySelectorAll('[data-testid^="graph-edge-"]')).toHaveLength(3);
  });

  it('should have aria-hidden on the diagram container', () => {
    render(
      <RundownFlowDiagram
        flow={flow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    const container = screen.getByTestId('graph-canvas').parentElement;
    expect(container).toHaveAttribute('aria-hidden', 'true');
  });

  it('should dim layers that are not part of the flow', () => {
    const secondFlow = mockRundown.flows[1]; // presentation + data only
    const { container } = render(
      <RundownFlowDiagram
        flow={secondFlow}
        layers={layers}
        entryPoints={entryPoints}
      />
    );
    // Still 1 entry + 3 layers = 4 nodes (inactive ones still rendered, just dimmed)
    expect(container.querySelectorAll('[data-testid^="graph-node-"]')).toHaveLength(4);
    // entry->layer + 1 step edge (presentation->data) = 2
    expect(container.querySelectorAll('[data-testid^="graph-edge-"]')).toHaveLength(2);

    const logic = screen.getByTestId('graph-node-layer-logic').querySelector('[data-testid="rundown-layer-node"]');
    expect(logic).toHaveAttribute('data-active', 'false');
    const presentation = screen
      .getByTestId('graph-node-layer-presentation')
      .querySelector('[data-testid="rundown-layer-node"]');
    expect(presentation).toHaveAttribute('data-active', 'true');
  });
});
