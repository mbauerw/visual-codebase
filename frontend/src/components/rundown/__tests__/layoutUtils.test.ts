import { describe, it, expect } from 'vitest';
import {
  calculateRundownLayout,
  estimateKeyFileRows,
  estimateLayerHeight,
  isEntryPointNode,
  isLayerNode,
  ENTRY_POINT_HEIGHT,
  ENTRY_POINT_WIDTH,
  LAYER_MIN_HEIGHT,
  LAYER_WIDTH,
} from '../layoutUtils';
import { mockRundown } from './fixtures';

describe('calculateRundownLayout', () => {
  const layers = mockRundown.layers;
  const entryPoints = mockRundown.entry_points;

  it('should create entry point nodes at top', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const entryNodes = nodes.filter(isEntryPointNode);
    expect(entryNodes).toHaveLength(1);
    expect(entryNodes[0].y).toBe(0);
    expect(entryNodes[0].data.label).toBe('App.tsx');
    expect(entryNodes[0].data.filePath).toBe('src/App.tsx');
  });

  it('should create layer nodes stacked vertically', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const layerNodes = nodes.filter(isLayerNode);
    expect(layerNodes).toHaveLength(3);

    // Layers should be at increasing y positions
    expect(layerNodes[0].y).toBe(100);
    expect(layerNodes[1].y).toBe(220);
    expect(layerNodes[2].y).toBe(340);
  });

  it('should mark active layers from flow steps', () => {
    const flow = mockRundown.flows[0]; // Uses all 3 layers
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const layerNodes = nodes.filter(isLayerNode);
    expect(layerNodes[0].data.isActive).toBe(true); // presentation
    expect(layerNodes[1].data.isActive).toBe(true); // logic
    expect(layerNodes[2].data.isActive).toBe(true); // data
  });

  it('should mark inactive layers not in flow', () => {
    const flow = mockRundown.flows[1]; // Only uses presentation + data
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const layerNodes = nodes.filter(isLayerNode);
    expect(layerNodes[0].data.isActive).toBe(true);  // presentation
    expect(layerNodes[1].data.isActive).toBe(false); // logic
    expect(layerNodes[2].data.isActive).toBe(true);  // data
  });

  it('should include action text on active layers', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const presentationLayer = nodes.filter(isLayerNode).find((n) => n.id === 'layer-presentation');
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

    const entryNodes = nodes.filter(isEntryPointNode);
    expect(entryNodes).toHaveLength(1); // Falls back to all entry points
  });

  it('should handle multiple entry points', () => {
    const multiEntry = [
      { file_path: 'src/App.tsx', description: 'Main', starts_flow: 'main_flow' },
      { file_path: 'src/index.tsx', description: 'Index', starts_flow: 'main_flow' },
    ];
    const flow = mockRundown.flows[0];
    const { nodes, edges } = calculateRundownLayout(flow, layers, multiEntry);

    const entryNodes = nodes.filter(isEntryPointNode);
    expect(entryNodes).toHaveLength(2);

    // Both should connect to first layer
    const entryEdges = edges.filter((e) => e.source.startsWith('entry-'));
    expect(entryEdges).toHaveLength(2);
  });

  it('should sort layers by order', () => {
    const reversedLayers = [...layers].reverse();
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, reversedLayers, entryPoints);

    const layerNodes = nodes.filter(isLayerNode);
    // Even with reversed input, presentation (order=0) should be first
    expect(layerNodes[0].id).toBe('layer-presentation');
    expect(layerNodes[1].id).toBe('layer-logic');
    expect(layerNodes[2].id).toBe('layer-data');
  });

  it('should assign colors to layers', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const firstLayer = nodes.filter(isLayerNode).find((n) => n.id === 'layer-presentation');
    expect(firstLayer?.data.colorBg).toBeDefined();
    expect(firstLayer?.data.colorBorder).toBeDefined();
    expect(firstLayer?.data.colorText).toBeDefined();
  });

  it('should handle empty entry points', () => {
    const flow = mockRundown.flows[0];
    const { nodes, edges } = calculateRundownLayout(flow, layers, []);

    const entryNodes = nodes.filter(isEntryPointNode);
    expect(entryNodes).toHaveLength(0);

    const entryEdges = edges.filter((e) => e.source.startsWith('entry-'));
    expect(entryEdges).toHaveLength(0);
  });

  it('should handle empty flow steps', () => {
    const emptyFlow = { ...mockRundown.flows[0], steps: [] };
    const { edges } = calculateRundownLayout(emptyFlow, layers, entryPoints);

    expect(edges).toHaveLength(0);
  });

  // ---- GraphScene shape (engine contract) ----

  it('should map entry points to kind "file" and layers to kind "category" with absolute slots', () => {
    const flow = mockRundown.flows[0];
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);

    const entry = nodes.find((n) => n.id === 'entry-0')!;
    expect(entry.kind).toBe('file');
    expect(entry.width).toBe(ENTRY_POINT_WIDTH);
    expect(entry.height).toBe(ENTRY_POINT_HEIGHT);
    // single entry point centred over the 600px layer column
    expect(entry.x).toBe((LAYER_WIDTH - ENTRY_POINT_WIDTH) / 2);
    expect(entry.depth).toBe(0);
    expect(entry.parentId).toBeUndefined();

    for (const layer of nodes.filter(isLayerNode)) {
      expect(layer.kind).toBe('category');
      expect(layer.x).toBe(0);
      expect(layer.width).toBe(LAYER_WIDTH);
      expect(layer.height).toBeGreaterThanOrEqual(LAYER_MIN_HEIGHT);
      expect(layer.depth).toBe(0);
    }
  });

  it('should compute scene bounds spanning entry points and layers', () => {
    const flow = mockRundown.flows[0];
    const scene = calculateRundownLayout(flow, layers, entryPoints);
    const last = scene.nodes.filter(isLayerNode)[2];

    expect(scene.bounds.x).toBe(0);
    expect(scene.bounds.y).toBe(0);
    expect(scene.bounds.width).toBe(LAYER_WIDTH);
    expect(scene.bounds.height).toBe(last.y + last.height);
  });

  it('should give active layers with content taller slots than inactive ones', () => {
    const flow = mockRundown.flows[1]; // logic is inactive
    const { nodes } = calculateRundownLayout(flow, layers, entryPoints);
    const [presentation, logic] = nodes.filter(isLayerNode);

    expect(logic.height).toBe(LAYER_MIN_HEIGHT);
    expect(presentation.height).toBeGreaterThan(logic.height);
  });

  it('should push later layers down when a layer is taller than the default pitch', () => {
    const many = Array.from({ length: 8 }, (_, i) => `src/components/some/long/path/File${i}.tsx`);
    const flow = {
      ...mockRundown.flows[0],
      steps: [{ ...mockRundown.flows[0].steps[0], key_files: many }, ...mockRundown.flows[0].steps.slice(1)],
    };
    const [presentation, logic, data] = calculateRundownLayout(flow, layers, entryPoints).nodes.filter(isLayerNode);

    expect(presentation.height).toBeGreaterThan(80);
    expect(logic.y).toBeGreaterThan(220);
    expect(logic.y).toBeGreaterThanOrEqual(presentation.y + presentation.height + 40);
    // the rest keeps the fixed pitch
    expect(data.y - logic.y).toBe(120);
  });

  it('should keep every edge endpoint resolvable in the scene', () => {
    const flow = mockRundown.flows[0];
    const { nodes, edges } = calculateRundownLayout(flow, layers, entryPoints);
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });
});

describe('estimateLayerHeight', () => {
  it('returns the minimum for inactive layers regardless of content', () => {
    expect(
      estimateLayerHeight({ isActive: false, action: 'x', keyFiles: ['a/b/c.ts', 'd/e/f.ts', 'g/h/i.ts'] })
    ).toBe(LAYER_MIN_HEIGHT);
  });

  it('grows with the action line and with wrapped key-file rows', () => {
    const base = estimateLayerHeight({ isActive: true, keyFiles: [] });
    const withAction = estimateLayerHeight({ isActive: true, action: 'does a thing', keyFiles: [] });
    expect(withAction).toBeGreaterThan(base);

    const many = Array.from({ length: 6 }, (_, i) => `src/components/some/long/path/File${i}.tsx`);
    const tall = estimateLayerHeight({ isActive: true, action: 'does a thing', keyFiles: many });
    expect(estimateKeyFileRows(many)).toBeGreaterThan(1);
    expect(tall).toBeGreaterThan(withAction);
  });

  it('estimateKeyFileRows packs short names on one row', () => {
    expect(estimateKeyFileRows([])).toBe(0);
    expect(estimateKeyFileRows(['a.ts', 'b.ts'])).toBe(1);
  });
});
