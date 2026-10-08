/**
 * Honeycomb — a beekeeper's frames.
 *
 * Saturated honey paper, dark-wood frames, wax-white hex cells with heavy
 * ink outlines; the cells everything depends on are full of honey. Bold,
 * flat, printed — a board game, not a dashboard.
 */

import type { GraphNode } from '../../core/types';
import type { GraphTheme } from '../../theme/types';
import { roleColors, type ReactFlowNodeData } from '../../../types';

export const HC = {
  paper: '#f2dc96',
  paperDeep: '#ecd07f',
  wood: '#4a2f17',
  woodLight: '#8a5a2b',
  ink: '#2b1d0e',
  wax: '#fff6d6',
  waxWarm: '#ffe9a8',
  honey: '#f3a712',
  honeyDeep: '#d97a06',
  red: '#e5484d',
  teal: '#1f7a8c',
  blue: '#3b6fd6',
  display: "'Big Shoulders Display', 'Bebas Neue', Impact, sans-serif",
  body: "'Rubik', 'Work Sans', system-ui, sans-serif",
} as const;

/** Flat-top hexagon (width : height = 1 : 0.866). */
export const HEX_FLAT = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
/** Pointy-top hexagon (height : width = 1 : 0.866). */
export const HEX_POINTY = 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)';

function minimapColor(node: GraphNode): string {
  if (node.kind === 'file') {
    const d = node.data as ReactFlowNodeData;
    return (d.scaleTier ?? 1) >= 1.5 ? HC.honey : HC.ink;
  }
  if (node.kind === 'category') {
    const d = node.data as { role?: keyof typeof roleColors };
    return d.role ? roleColors[d.role] ?? HC.wood : HC.wood;
  }
  return HC.wood;
}

export const honeycombTheme: GraphTheme = {
  background: HC.paper,
  nodes: {
    // Hex cells are clip-path'd, so box-shadow rings would be clipped away:
    // the renderer maps highlight → outline colour instead.
    file: {
      surface: HC.wax,
      border: HC.ink,
      text: HC.ink,
      ring: {},
      motion: {
        whileHover: { scale: 1.08 },
        transition: { type: 'spring', stiffness: 460, damping: 26 },
      },
    },
    category: { className: 'cursor-pointer', ring: {} },
    folder: { ring: {} },
    section: { ring: {} },
  },
  edges: {
    base: { stroke: HC.ink, strokeWidth: 1.6, opacity: 0.2, markerSize: 7 },
    byHighlight: {
      selected: { stroke: HC.red, strokeWidth: 4, opacity: 1, markerSize: 10 },
      connected: { stroke: HC.teal, strokeWidth: 3, opacity: 1, dasharray: '7, 6', markerSize: 10 },
      'connected-tierlist': { stroke: HC.blue, strokeWidth: 3, opacity: 1, dasharray: '7, 6', markerSize: 10 },
      dimmed: { opacity: 0.06 },
    },
    path: 'straight',
    inset: 0,
  },
  anchors: { source: 'center', target: 'center' },
  // 150 px cell: colour only under 55 px on screen, name from ~95 px.
  lod: { farBelowPx: 55, nearAbovePx: 95 },
  zoom: { min: 0.05, max: 2.5 },
  chrome: {
    panelClassName: 'bg-[#fff6d6] border-2 border-[#2b1d0e] text-[#2b1d0e]',
    buttonClassName: 'bg-[#fff6d6] text-[#2b1d0e] hover:bg-[#ffe9a8] border-b-2 border-[#2b1d0e] last:border-b-0',
    minimap: {
      maskColor: 'rgba(242, 220, 150, 0.78)',
      className: 'bg-[#fff6d6] border-2 border-[#2b1d0e] text-[#4a2f17]',
      nodeColor: minimapColor,
    },
  },
};
