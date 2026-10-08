/**
 * Rundown flow diagram theme — the light slate look of the former React Flow
 * `components/rundown/RundownFlowDiagram.tsx` (read-only, no selection, no chrome).
 *
 * Kind mapping (see components/rundown/layoutUtils.ts):
 *   'category' → architecture layer box   (renderers/rundown/RundownLayerNode)
 *   'file'     → entry-point pill         (renderers/rundown/RundownEntryPointNode)
 *
 * The renderers paint their own colours from node data, so node tokens are
 * empty; there is no highlight state (no rings). Edges: the old
 * `type: 'smoothstep', animated: true, stroke #6366f1 / width 2, arrowclosed 16`
 * — the dash pattern below reproduces React Flow's `.animated` edge (5px
 * dashes; the marching animation is `.rundown-flow-canvas` CSS in index.css).
 */

import type { GraphTheme } from './types';

export const RUNDOWN_BACKGROUND = '#f8fafc';
export const RUNDOWN_EDGE_COLOR = '#6366f1';

const NO_RINGS = { ring: {} } as const;

export const rundownTheme: GraphTheme = {
  background: RUNDOWN_BACKGROUND,
  nodes: {
    file: NO_RINGS,
    category: NO_RINGS,
    folder: NO_RINGS,
    section: NO_RINGS,
  },
  edges: {
    base: { stroke: RUNDOWN_EDGE_COLOR, strokeWidth: 2, markerSize: 16, dasharray: '5' },
    byHighlight: {},
  },
  // Old Handles: EntryPointNode source Bottom; LayerNode target Top / source Bottom.
  anchors: { source: 'bottom', target: 'top' },
  // Everything is always 'near' (no LOD in the rundown diagram): the smallest
  // slot is 160 world px at zoom 0.5 = 80 screen px, far above 1.
  lod: { farBelowPx: 0, nearAbovePx: 1 },
  zoom: { min: 0.5, max: 1.5 },
  // No chrome is rendered; tokens kept minimal for completeness.
  chrome: {
    panelClassName: 'bg-white border border-slate-200 text-slate-700',
    buttonClassName: 'bg-white text-slate-700 hover:bg-slate-100 border-b border-slate-200 last:border-b-0',
    minimap: {
      maskColor: 'rgba(248, 250, 252, 0.8)',
      className: 'bg-white border border-slate-200 text-slate-500',
      nodeColor: () => '#cbd5e1',
    },
  },
};
