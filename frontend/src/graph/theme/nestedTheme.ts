/**
 * Nested (folder) layout theme — the light amber look.
 * Values ported from the previous React Flow NestedLayoutGraph / diagram constants / NestedFileNode.
 */

import type { GraphNode } from '../core/types';
import type { GraphTheme } from './types';
import { roleColors, type ReactFlowNodeData } from '../../types';

export const NESTED_BACKGROUND = '#fffbeb'; // amber-50

/** Amber depth ramp (from the former diagram constants). */
export const FOLDER_DEPTH_COLORS = ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e'];
export const FOLDER_BORDER_COLORS = ['#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#451a03'];
export const FOLDER_TEXT_COLORS = ['#92400e', '#78350f', '#451a03'];

export function getDepthColor(depth: number): string {
  return FOLDER_DEPTH_COLORS[Math.min(Math.max(depth, 0), FOLDER_DEPTH_COLORS.length - 1)];
}
export function getDepthBorderColor(depth: number): string {
  return FOLDER_BORDER_COLORS[Math.min(Math.max(depth, 0), FOLDER_BORDER_COLORS.length - 1)];
}
export function getDepthTextColor(depth: number): string {
  if (depth <= 1) return FOLDER_TEXT_COLORS[0];
  if (depth <= 3) return FOLDER_TEXT_COLORS[1];
  return FOLDER_TEXT_COLORS[2];
}

/** Data carried by nested-layout folder nodes. */
export interface NestedFolderNodeData {
  label: string;
  path: string;
  depth: number;
  fileCount: number;
  category?: string;
}

function minimapNodeColor(node: GraphNode): string {
  if (node.kind === 'folder') return getDepthColor((node.data as NestedFolderNodeData).depth ?? 0);
  if (node.kind === 'file') {
    const d = node.data as ReactFlowNodeData;
    return d.role ? roleColors[d.role] ?? '#92400e' : '#92400e';
  }
  return '#92400e';
}

export const nestedTheme: GraphTheme = {
  background: NESTED_BACKGROUND,
  nodes: {
    file: {
      surface: '#ffffff',
      text: '#1f2937',
      radius: 8,
      ring: {
        none: '',
        selected: 'ring-2 ring-amber-600 ring-offset-1',
        tierlist: 'ring-4 ring-blue-500',
        connected: 'ring-2 ring-amber-500',
        'connected-tierlist': 'ring-4 ring-blue-400',
        'edge-endpoint': 'ring-2 ring-blue-400',
        'container-selected': '',
      },
      motion: {
        whileHover: { scale: 1.05 },
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      },
    },
    folder: {
      radius: 16,
      ring: {
        'container-selected': 'ring-2 ring-amber-800',
      },
    },
    category: { ring: {} },
    section: { ring: {} },
  },
  edges: {
    base: { stroke: '#92400e', strokeWidth: 1.5, markerSize: 20 },
    byHighlight: {
      selected: { stroke: '#60a5fa', strokeWidth: 6, markerSize: 16 },
      connected: { stroke: '#f59e0b', strokeWidth: 6, dasharray: '15, 15', markerSize: 14 },
      'connected-tierlist': { stroke: '#60a5fa', strokeWidth: 6, dasharray: '15, 15', markerSize: 14 },
      dimmed: { opacity: 0.3 },
    },
  },
  // NestedFileNode: target handle Top, source handle Bottom
  anchors: { source: 'bottom', target: 'top' },
  lod: { farBelowPx: 35, nearAbovePx: 110 },
  zoom: { min: 0.1, max: 2 },
  chrome: {
    panelClassName: 'bg-amber-50 border border-amber-300 text-amber-900',
    buttonClassName: 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-b border-amber-200 last:border-b-0',
    minimap: {
      maskColor: 'rgba(254, 243, 199, 0.6)',
      className: 'bg-amber-50 border border-amber-300 text-amber-700',
      nodeColor: minimapNodeColor,
    },
  },
};
