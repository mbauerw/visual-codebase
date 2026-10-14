/**
 * Honeycomb layout — collapsible.
 *
 *   section  : a hive frame; combs are shelf-packed into it, row by row
 *   category : a comb. Folded = one big flat-top hex cell (role name, count).
 *              Bloomed = a pointy-top hex container with the role's files as
 *              hex cells in rings around a central label cell
 *   file     : a 150×130 flat-top hex cell — only present while its comb is
 *              bloomed
 *
 * Edges to files in folded combs re-route to the comb and bundle. Absolute
 * coordinates, pure.
 */

import type { ReactFlowNodeData } from '../../../types';
import { categoryColors } from '../../../types';
import type { GraphEdge, GraphNode, GraphScene } from '../../core/types';
import { createScene } from '../../core/sceneUtils';
import type { RoleCategoryNodeData, RoleSectionNodeData } from '../../theme/roleTheme';
import { aggregateEdges, groupFilesByRole, shelfPack, type PackItem } from '../layoutUtils';
import type { ThemeSceneInput } from '../types';

export const HONEYCOMB_CFG = {
  cellW: 150,
  cellH: 130, // 150 × 0.866
  /** Gap between neighbouring cells (world px, measured between flat sides). */
  cellGap: 8,
  foldedW: 300,
  foldedH: 260,
  bloomPad: 46,
  combGapX: 44,
  combGapY: 36,
  framePad: 70,
  frameHeader: 150,
  frameMinW: 1100,
  frameGap: 170,
  maxRowWidth: 1500,
} as const;

export interface HoneycombCategoryData extends RoleCategoryNodeData {
  expanded: boolean;
  /** Bloomed only: centre of the ring cluster, relative to the container's top-left. */
  centre: { x: number; y: number } | null;
}

export interface HoneycombSectionData extends RoleSectionNodeData {
  nodeCount: number;
  combCount: number;
}

/** File data gains its position in the bloom (for the staggered pop-in). */
export interface HoneycombFileData extends ReactFlowNodeData {
  bloomIndex: number;
}

/** Axial neighbour directions for flat-top hexes. */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** The first `n` axial cells of the rings around the origin (ring 1 first). */
export function hexRingCells(n: number): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = [];
  let k = 1;
  while (out.length < n) {
    let q = -k;
    let r = k;
    for (let side = 0; side < 6 && out.length < n; side++) {
      for (let step = 0; step < k && out.length < n; step++) {
        out.push({ q, r });
        q += DIRS[side][0];
        r += DIRS[side][1];
      }
    }
    k++;
  }
  return out;
}

/** Flat-top axial → pixel offset of the cell centre from the cluster centre. */
export function hexToPixel(q: number, r: number, w: number, h: number, gap: number): { x: number; y: number } {
  const pitchX = (w + gap) * 0.75;
  const pitchY = h + gap * 0.866;
  return { x: pitchX * q, y: pitchY * (r + q / 2) };
}

interface Bloom {
  /** Cell-centre offsets from the cluster centre, in file order. */
  offsets: { x: number; y: number }[];
  width: number;
  height: number;
  centre: { x: number; y: number };
}

export function planBloom(fileCount: number, cfg = HONEYCOMB_CFG): Bloom {
  const cells = hexRingCells(fileCount);
  const offsets = cells.map((c) => hexToPixel(c.q, c.r, cfg.cellW, cfg.cellH, cfg.cellGap));
  const xs = [0, ...offsets.map((o) => o.x)];
  const ys = [0, ...offsets.map((o) => o.y)];
  const minX = Math.min(...xs) - cfg.cellW / 2;
  const maxX = Math.max(...xs) + cfg.cellW / 2;
  const minY = Math.min(...ys) - cfg.cellH / 2;
  const maxY = Math.max(...ys) + cfg.cellH / 2;
  // A pointy-top container needs extra height so the top/bottom points clear the cells.
  const padX = cfg.bloomPad;
  const padY = cfg.bloomPad + 30;
  return {
    offsets,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2,
    centre: { x: -minX + padX, y: -minY + padY },
  };
}

export function buildHoneycombScene({ nodes: fileNodes, edges, state }: ThemeSceneInput): GraphScene {
  const C = HONEYCOMB_CFG;
  const grouped = groupFilesByRole(fileNodes, edges);
  const nodes: GraphNode[] = [];
  const fileToCategory = new Map<string, string>();
  const visibleFiles = new Set<string>();
  let cursorX = 0;

  grouped.sections.forEach((section) => {
    const combs = section.groups.map((g) => {
      const id = `${section.category}-${g.role}`;
      const expanded = state.expanded.has(id);
      const bloom = expanded ? planBloom(g.nodes.length, C) : null;
      const item: PackItem = {
        id,
        width: bloom ? bloom.width : C.foldedW,
        height: bloom ? bloom.height : C.foldedH,
      };
      return { group: g, id, expanded, bloom, item };
    });
    const pack = shelfPack(
      combs.map((c) => c.item),
      C.maxRowWidth,
      C.combGapX,
      C.combGapY,
      { alignY: 'center' }
    );
    const frameW = Math.max(C.frameMinW, pack.width + C.framePad * 2);
    const frameH = C.frameHeader + pack.height + C.framePad;
    const frameX = cursorX;
    const frameY = 0;

    const sectionData: HoneycombSectionData = {
      label: section.label,
      category: section.category,
      color: categoryColors[section.category],
      nodeCount: section.nodeCount,
      combCount: section.groups.length,
    };
    nodes.push({
      id: `section-${section.category}`,
      kind: 'section',
      x: frameX,
      y: frameY,
      width: frameW,
      height: frameH,
      depth: 0,
      interactive: false,
      draggable: false,
      data: sectionData,
    });

    pack.items.forEach((placed, i) => {
      const comb = combs[i];
      const cx = frameX + C.framePad + placed.x;
      const cy = frameY + C.frameHeader + placed.y;
      const catData: HoneycombCategoryData = {
        label: comb.group.label,
        role: comb.group.role,
        category: section.category,
        nodeCount: comb.group.nodes.length,
        expanded: comb.expanded,
        centre: comb.bloom ? comb.bloom.centre : null,
      };
      nodes.push({
        id: comb.id,
        kind: 'category',
        x: cx,
        y: cy,
        width: placed.width,
        height: placed.height,
        depth: 0,
        draggable: false,
        data: catData,
      });

      comb.group.nodes.forEach((file) => fileToCategory.set(file.id, comb.id));
      if (!comb.bloom) return;
      const centreX = cx + comb.bloom.centre.x;
      const centreY = cy + comb.bloom.centre.y;
      comb.group.nodes.forEach((file, fi) => {
        const off = comb.bloom!.offsets[fi];
        const scaleTier = grouped.nodeScales.get(file.id) ?? 1;
        const data: HoneycombFileData = { ...file.data, scaleTier, bloomIndex: fi };
        visibleFiles.add(file.id);
        nodes.push({
          id: file.id,
          kind: 'file',
          x: centreX + off.x - C.cellW / 2,
          y: centreY + off.y - C.cellH / 2,
          width: C.cellW,
          height: C.cellH,
          parentId: comb.id,
          depth: 1,
          draggable: false,
          data,
        });
      });
    });

    cursorX += frameW + C.frameGap;
  });

  const sceneEdges: GraphEdge[] = aggregateEdges(edges, fileToCategory, visibleFiles, {
    widthFor: (n) => 1.6 + Math.log2(n) * 1.3,
  });
  return createScene(nodes, sceneEdges);
}
