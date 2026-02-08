import { describe, it, expect } from 'vitest';
import { calculateRundownLayout } from '../layoutUtils';
import { mockRundown } from './fixtures';

describe('calculateRundownLayout', () => {
  const layers = mockRundown.layers;
  const entryPoints = mockRundown.entry_points;

  it('should create entry point nodes at top', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const entryNodes = nodes.filter((n) => n.type === 'entryPoint');
    expect(entryNodes).toHaveLength(1);
    expect(entryNodes[0].position.y).toBe(0);
    expect(entryNodes[0].data.label).toBe('App.tsx');
    expect(entryNodes[0].data.filePath).toBe('src/App.tsx');
  });

  it('should create layer nodes stacked vertically', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const layerNodes = nodes.filter((n) => n.type === 'layer');
    expect(layerNodes).toHaveLength(3);

    // Layers should be at increasing y positions
    expect(layerNodes[0].position.y).toBe(100);
    expect(layerNodes[1].position.y).toBe(220);
    expect(layerNodes[2].position.y).toBe(340);
  });

  it('should mark active layers from flow steps', () => {
    const flow = mockRundown.flows[0]; // Uses all 3 layers
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const layerNodes = nodes.filter((n) => n.type === 'layer');
    expect(layerNodes[0].data.isActive).toBe(true); // presentation
    expect(layerNodes[1].data.isActive).toBe(true); // logic
    expect(layerNodes[2].data.isActive).toBe(true); // data
  });

  it('should mark inactive layers not in flow', () => {
    const flow = mockRundown.flows[1]; // Only uses presentation + data
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const layerNodes = nodes.filter((n) => n.type === 'layer');
    expect(layerNodes[0].data.isActive).toBe(true);  // presentation
    expect(layerNodes[1].data.isActive).toBe(false); // logic
    expect(layerNodes[2].data.isActive).toBe(true);  // data
  });

  it('should include action text on active layers', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const presentationLayer = nodes.find((n) => n.id === 'layer-presentation');
    expect(presentationLayer?.data.action).toBe(
      'Renders login form and captures credentials'
    );
  });

  it('should create edge from entry point to first step layer', () => {
    const flow = mockRundown.flows[0];
    const { edges } = calculateRundownLayout(flow, layers, entryPoints);

    const entryEdge = edges.find((e) => e.source === 'entry-0');
    expect(entryEdge).toBeDefined();
    expect(entryEdge?.target).toBe('layer-presentation');
  });

  it('should create edges between consecutive flow steps', () => {
    const flow = mockRundown.flows[0]; // 3 steps: presentation -> logic -> data
    const { edges } = calculateRundownLayout(flow, layers, entryPoints);

    const stepEdges = edges.filter((e) => e.id.startsWith('edge-step-'));
    expect(stepEdges).toHaveLength(2);
    expect(stepEdges[0].source).toBe('layer-presentation');
    expect(stepEdges[0].target).toBe('layer-logic');
    expect(stepEdges[1].source).toBe('layer-logic');
    expect(stepEdges[1].target).toBe('layer-data');
  });

  it('should skip edges between same layer', () => {
    const flow = {
      ...mockRundown.flows[0],
      steps: [
        { layer_id: 'presentation', action: 'Step 1', key_files: [] },
        { layer_id: 'presentation', action: 'Step 2', key_files: [] },
        { layer_id: 'data', action: 'Step 3', key_files: [] },
      ],
    };
    const { edges } = calculateRundownLayout(flow, layers, entryPoints);

    const stepEdges = edges.filter((e) => e.id.startsWith('edge-step-'));
    // Should skip edge from presentation->presentation, only have presentation->data
    expect(stepEdges).toHaveLength(1);
    expect(stepEdges[0].source).toBe('layer-presentation');
    expect(stepEdges[0].target).toBe('layer-data');
  });

  it('should use all entry points as fallback when none match flow', () => {
    const flow = { ...mockRundown.flows[0], id: 'nonexistent_flow' };
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const entryNodes = nodes.filter((n) => n.type === 'entryPoint');
    expect(entryNodes).toHaveLength(1); // Falls back to all entry points
  });

  it('should handle multiple entry points', () => {
    const multiEntry = [
      { file_path: 'src/App.tsx', description: 'Main', starts_flow: 'main_flow' },
      { file_path: 'src/index.tsx', description: 'Index', starts_flow: 'main_flow' },
    ];
    const flow = mockRundown.flows[0];
    const { nodes, edges } = calculateRundownLayout(flow, layers, multiEntry);

    const entryNodes = nodes.filter((n) => n.type === 'entryPoint');
    expect(entryNodes).toHaveLength(2);

    // Both should connect to first layer
    const entryEdges = edges.filter((e) => e.source.startsWith('entry-'));
    expect(entryEdges).toHaveLength(2);
  });

  it('should sort layers by order', () => {
    const reversedLayers = [...layers].reverse();
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, reversedLayers, entryPoints);

    const layerNodes = nodes.filter((n) => n.type === 'layer');
    // Even with reversed input, presentation (order=0) should be first
    expect(layerNodes[0].id).toBe('layer-presentation');
    expect(layerNodes[1].id).toBe('layer-logic');
    expect(layerNodes[2].id).toBe('layer-data');
  });

  it('should assign colors to layers', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const firstLayer = nodes.find((n) => n.id === 'layer-presentation');
    expect(firstLayer?.data.colorBg).toBeDefined();
    expect(firstLayer?.data.colorBorder).toBeDefined();
    expect(firstLayer?.data.colorText).toBeDefined();
  });

  it('should handle empty entry points', () => {
    const flow = mockRundown.flows[0];
    const { nodes, edges } = calculateRundownLayout(flow, layers, []);

    const entryNodes = nodes.filter((n) => n.type === 'entryPoint');
    expect(entryNodes).toHaveLength(0);

    const entryEdges = edges.filter((e) => e.source.startsWith('entry-'));
    expect(entryEdges).toHaveLength(0);
  });

  it('should handle empty flow steps', () => {
    const emptyFlow = { ...mockRundown.flows[0], steps: [] };
    const { edges } = calculateRundownLayout(emptyFlow, layers, entryPoints);

    expect(edges).toHaveLength(0);
  });
});
