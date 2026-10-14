/**
 * Honeycomb — a beekeeper's frames.
 *
 * Each layer is a hive frame, each role a comb that starts folded (one big
 * tinted cell) and blooms on click into rings of wax cells — one per file —
 * around a central label cell. Cells full of honey are the files everything
 * depends on. Straight ink lines are the imports; they bundle into thicker
 * lines between folded combs.
 */

import './honeycomb.css';
import type { RoleThemePack } from '../types';
import { honeycombTheme } from './theme';
import { buildHoneycombScene } from './layout';
import { HoneycombFileNode } from './HoneycombFileNode';
import { HoneycombCategoryNode } from './HoneycombCategoryNode';
import { HoneycombSectionNode } from './HoneycombSectionNode';
import { HoneycombOverlay } from './HoneycombOverlay';

export { honeycombTheme, HC, HEX_FLAT, HEX_POINTY } from './theme';
export { buildHoneycombScene, planBloom, hexRingCells, hexToPixel, HONEYCOMB_CFG } from './layout';
export type { HoneycombCategoryData, HoneycombSectionData, HoneycombFileData } from './layout';
export { Hex } from './Hex';
export { cellOutline } from './HoneycombFileNode';
export { HoneycombFileNode, HoneycombCategoryNode, HoneycombSectionNode, HoneycombOverlay };

export const honeycombPack: RoleThemePack = {
  id: 'honeycomb',
  label: 'Honeycomb',
  description:
    'Hive frames — layers are wooden frames, roles are combs that bloom on click into rings of hex cells (one per file, honey-filled when everything depends on it).',
  theme: honeycombTheme,
  renderers: {
    file: HoneycombFileNode,
    category: HoneycombCategoryNode,
    section: HoneycombSectionNode,
  },
  buildScene: buildHoneycombScene,
  collapsible: true,
  canvasClassName: 'theme-honeycomb',
  canvas: { nodesDraggable: false, fitPadding: 0.06 },
  Overlay: HoneycombOverlay,
  filterPalette: 'amber',
};
