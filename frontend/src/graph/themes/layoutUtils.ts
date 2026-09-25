/**
 * Layout helpers shared by theme packs. Pure, renderer-agnostic; coordinates
 * are parent-relative unless a function says otherwise.
 */

import type { ArchitecturalRole, ReactFlowEdge, ReactFlowNode, ScaleTier } from '../../types';
import { roleLabels } from '../../types';
import { calculateNodeScales } from '../../hooks/useNodeScaling';
import { categorizeNode, type RoleSectionCategory } from '../layouts/roleLayout';
import type { GraphEdge } from '../core/types';
import type { EdgeThemeTokens } from '../theme/types';

// ---------------------------------------------------------------------------
// Grouping: section → role → files (same ordering rules as the classic layout)
// ---------------------------------------------------------------------------

export interface RoleGroup {
  role: ArchitecturalRole;
  label: string;
  /** Sorted by dependency count, highest first. */
  nodes: ReactFlowNode[];
  totalDeps: number;
}

export interface SectionGroup {
  category: RoleSectionCategory;
  label: string;
  /** Sorted by total dependency count, highest first. */
  groups: RoleGroup[];
  nodeCount: number;
}

export interface GroupedFiles {
  /** Only sections that contain files, in Frontend → Backend → Tests order. */
  sections: SectionGroup[];
  nodeScales: Map<string, ScaleTier>;
  dependencyCount: Map<string, number>;
}

export const SECTION_ORDER: readonly RoleSectionCategory[] = ['frontend', 'backend', 'test'];
export const SECTION_LABELS: Record<RoleSectionCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  test: 'Tests',
};

export function groupFilesByRole(
  fileNodes: readonly ReactFlowNode[],
  edges: ReadonlyArray<{ source: string; target: string }>
): GroupedFiles {
  const dependencyCount = new Map<string, number>();
  fileNodes.forEach((n) => dependencyCount.set(n.id, 0));
  edges.forEach((e) => {
    if (dependencyCount.has(e.source)) dependencyCount.set(e.source, dependencyCount.get(e.source)! + 1);
    if (dependencyCount.has(e.target)) dependencyCount.set(e.target, dependencyCount.get(e.target)! + 1);
  });
  const nodeScales = calculateNodeScales([...fileNodes], edges);

  const bySection = new Map<RoleSectionCategory, Map<ArchitecturalRole, ReactFlowNode[]>>();
  for (const s of SECTION_ORDER) bySection.set(s, new Map());
  fileNodes.forEach((node) => {
    const section = categorizeNode(node.data.category, node.data.role);
    const roles = bySection.get(section)!;
    if (!roles.has(node.data.role)) roles.set(node.data.role, []);
    roles.get(node.data.role)!.push(node);
  });

  const deps = (id: string) => dependencyCount.get(id) ?? 0;
  const sections: SectionGroup[] = [];
  for (const category of SECTION_ORDER) {
    const roles = bySection.get(category)!;
    if (roles.size === 0) continue;
    const groups: RoleGroup[] = Array.from(roles.entries())
      .map(([role, nodes]) => {
        const sorted = [...nodes].sort((a, b) => deps(b.id) - deps(a.id));
        return {
          role,
          label: roleLabels[role] ?? role,
          nodes: sorted,
          totalDeps: sorted.reduce((sum, n) => sum + deps(n.id), 0),
        };
      })
      .sort((a, b) => b.totalDeps - a.totalDeps);
    sections.push({
      category,
      label: SECTION_LABELS[category],
      groups,
      nodeCount: groups.reduce((sum, g) => sum + g.nodes.length, 0),
    });
  }

  return { sections, nodeScales, dependencyCount };
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

export interface PackItem {
  id: string;
  width: number;
  height: number;
}

export interface PackedItem extends PackItem {
  /** Relative to the packed block's top-left. */
  x: number;
  y: number;
}

export interface PackedBlock {
  items: PackedItem[];
  width: number;
  height: number;
}

export interface ShelfPackOptions {
  /** Row items align to the top (default) or centre of the row. */
  alignY?: 'top' | 'center';
  /** Rows are left-aligned (default) or centred within the block width. */
  alignX?: 'left' | 'center';
}

/**
 * Shelf packing: items are placed left → right in the given order, wrapping to a
 * new row when the next item would exceed `maxRowWidth`. A single item wider
 * than `maxRowWidth` gets its own row (the block grows to fit it).
 */
export function shelfPack(
  items: readonly PackItem[],
  maxRowWidth: number,
  gapX: number,
  gapY: number,
  opts: ShelfPackOptions = {}
): PackedBlock {
  const { alignY = 'top', alignX = 'left' } = opts;
  const rows: PackItem[][] = [];
  let row: PackItem[] = [];
  let rowWidth = 0;
  for (const it of items) {
    const needed = row.length === 0 ? it.width : rowWidth + gapX + it.width;
    if (row.length > 0 && needed > maxRowWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    rowWidth = row.length === 0 ? it.width : rowWidth + gapX + it.width;
    row.push(it);
  }
  if (row.length > 0) rows.push(row);

  const rowWidths = rows.map((r) => r.reduce((w, it, i) => w + it.width + (i > 0 ? gapX : 0), 0));
  const width = Math.max(0, ...rowWidths);
  const out: PackedItem[] = [];
  let y = 0;
  rows.forEach((r, ri) => {
    const rowHeight = Math.max(...r.map((it) => it.height));
    let x = alignX === 'center' ? (width - rowWidths[ri]) / 2 : 0;
    for (const it of r) {
      const dy = alignY === 'center' ? (rowHeight - it.height) / 2 : 0;
      out.push({ ...it, x, y: y + dy });
      x += it.width + gapX;
    }
    y += rowHeight + gapY;
  });
  return { items: out, width, height: Math.max(0, y - gapY) };
}

/** Column count for a roughly `aspect`:1 (w:h) block of `count` equal slots. */
export function pickCols(count: number, aspect = 1.6): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
}

export interface GridBlock {
  positions: { x: number; y: number }[];
  width: number;
  height: number;
  rows: number;
  cols: number;
}

/** Row-major grid of `count` equal slots; positions relative to the block's top-left. */
export function gridPositions(
  count: number,
  cols: number,
  slotW: number,
  slotH: number,
  gapX: number,
  gapY: number
): GridBlock {
  if (count <= 0 || cols <= 0) return { positions: [], width: 0, height: 0, rows: 0, cols: 0 };
  const rows = Math.ceil(count / cols);
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    positions.push({ x: c * (slotW + gapX), y: r * (slotH + gapY) });
  }
  const usedCols = Math.min(cols, count);
  return {
    positions,
    width: usedCols * slotW + (usedCols - 1) * gapX,
    height: rows * slotH + (rows - 1) * gapY,
    rows,
    cols: usedCols,
  };
}

// ---------------------------------------------------------------------------
// Edge aggregation for collapsible packs
// ---------------------------------------------------------------------------

export interface AggregateEdgeOptions {
  /** Stroke width for a bundle of `count` file edges (default 1.5 + log2(count) * 1.5). */
  widthFor?: (count: number) => number;
  /** Extra style for bundles (colour, dasharray…). */
  style?: Partial<EdgeThemeTokens>;
}

/** Bundle count is stored on the synthetic edge so renderers/overlays can read it. */
export interface AggregatedEdgeMeta {
  bundleCount: number;
}

/**
 * Re-route file edges around hidden files: an edge whose endpoint file is not
 * visible attaches to that file's category instead. Edges that end up inside
 * one category are dropped; identical category-level routes are merged into a
 * single bundle edge whose stroke width grows with the number of imports it
 * stands for. Edges between two visible files are passed through unchanged.
 */
export function aggregateEdges(
  edges: readonly ReactFlowEdge[],
  fileToCategory: ReadonlyMap<string, string>,
  visibleFiles: ReadonlySet<string>,
  opts: AggregateEdgeOptions = {}
): GraphEdge[] {
  const widthFor = opts.widthFor ?? ((n: number) => 1.5 + Math.log2(n) * 1.5);
  const out: GraphEdge[] = [];
  const bundles = new Map<string, { source: string; target: string; count: number }>();

  for (const e of edges) {
    const s = visibleFiles.has(e.source) ? e.source : fileToCategory.get(e.source);
    const t = visibleFiles.has(e.target) ? e.target : fileToCategory.get(e.target);
    if (!s || !t || s === t) continue;
    if (s === e.source && t === e.target) {
      out.push(e);
      continue;
    }
    const key = `${s}|${t}`;
    const b = bundles.get(key);
    if (b) b.count += 1;
    else bundles.set(key, { source: s, target: t, count: 1 });
  }

  for (const b of bundles.values()) {
    out.push({
      id: `bundle:${b.source}->${b.target}`,
      source: b.source,
      target: b.target,
      // No import names / module path → the label layer skips it.
      data: undefined,
      styleOverride: { strokeWidth: widthFor(b.count), ...opts.style },
      meta: { bundleCount: b.count },
    });
  }
  return out;
}
