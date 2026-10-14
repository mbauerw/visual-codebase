/**
 * Rundown flow diagram layout — pure, engine-typed (no React Flow).
 *
 * Produces a `GraphScene` for `graph/core/GraphCanvas`:
 *
 *   entry points → kind 'file'     (nodes layer; slot ENTRY_POINT_WIDTH × ENTRY_POINT_HEIGHT; data EntryPointNodeData)
 *   layers       → kind 'category' (containers layer; slot LAYER_WIDTH × estimated height; data LayerNodeData)
 *
 * No new NodeKind is introduced: a rundown layer is a wide grouping box, so it
 * reuses the container-ish `category` kind (theme tokens `nodes.category`), and
 * an entry point is a leaf, so it reuses `file`. `theme/rundownTheme.ts` and
 * `renderers/rundown/*` map exactly these two kinds.
 *
 * Positions are ABSOLUTE world coordinates (same numbers as the former React
 * Flow layout: entry points on one row at y = 0, layers stacked every
 * LAYER_SPACING px from FIRST_LAYER_Y — unusually tall layers push the ones
 * below them down, see LAYER_MIN_GAP).
 */

import type { GraphEdge, GraphNode, GraphScene } from '../../graph/core/types';
import { createScene } from '../../graph/core/sceneUtils';
import type {
  RundownFlow,
  RundownLayer,
  RundownEntryPoint,
} from '../../types';

// Layout constants
const ENTRY_POINT_Y = 0;
const FIRST_LAYER_Y = 100;
/** Vertical pitch between consecutive layer boxes (top edge to top edge). */
const LAYER_SPACING = 120;
/**
 * A layer taller than `LAYER_SPACING - LAYER_MIN_GAP` (many key-file pills) pushes
 * the layers below it down so boxes never overlap; normal-height layers keep the
 * fixed 120 px pitch of the original layout.
 */
const LAYER_MIN_GAP = 40;
export const ENTRY_POINT_WIDTH = 160;
/** Entry-point pill: text-xs line (16) + py-2 (16) + border-2 (4). */
export const ENTRY_POINT_HEIGHT = 36;
export const LAYER_WIDTH = 600;
const ENTRY_POINT_GAP = 20;

// Layer box height estimate (RundownLayerNode: border-2, px-4 py-3, text-sm rows,
// key-file pills text-xs py-0.5 wrapping in a right column of max 66 %).
const LAYER_CHROME_HEIGHT = 24 + 4; // py-3 + border-2
const LAYER_LABEL_HEIGHT = 20; // text-sm line
const LAYER_ACTION_HEIGHT = 2 + 20; // mt-0.5 + text-sm line
const KEY_FILE_ROW_HEIGHT = 20; // text-xs line + py-0.5
const KEY_FILE_ROW_GAP = 4; // gap-1
const KEY_FILE_PILL_PAD = 12; // px-1.5 × 2
const KEY_FILE_CHAR_WIDTH = 7.5; // font-mono text-xs, generous
/** Right column: 66 % of the content box (LAYER_WIDTH − px-4 − border-2). */
const KEY_FILE_COLUMN_WIDTH = Math.floor((LAYER_WIDTH - 32 - 4) * 0.66);
/** Minimum layer box height (an inactive layer: chrome + label). */
export const LAYER_MIN_HEIGHT = LAYER_CHROME_HEIGHT + LAYER_LABEL_HEIGHT;

// Edge style lives in graph/theme/rundownTheme.ts (stroke #6366f1, width 2, arrow 16).

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
}

export interface EntryPointNodeData {
  label: string;
  filePath: string;
}

export type LayerGraphNode = GraphNode<LayerNodeData>;
export type EntryPointGraphNode = GraphNode<EntryPointNodeData>;

export type RundownLayout = GraphScene;

export function isLayerNode(node: GraphNode): node is LayerGraphNode {
  return node.kind === 'category';
}

export function isEntryPointNode(node: GraphNode): node is EntryPointGraphNode {
  return node.kind === 'file';
}

/**
 * Greedy estimate of how many rows the key-file pills wrap to inside the
 * right column of a layer box (`flex-wrap`, `gap-1`, `maxWidth: 66%`).
 */
export function estimateKeyFileRows(keyFiles: readonly string[]): number {
  if (keyFiles.length === 0) return 0;
  let rows = 1;
  let used = 0;
  for (const file of keyFiles) {
    const w = Math.min(KEY_FILE_COLUMN_WIDTH, file.length * KEY_FILE_CHAR_WIDTH + KEY_FILE_PILL_PAD);
    if (used === 0) {
      used = w;
    } else if (used + KEY_FILE_ROW_GAP + w <= KEY_FILE_COLUMN_WIDTH) {
      used += KEY_FILE_ROW_GAP + w;
    } else {
      rows += 1;
      used = w;
    }
  }
  return rows;
}

/** Slot height of a layer box for the given content (see RundownLayerNode). */
export function estimateLayerHeight(data: Pick<LayerNodeData, 'isActive' | 'action' | 'keyFiles'>): number {
  let left = LAYER_LABEL_HEIGHT;
  let right = 0;
  if (data.isActive) {
    if (data.action) left += LAYER_ACTION_HEIGHT;
    const rows = estimateKeyFileRows(data.keyFiles);
    if (rows > 0) right = rows * KEY_FILE_ROW_HEIGHT + (rows - 1) * KEY_FILE_ROW_GAP;
  }
  return LAYER_CHROME_HEIGHT + Math.max(left, right);
}

/**
 * Calculate the deterministic rundown flow diagram scene.
 * Entry points are positioned at the top, layers stack vertically below.
 * Only layers referenced by the active flow's steps are marked active.
 */
export function calculateRundownLayout(
  flow: RundownFlow,
  layers: RundownLayer[],
  entryPoints: RundownEntryPoint[]
): RundownLayout {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

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
    const data: EntryPointNodeData = {
      label: ep.file_path.split('/').pop() || ep.file_path,
      filePath: ep.file_path,
    };
    const node: EntryPointGraphNode = {
      id: `entry-${index}`,
      kind: 'file',
      x: entryStartX + index * (ENTRY_POINT_WIDTH + ENTRY_POINT_GAP),
      y: ENTRY_POINT_Y,
      width: ENTRY_POINT_WIDTH,
      height: ENTRY_POINT_HEIGHT,
      depth: 0,
      data,
    };
    nodes.push(node);
  });

  // ---- Layer nodes ----
  let layerY = FIRST_LAYER_Y;
  sortedLayers.forEach((layer, index) => {
    const colors = LAYER_COLORS[index % LAYER_COLORS.length];
    const step = stepByLayer.get(layer.id);
    const isActive = activeLayerIds.has(layer.id);

    const data: LayerNodeData = {
      label: layer.label,
      description: layer.description,
      action: step?.action,
      isActive,
      colorBg: colors.bg,
      colorBorder: colors.border,
      colorText: colors.text,
      keyFiles: step?.key_files || [],
    };
    const height = estimateLayerHeight(data);
    const node: LayerGraphNode = {
      id: `layer-${layer.id}`,
      kind: 'category',
      x: 0,
      y: layerY,
      width: LAYER_WIDTH,
      height,
      depth: 0,
      data,
    };
    nodes.push(node);
    layerY += Math.max(LAYER_SPACING, height + LAYER_MIN_GAP);
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
    });
  }

  return createScene(nodes, edges);
}
