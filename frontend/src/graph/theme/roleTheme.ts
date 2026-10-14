/**
 * Role layout theme — the dark slate/amber look of the main visualization.
 * Values ported from RoleLayoutGraph.tsx / CustomNode.tsx / index.css (.react-flow__* overrides).
 */

import type { GraphNode } from '../core/types';
import type { GraphTheme } from './types';
import { categoryColors, roleColors, type ReactFlowNodeData } from '../../types';

/** Data carried by role-layout category container nodes. */
export interface RoleCategoryNodeData {
  label: string;
  role: import('../../types').ArchitecturalRole;
  category: 'frontend' | 'backend' | 'test';
  nodeCount: number;
}

/** Data carried by role-layout section (Frontend/Backend/Test ellipse) nodes. */
export interface RoleSectionNodeData {
  label: string;
  category: 'frontend' | 'backend' | 'test';
  color: string;
}

export const ROLE_BACKGROUND = '#111a31';

function minimapNodeColor(node: GraphNode): string {
  if (node.kind === 'category') {
    const d = node.data as RoleCategoryNodeData;
    return d.category === 'frontend' ? categoryColors.frontend : categoryColors.backend;
  }
  if (node.kind === 'file') {
    const d = node.data as ReactFlowNodeData;
    return d.role ? roleColors[d.role] ?? '#6b7280' : '#6b7280';
  }
  return '#6b7280';
}

export const roleTheme: GraphTheme = {
  background: ROLE_BACKGROUND,
  nodes: {
    file: {
      surface: '#1e293b',
      border: '#7d7d7de9',
      text: '#ffffff',
      radius: 8,
      ring: {
        none: '',
        selected: 'ring-8 ring-amber-500 shadow-xl shadow-amber-500/50 ring-offset-2 ring-offset-amber-900',
        tierlist: 'ring-8 ring-blue-500 shadow-xl shadow-blue-500/50 ring-offset-2 ring-offset-slate-900',
        connected: 'ring-4 ring-blue-400/70',
        'connected-tierlist': 'ring-4 ring-blue-400',
        'edge-endpoint': 'ring-2 ring-blue-400',
        'container-selected': '',
      },
      motion: {
        whileHover: { scale: 1.04 },
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      },
    },
    category: {
      radius: 24,
      ring: {},
    },
    folder: {
      radius: 16,
      ring: {},
    },
    section: {
      ring: {},
    },
  },
  edges: {
    base: { stroke: '#475569', strokeWidth: 1.5, markerSize: 20 },
    byHighlight: {
      selected: { stroke: '#60a5fa', strokeWidth: 6, markerSize: 16 },
      connected: { stroke: '#fbbf24', strokeWidth: 8, dasharray: '20, 20', markerSize: 14 },
      'connected-tierlist': { stroke: '#60a5fa', strokeWidth: 8, dasharray: '20, 20', markerSize: 14 },
      dimmed: { opacity: 0.3 },
    },
  },
  // CustomNode: source handle Top, target handle Bottom
  anchors: { source: 'top', target: 'bottom' },
  // LOD thresholds are on-screen SLOT WIDTH (240 world px × scale × zoom).
  // File labels are 24 world px (text-2xl) → label px ≈ width/10, pills are 16
  // world px → ≈ width/15. Tuned on the synthetic-200 scene in headless Chromium:
  //   farBelowPx  90 → labels appear once they are ≥ ~9 px tall (below that they
  //                    were an unreadable smear at zoom 0.2 on tier-1 nodes)
  //   nearAbovePx 140 → pills appear once their text is ≥ ~9 px tall
  // (getLod applies ±15 % hysteresis, so the effective bands are 76–104 / 119–161.)
  // useZoomBucket(200) reuses these: edge labels hide below zoom ≈ 0.45.
  lod: { farBelowPx: 90, nearAbovePx: 140 },
  zoom: { min: 0.05, max: 2 },
  chrome: {
    panelClassName: 'bg-slate-800 border border-slate-700 text-slate-200',
    buttonClassName: 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-b border-slate-700 last:border-b-0',
    minimap: {
      maskColor: 'rgba(15, 23, 42, 0.8)',
      className: 'bg-slate-800 border border-slate-700 text-slate-400',
      nodeColor: minimapNodeColor,
    },
  },
};
