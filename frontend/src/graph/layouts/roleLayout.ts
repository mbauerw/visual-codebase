/**
 * roleLayout - pure layout math for the Role-based graph view.
 *
 * Files are grouped into Frontend / Backend / Test sections, then by
 * architectural role inside each section. Role boxes are arranged on a circle
 * per section; files inside a role box use either a rectangular n x (n+2) grid
 * (all files share one scale tier) or a stacked pyramid of scale tiers.
 *
 * This module is renderer-agnostic: no React, no React Flow. All boxes are in
 * ABSOLUTE world coordinates. It was extracted verbatim (numerically) from the
 * former inline layout in components/graphs/RoleLayoutGraph.tsx.
 */

import type {
  ArchitecturalRole,
  Category,
  ReactFlowNode,
  ReactFlowNodeData,
  ScaleTier,
} from '../../types';
import { categoryColors, roleLabels } from '../../types';
import { calculateNodeScales } from '../../hooks/useNodeScaling';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface RoleLayoutConfig {
  /** Slot width of a file box */
  nodeWidth: number;
  /** Slot height of a file box */
  nodeHeight: number;
  /** Horizontal gap between file boxes */
  nodeGapX: number;
  /** Vertical gap between file boxes */
  nodeGapY: number;
  /** Padding inside a role (category) box */
  rolePadding: number;
  /** Space reserved at the top of a role box for its header */
  roleHeaderHeight: number;
}

export const ROLE_LAYOUT_CONFIG: Readonly<RoleLayoutConfig> = {
  nodeWidth: 240,
  nodeHeight: 100,
  nodeGapX: 220,
  nodeGapY: 85,
  rolePadding: 195,
  roleHeaderHeight: 150,
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type RoleSectionCategory = 'frontend' | 'backend' | 'test';

/** A positioned file. `x`/`y` are absolute world coordinates. */
export interface RoleFileBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleTier: ScaleTier;
  /** id of the RoleCategoryBox this file sits in */
  categoryId: string;
  /** Original node data with `scaleTier` injected */
  data: ReactFlowNodeData;
}

/** A role container (one per role per section). Absolute coordinates. */
export interface RoleCategoryBox {
  id: string;
  role: ArchitecturalRole;
  label: string;
  category: RoleSectionCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeCount: number;
}

/** The Frontend / Backend / Tests ellipse section behind the role boxes. */
export interface RoleSectionBox {
  id: string;
  label: string;
  category: RoleSectionCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeCount: number;
  color: string;
}

export interface RoleLayoutResult {
  files: RoleFileBox[];
  categories: RoleCategoryBox[];
  sections: RoleSectionBox[];
}

export interface LayoutEdge {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// Small helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Categorize a file into the Frontend, Backend, or Test section. */
export function categorizeNode(category: Category, role: ArchitecturalRole): RoleSectionCategory {
  // Check role first - test role always goes to test group
  if (role === 'test') return 'test';

  switch (category) {
    case 'frontend':
      return 'frontend';
    case 'backend':
    case 'infrastructure':
      return 'backend';
    case 'test':
      return 'test';
    case 'shared':
    case 'config':
    case 'unknown':
    default:
      return 'frontend';
  }
}

/**
 * Calculate base column count for a given node count.
 * Used as the base 'n' for pyramid layout calculations.
 * Constraint: rows (height) is always 2 more than cols (width).
 */
export function calculateBaseColumns(nodeCount: number): number {
  if (nodeCount <= 0) return 0;
  if (nodeCount === 1) return 1;
  if (nodeCount === 2) return 2;

  // Find smallest cols where cols * (cols + 2) >= nodeCount
  let cols = 1;
  while (cols * (cols + 2) < nodeCount) {
    cols++;
  }
  return cols;
}

/**
 * Check if all nodes in a group have uniform dependency counts (same scale
 * tier). Used to decide between the pyramid and the rectangular layout.
 */
export function hasUniformDependencies(
  nodes: ReadonlyArray<{ id: string }>,
  nodeScales: Map<string, ScaleTier>
): boolean {
  if (nodes.length <= 1) return true;

  const firstScale = nodeScales.get(nodes[0].id) || 1;
  return nodes.every((node) => (nodeScales.get(node.id) || 1) === firstScale);
}

/** Grid dimensions for the rectangular layout (n x n+2). */
export function calculateRectangularGridDimensions(nodeCount: number): { cols: number; rows: number } {
  if (nodeCount === 0) return { cols: 0, rows: 0 };
  if (nodeCount === 1) return { cols: 1, rows: 1 };
  if (nodeCount === 2) return { cols: 2, rows: 1 };

  let cols = 1;
  while (cols * (cols + 2) < nodeCount) {
    cols++;
  }
  return { cols, rows: cols + 2 };
}

interface RoleDimensions {
  width: number;
  height: number;
  rows: number;
  maxCols: number;
}

/** Dimensions of a role box laid out as a rectangular grid. */
export function calculateRectangularRoleDimensions(
  nodeCount: number,
  config: RoleLayoutConfig = ROLE_LAYOUT_CONFIG
): RoleDimensions {
  if (nodeCount === 0) {
    return { width: 250, height: 150, rows: 0, maxCols: 0 };
  }

  const { nodeWidth, nodeHeight, nodeGapX, nodeGapY, rolePadding, roleHeaderHeight } = config;
  const { cols, rows } = calculateRectangularGridDimensions(nodeCount);

  const width = cols * (nodeWidth + nodeGapX) - nodeGapX + rolePadding * 2;
  const height = roleHeaderHeight + rows * (nodeHeight + nodeGapY) - nodeGapY + rolePadding;

  return {
    width: Math.max(width, 300),
    height: Math.max(height, 180),
    rows,
    maxCols: cols,
  };
}

/**
 * Pyramid layout tier configuration.
 * Top 10% (scale > 1.25): n - 2 max nodes per row
 * Next 25% (scale 1.25): n - 1 max nodes per row
 * Bottom 65% (scale 1.0): n max nodes per row
 */
interface PyramidTier<T> {
  scaleTier: ScaleTier;
  maxCols: number;
  nodes: T[];
}

/**
 * Separate nodes into pyramid tiers and calculate max columns for each.
 * Nodes should already be sorted by dependency count (highest first).
 */
function createPyramidTiers<T extends { id: string }>(
  sortedNodes: ReadonlyArray<T>,
  nodeScales: Map<string, ScaleTier>,
  baseCols: number
): PyramidTier<T>[] {
  // Separate nodes by their scale tier using range-based comparisons
  // to support any ScaleTier value (1, 1.25, 1.5, 2, 2.5, 3, etc.)
  const topTier: T[] = []; // scale > 1.25 (top 10%)
  const midTier: T[] = []; // scale === 1.25 (next 25%)
  const bottomTier: T[] = []; // scale <= 1 (bottom 65%)
  let topTierScale: ScaleTier = 1.5;

  sortedNodes.forEach((node) => {
    const scale = nodeScales.get(node.id) || 1;
    if (scale > 1.25) {
      topTier.push(node);
      topTierScale = scale; // Track the actual scale used
    } else if (scale === 1.25) {
      midTier.push(node);
    } else {
      bottomTier.push(node);
    }
  });

  const tiers: PyramidTier<T>[] = [];

  if (topTier.length > 0) {
    tiers.push({ scaleTier: topTierScale, maxCols: Math.max(1, baseCols - 2), nodes: topTier });
  }
  if (midTier.length > 0) {
    tiers.push({ scaleTier: 1.25, maxCols: Math.max(1, baseCols - 1), nodes: midTier });
  }
  if (bottomTier.length > 0) {
    tiers.push({ scaleTier: 1, maxCols: Math.max(1, baseCols), nodes: bottomTier });
  }

  return tiers;
}

/** Extra horizontal gap for the top pyramid tier (scaled by its tier). */
function topTierExtraGapX(scaleTier: ScaleTier): number {
  return Math.round(90 * (scaleTier / 1.5)) + 50;
}

/** Extra vertical gap for the top pyramid tier (scaled by its tier). */
function topTierExtraGapY(scaleTier: ScaleTier): number {
  return Math.round(40 * (scaleTier / 1.5));
}

/**
 * Dimensions of a role box laid out as a pyramid: width from the widest tier,
 * height from all tiers stacked.
 */
export function calculatePyramidRoleDimensions(
  nodeCount: number,
  nodeScales: Map<string, ScaleTier>,
  sortedNodes: ReadonlyArray<{ id: string }>,
  config: RoleLayoutConfig = ROLE_LAYOUT_CONFIG
): RoleDimensions {
  if (nodeCount === 0) {
    return { width: 250, height: 150, rows: 0, maxCols: 0 };
  }

  const { nodeWidth, nodeHeight, nodeGapX, nodeGapY, rolePadding, roleHeaderHeight } = config;
  const baseCols = calculateBaseColumns(nodeCount);
  const tiers = createPyramidTiers(sortedNodes, nodeScales, baseCols);

  // Total height across all tiers (accounting for tier-specific gaps)
  let totalHeight = roleHeaderHeight;
  let totalRows = 0;
  tiers.forEach((tier) => {
    const tierRows = Math.ceil(tier.nodes.length / tier.maxCols);
    totalRows += tierRows;
    // Top tier gets extra vertical spacing scaled proportionally
    const tierGapY = tier.scaleTier > 1.25 ? nodeGapY + topTierExtraGapY(tier.scaleTier) : nodeGapY;
    totalHeight += tierRows * (nodeHeight + tierGapY);
  });
  totalHeight += rolePadding - nodeGapY; // Adjust for last row (no gap after) + padding

  // Width based on widest tier (bottom tier with baseCols) or top tier with extra horizontal gap
  const topTierScaleForWidth = tiers.find((t) => t.scaleTier > 1.25)?.scaleTier || 1.5;
  const extraGapX = topTierExtraGapX(topTierScaleForWidth);
  const topTierWidth =
    Math.max(1, baseCols - 2) * (nodeWidth + nodeGapX + extraGapX) - (nodeGapX + extraGapX) + rolePadding * 2;
  const bottomTierWidth = baseCols * (nodeWidth + nodeGapX) - nodeGapX + rolePadding * 2;
  const width = Math.max(topTierWidth, bottomTierWidth);

  return {
    width: Math.max(width, 300),
    height: Math.max(totalHeight, 180),
    rows: totalRows,
    maxCols: baseCols,
  };
}

// ---------------------------------------------------------------------------
// Circle layout of role boxes within a section
// ---------------------------------------------------------------------------

interface RoleGroup {
  role: ArchitecturalRole;
  nodes: ReactFlowNode[];
}

interface SectionLayout {
  categories: RoleCategoryBox[];
  files: RoleFileBox[];
  /** NOTE: this is the circle DIAMETER (radius * 2), kept under the historical name */
  circleRadius: number;
  centerX: number;
  centerY: number;
}

/**
 * Lay out one section's role groups on a circle. Returns absolute boxes.
 * `roleGroups` must already be sorted; nodes within a group must be sorted by
 * dependency count (highest first).
 */
export function layoutRoleCategoriesInCircle(
  roleGroups: RoleGroup[],
  categoryId: string,
  topCategory: RoleSectionCategory,
  nodeScales: Map<string, ScaleTier>,
  offsetX: number,
  offsetY: number = 0,
  config: RoleLayoutConfig = ROLE_LAYOUT_CONFIG
): SectionLayout {
  const { nodeWidth, nodeHeight, nodeGapX, nodeGapY, roleHeaderHeight } = config;
  const categories: RoleCategoryBox[] = [];
  const files: RoleFileBox[] = [];

  if (roleGroups.length === 0) {
    return {
      categories,
      files,
      circleRadius: 300,
      centerX: offsetX + 300,
      centerY: offsetY + 300,
    };
  }

  // Dimensions for all role categories: rectangular for uniform dependencies,
  // pyramid otherwise
  const roleDimensions = roleGroups.map((rg) => {
    if (hasUniformDependencies(rg.nodes, nodeScales)) {
      return calculateRectangularRoleDimensions(rg.nodes.length, config);
    }
    return calculatePyramidRoleDimensions(rg.nodes.length, nodeScales, rg.nodes, config);
  });
  const maxRoleWidth = Math.max(...roleDimensions.map((d) => d.width));
  const maxRoleHeight = Math.max(...roleDimensions.map((d) => d.height));

  // The radius must accommodate all role boxes placed around the circle
  const numRoles = roleGroups.length;
  const roleSpacing = 10;
  const edgePadding = 100; // Padding from role edges to circle boundary

  let circleRadius: number;
  if (numRoles <= 1) {
    // Single role: radius needs to fit the role plus padding
    circleRadius = Math.max(maxRoleWidth, maxRoleHeight) / 2 + edgePadding;
  } else if (numRoles === 2) {
    // Two roles placed opposite each other
    circleRadius = maxRoleWidth / 2 + maxRoleHeight / 2 + edgePadding;
  } else if (numRoles <= 4) {
    // Small number of roles: radius = placement_radius + role_extent
    const placementRadius = Math.max(maxRoleWidth, maxRoleHeight) + roleSpacing;
    circleRadius = placementRadius + maxRoleHeight / 2 + edgePadding;
  } else {
    // Larger numbers: circumference must fit all roles
    // C = numRoles * (maxRoleWidth + spacing) = 2 * PI * placementRadius
    const circumference = numRoles * (maxRoleWidth + roleSpacing);
    const placementRadius = circumference / (2 * Math.PI);
    circleRadius = placementRadius + maxRoleHeight / 2 + edgePadding;
  }

  circleRadius = Math.max(circleRadius, 400);

  const centerX = offsetX + circleRadius;
  const centerY = offsetY + circleRadius;
  // Place roles so their outer edges are edgePadding away from the circle boundary
  const placementRadius = circleRadius - maxRoleHeight / 2 - edgePadding;

  roleGroups.forEach((roleGroup, index) => {
    const dims = roleDimensions[index];
    const roleCategoryId = `${categoryId}-${roleGroup.role}`;

    // Position on the circle (top-left of the role box)
    let x: number, y: number;
    if (numRoles === 1) {
      x = centerX - dims.width / 2;
      y = centerY - dims.height / 2;
    } else {
      const angle = (index / numRoles) * 2 * Math.PI - Math.PI / 2;
      x = centerX + Math.cos(angle) * placementRadius - dims.width / 2;
      y = centerY + Math.sin(angle) * placementRadius - dims.height / 2;
    }

    categories.push({
      id: roleCategoryId,
      role: roleGroup.role,
      label: roleLabels[roleGroup.role],
      category: topCategory,
      x,
      y,
      width: dims.width,
      height: dims.height,
      nodeCount: roleGroup.nodes.length,
    });

    const containerCenterX = dims.width / 2;
    const isUniform = hasUniformDependencies(roleGroup.nodes, nodeScales);

    const pushFile = (node: ReactFlowNode, relX: number, relY: number, scaleTier: ScaleTier) => {
      files.push({
        id: node.id,
        x: x + relX,
        y: y + relY,
        width: nodeWidth,
        height: nodeHeight,
        scaleTier,
        categoryId: roleCategoryId,
        data: { ...node.data, scaleTier },
      });
    };

    if (isUniform) {
      // Rectangular layout for uniform dependencies (n x n+2 grid).
      // Bottom rows fill first (top row may be partial).
      const { cols } = calculateRectangularGridDimensions(roleGroup.nodes.length);
      // When all nodes have the same dependency count, use baseline scale (no scaling)
      const uniformScaleTier: ScaleTier = 1;
      const totalRows = Math.ceil(roleGroup.nodes.length / cols);
      // First row (top) may have fewer nodes
      const nodesInFirstRow = roleGroup.nodes.length - (totalRows - 1) * cols;

      roleGroup.nodes.forEach((node, nodeIndex) => {
        let row: number, colInRow: number, nodesInThisRow: number;

        if (nodeIndex < nodesInFirstRow) {
          // Top row (may be partial)
          row = 0;
          colInRow = nodeIndex;
          nodesInThisRow = nodesInFirstRow;
        } else {
          // Remaining rows (always full)
          const adjustedIndex = nodeIndex - nodesInFirstRow;
          row = 1 + Math.floor(adjustedIndex / cols);
          colInRow = adjustedIndex % cols;
          nodesInThisRow = cols;
        }

        // Center each row
        const rowWidth = nodesInThisRow * nodeWidth + (nodesInThisRow - 1) * nodeGapX;
        const rowStartX = containerCenterX - rowWidth / 2;

        const nodeX = rowStartX + colInRow * (nodeWidth + nodeGapX);
        const nodeY = roleHeaderHeight + row * (nodeHeight + nodeGapY);

        pushFile(node, nodeX, nodeY, uniformScaleTier);
      });
    } else {
      // Pyramid layout for varied dependencies (tiers stacked vertically).
      // Bottom rows fill first within each tier (top row may be partial).
      const baseCols = calculateBaseColumns(roleGroup.nodes.length);
      const tiers = createPyramidTiers(roleGroup.nodes, nodeScales, baseCols);

      let currentYOffset = roleHeaderHeight;

      tiers.forEach((tier) => {
        const { maxCols, nodes: tierNodes, scaleTier } = tier;

        // Top tier gets extra spacing scaled proportionally to the scale value
        const tierGapX = scaleTier > 1.25 ? nodeGapX + topTierExtraGapX(scaleTier) : nodeGapX;
        const tierGapY = scaleTier > 1.25 ? nodeGapY + topTierExtraGapY(scaleTier) : nodeGapY;

        const tierRowCount = Math.ceil(tierNodes.length / maxCols);
        // First row (top) of this tier may have fewer nodes
        const nodesInFirstRow = tierNodes.length - (tierRowCount - 1) * maxCols;

        tierNodes.forEach((node, nodeIndexInTier) => {
          let rowInTier: number, colInRow: number, nodesInThisRow: number;

          if (nodeIndexInTier < nodesInFirstRow) {
            // Top row of tier (may be partial)
            rowInTier = 0;
            colInRow = nodeIndexInTier;
            nodesInThisRow = nodesInFirstRow;
          } else {
            // Remaining rows (always full)
            const adjustedIndex = nodeIndexInTier - nodesInFirstRow;
            rowInTier = 1 + Math.floor(adjustedIndex / maxCols);
            colInRow = adjustedIndex % maxCols;
            nodesInThisRow = maxCols;
          }

          // Center each row
          const rowWidth = nodesInThisRow * nodeWidth + (nodesInThisRow - 1) * tierGapX;
          const rowStartX = containerCenterX - rowWidth / 2;

          const nodeX = rowStartX + colInRow * (nodeWidth + tierGapX);
          const nodeY = currentYOffset + rowInTier * (nodeHeight + tierGapY);

          pushFile(node, nodeX, nodeY, scaleTier);
        });

        // Move Y offset to next tier (add this tier's total height)
        currentYOffset += tierRowCount * (nodeHeight + tierGapY);
      });
    }
  });

  return {
    categories,
    files,
    circleRadius: circleRadius * 2,
    centerX,
    centerY,
  };
}

// ---------------------------------------------------------------------------
// Top-level layout
// ---------------------------------------------------------------------------

/**
 * Compute the full role layout: role boxes on a circle per section, files in
 * each role box, and the Frontend / Backend / Tests background sections.
 * All coordinates are absolute. Deterministic for a given input.
 */
export function computeRoleLayout(
  fileNodes: ReactFlowNode[],
  edges: ReadonlyArray<LayoutEdge>,
  configOverrides?: Partial<RoleLayoutConfig>
): RoleLayoutResult {
  const config: RoleLayoutConfig = { ...ROLE_LAYOUT_CONFIG, ...configOverrides };

  // Count dependencies for each node (bidirectional)
  const dependencyCount: Record<string, number> = {};
  fileNodes.forEach((node) => {
    dependencyCount[node.id] = 0;
  });
  edges.forEach((edge) => {
    if (dependencyCount[edge.source] !== undefined) {
      dependencyCount[edge.source]++;
    }
    if (dependencyCount[edge.target] !== undefined) {
      dependencyCount[edge.target]++;
    }
  });

  // Scale tiers based on dependency percentiles within each role
  const nodeScales: Map<string, ScaleTier> = calculateNodeScales(fileNodes, edges);

  // Group nodes by section (frontend/backend/test) and then by role
  const frontendRoles: Map<ArchitecturalRole, ReactFlowNode[]> = new Map();
  const backendRoles: Map<ArchitecturalRole, ReactFlowNode[]> = new Map();
  const testRoles: Map<ArchitecturalRole, ReactFlowNode[]> = new Map();

  fileNodes.forEach((node) => {
    const categoryGroup = categorizeNode(node.data.category, node.data.role);
    const roleMap =
      categoryGroup === 'frontend' ? frontendRoles : categoryGroup === 'test' ? testRoles : backendRoles;

    if (!roleMap.has(node.data.role)) {
      roleMap.set(node.data.role, []);
    }
    roleMap.get(node.data.role)!.push(node);
  });

  // Sort nodes within each role by dependency count (highest first)
  const sortByDeps = (a: ReactFlowNode, b: ReactFlowNode) => dependencyCount[b.id] - dependencyCount[a.id];

  frontendRoles.forEach((nodes) => nodes.sort(sortByDeps));
  backendRoles.forEach((nodes) => nodes.sort(sortByDeps));
  testRoles.forEach((nodes) => nodes.sort(sortByDeps));

  // Sort role groups by total dependency count (highest first)
  const sortRoleGroups = (roleMap: Map<ArchitecturalRole, ReactFlowNode[]>): RoleGroup[] => {
    return Array.from(roleMap.entries())
      .map(([role, nodes]) => ({ role, nodes }))
      .sort((a, b) => {
        const totalDepsA = a.nodes.reduce((sum, n) => sum + dependencyCount[n.id], 0);
        const totalDepsB = b.nodes.reduce((sum, n) => sum + dependencyCount[n.id], 0);
        return totalDepsB - totalDepsA;
      });
  };

  const frontendRoleGroups = sortRoleGroups(frontendRoles);
  const backendRoleGroups = sortRoleGroups(backendRoles);
  const testRoleGroups = sortRoleGroups(testRoles);

  // Frontend section
  const frontendLayout = layoutRoleCategoriesInCircle(
    frontendRoleGroups,
    'frontend',
    'frontend',
    nodeScales,
    50,
    0,
    config
  );

  // Backend section (to the right of frontend)
  const frontendWidth = frontendLayout.circleRadius;
  const backendLayout = layoutRoleCategoriesInCircle(
    backendRoleGroups,
    'backend',
    'backend',
    nodeScales,
    frontendWidth + 50,
    0,
    config
  );

  // Test section (below backend)
  const backendSize = Math.max(backendLayout.circleRadius, 600);
  const testOffsetY = backendLayout.centerY + backendSize / 2 + 100;
  const testLayout = layoutRoleCategoriesInCircle(
    testRoleGroups,
    'test',
    'test',
    nodeScales,
    frontendWidth + 50,
    testOffsetY,
    config
  );

  // Total node counts per section
  const frontendNodeCount = frontendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);
  const backendNodeCount = backendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);
  const testNodeCount = testRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);

  // Background sections
  const frontendSize = Math.max(frontendLayout.circleRadius, 600);
  const testSize = Math.max(testLayout.circleRadius, 600);

  const sections: RoleSectionBox[] = [
    {
      id: 'section-frontend',
      label: 'Frontend',
      category: 'frontend',
      x: frontendLayout.centerX - frontendSize / 2,
      y: frontendLayout.centerY - frontendSize / 2,
      width: frontendSize,
      height: frontendSize,
      nodeCount: frontendNodeCount,
      color: categoryColors.frontend,
    },
    {
      id: 'section-backend',
      label: 'Backend',
      category: 'backend',
      x: backendLayout.centerX - backendSize / 2,
      y: backendLayout.centerY - backendSize / 2,
      width: backendSize,
      height: backendSize,
      nodeCount: backendNodeCount,
      color: categoryColors.backend,
    },
  ];

  // Only add the test section if there are test files
  if (testNodeCount > 0) {
    sections.push({
      id: 'section-test',
      label: 'Tests',
      category: 'test',
      x: testLayout.centerX - testSize / 2,
      y: testLayout.centerY - testSize / 2,
      width: testSize,
      height: testSize,
      nodeCount: testNodeCount,
      color: categoryColors.test,
    });
  }

  return {
    categories: [...frontendLayout.categories, ...backendLayout.categories, ...testLayout.categories],
    files: [...frontendLayout.files, ...backendLayout.files, ...testLayout.files],
    sections,
  };
}
