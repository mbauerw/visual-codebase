import type { Edge, Node } from '@xyflow/react';
import type {
  RundownFlow,
  RundownLayer,
  RundownEntryPoint,
} from '../../types';

// Layout constants
const ENTRY_POINT_Y = 0;
const FIRST_LAYER_Y = 100;
const LAYER_SPACING = 120;
const ENTRY_POINT_WIDTH = 160;
const LAYER_WIDTH = 600;
const ENTRY_POINT_GAP = 20;

// Color palette matching RundownLayers component
const LAYER_COLORS = [
  { bg: '#f0f9ff', border: '#0ea5e9', text: '#0369a1' }, // sky
  { bg: '#eef2ff', border: '#6366f1', text: '#4338ca' }, // indigo
  { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' }, // violet
  { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce' }, // purple
  { bg: '#fdf4ff', border: '#d946ef', text: '#a21caf' }, // fuchsia
  { bg: '#fff1f2', border: '#f43f5e', text: '#be123c' }, // rose
];

export interface LayerNodeData {
  label: string;
  description: string;
  action?: string;
  isActive: boolean;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  keyFiles: string[];
  [key: string]: unknown;
}

export interface EntryPointNodeData {
  label: string;
  filePath: string;
  [key: string]: unknown;
}

export type LayerNode = Node<LayerNodeData, 'layer'>;
export type EntryPointNode = Node<EntryPointNodeData, 'entryPoint'>;
export type RundownNode = LayerNode | EntryPointNode;

export interface RundownLayout {
  nodes: RundownNode[];
  edges: Edge[];
}

/**
 * Calculate deterministic React Flow layout for a rundown flow diagram.
 * Entry points are positioned at the top, layers stack vertically below.
 * Only layers referenced by the active flow's steps are marked active.
 */
export function calculateRundownLayout(
  flow: RundownFlow,
  layers: RundownLayer[],
  entryPoints: RundownEntryPoint[]
): RundownLayout {
  const nodes: RundownNode[] = [];
  const edges: Edge[] = [];

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  // Build a set of active layer IDs from the flow steps
  const activeLayerIds = new Set(flow.steps.map((s) => s.layer_id));

  // Build a map of layer_id -> step for action text
  const stepByLayer = new Map(flow.steps.map((s) => [s.layer_id, s]));

  // ---- Entry point nodes ----
  const relevantEntries = entryPoints.filter(
    (ep) => ep.starts_flow === flow.id
  );
  // If no entry points match this flow, use all entry points as fallback
  const entriesToShow =
    relevantEntries.length > 0 ? relevantEntries : entryPoints.slice(0, 3);

  const totalEntryWidth =
    entriesToShow.length * ENTRY_POINT_WIDTH +
    (entriesToShow.length - 1) * ENTRY_POINT_GAP;
  const entryStartX = (LAYER_WIDTH - totalEntryWidth) / 2;

  entriesToShow.forEach((ep, index) => {
    const nodeId = `entry-${index}`;
    nodes.push({
      id: nodeId,
      type: 'entryPoint',
      position: {
        x: entryStartX + index * (ENTRY_POINT_WIDTH + ENTRY_POINT_GAP),
        y: ENTRY_POINT_Y,
      },
      data: {
        label: ep.file_path.split('/').pop() || ep.file_path,
        filePath: ep.file_path,
      },
    });
  });

  // ---- Layer nodes ----
  sortedLayers.forEach((layer, index) => {
    const colors = LAYER_COLORS[index % LAYER_COLORS.length];
    const step = stepByLayer.get(layer.id);
    const isActive = activeLayerIds.has(layer.id);

    nodes.push({
      id: `layer-${layer.id}`,
      type: 'layer',
      position: {
        x: 0,
        y: FIRST_LAYER_Y + index * LAYER_SPACING,
      },
      data: {
        label: layer.label,
        description: layer.description,
        action: step?.action,
        isActive,
        colorBg: colors.bg,
        colorBorder: colors.border,
        colorText: colors.text,
        keyFiles: step?.key_files || [],
      },
    });
  });

  // ---- Edges ----

  // Entry point → first step layer
  if (flow.steps.length > 0 && entriesToShow.length > 0) {
    const firstLayerId = flow.steps[0].layer_id;
    entriesToShow.forEach((_, index) => {
      edges.push({
        id: `edge-entry-${index}-to-${firstLayerId}`,
        source: `entry-${index}`,
        target: `layer-${firstLayerId}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: '#6366f1',
          width: 16,
          height: 16,
        },
      });
    });
  }

  // Step-to-step edges (consecutive flow steps)
  for (let i = 0; i < flow.steps.length - 1; i++) {
    const sourceLayerId = flow.steps[i].layer_id;
    const targetLayerId = flow.steps[i + 1].layer_id;

    // Avoid duplicate edge if same layer
    if (sourceLayerId === targetLayerId) continue;

    edges.push({
      id: `edge-step-${i}-to-${i + 1}`,
      source: `layer-${sourceLayerId}`,
      target: `layer-${targetLayerId}`,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#6366f1',
        width: 16,
        height: 16,
      },
    });
  }

  return { nodes, edges };
}
