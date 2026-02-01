/**
 * Layout algorithm for the Nested Containment Diagram visualization.
 *
 * Uses a three-phase approach:
 * 1. Tree Construction - Transform flat file nodes into hierarchical tree
 * 2. Bottom-Up Sizing - Calculate container dimensions from children
 * 3. Top-Down Positioning - Assign positions respecting parent containment
 *
 * This layout prioritizes vertical stacking for a balanced appearance.
 */

import type { Node } from '@xyflow/react';
import type { ReactFlowNode, ReactFlowEdge, Category } from '../../types';
import type {
  NestedLayoutConfig,
  NestedFileNodeData,
  NestedFolderNodeData,
  NestedDiagramNode,
  NestedDiagramEdge,
} from './types';
import { DEFAULT_NESTED_LAYOUT_CONFIG } from './types';

// =============================================================================
// Internal Tree Structure
// =============================================================================

interface TreeNode {
  id: string;
  name: string;
  path: string;
  depth: number;
  type: 'folder' | 'file';
  children: TreeNode[];
  originalNode?: ReactFlowNode;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface NestedLayoutResult {
  nodes: NestedDiagramNode[];
  edges: NestedDiagramEdge[];
}

// =============================================================================
// Phase 1: Build Tree
// =============================================================================

function buildTree(nodes: ReactFlowNode[]): TreeNode {
  const root: TreeNode = {
    id: 'root',
    name: 'root',
    path: '',
    depth: 0,
    type: 'folder',
    children: [],
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  };

  const folderMap = new Map<string, TreeNode>();
  folderMap.set('', root);

  const sortedNodes = [...nodes].sort(
    (a, b) =>
      a.data.path.split('/').length - b.data.path.split('/').length
  );

  for (const node of sortedNodes) {
    const pathParts = node.data.path.split('/').filter(Boolean);
    const fileName = pathParts[pathParts.length - 1];
    const folderParts = pathParts.slice(0, -1);

    let currentPath = '';
    let parentNode = root;

    for (let i = 0; i < folderParts.length; i++) {
      const part = folderParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(currentPath)) {
        const folderNode: TreeNode = {
          id: `folder-${currentPath}`,
          name: part,
          path: currentPath,
          depth: i + 1,
          type: 'folder',
          children: [],
          width: 0,
          height: 0,
          x: 0,
          y: 0,
        };
        folderMap.set(currentPath, folderNode);
        parentNode.children.push(folderNode);
      }
      parentNode = folderMap.get(currentPath)!;
    }

    parentNode.children.push({
      id: node.id,
      name: fileName,
      path: node.data.path,
      depth: pathParts.length,
      type: 'file',
      children: [],
      originalNode: node,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    });
  }

  return root;
}

// =============================================================================
// Phase 2: Calculate Dimensions (Bottom-Up)
// =============================================================================

/**
 * Calculate grid bounds for files - uses a more square/vertical grid.
 */
function calculateFileGridBounds(
  files: TreeNode[],
  config: NestedLayoutConfig
): { width: number; height: number; cols: number; rows: number } {
  if (files.length === 0) {
    return { width: 0, height: 0, cols: 0, rows: 0 };
  }

  // Use fewer columns for a more vertical layout
  const maxCols = Math.min(config.maxItemsPerRow, 3);
  const cols = Math.min(files.length, maxCols);
  const rows = Math.ceil(files.length / maxCols);

  const width = cols * config.fileNodeWidth + (cols - 1) * config.itemGapX;
  const height = rows * config.fileNodeHeight + (rows - 1) * config.itemGapY;

  return { width, height, cols, rows };
}

/**
 * Calculate bounds for folders arranged in a balanced grid (more vertical).
 * Folders are arranged in rows with limited items per row.
 */
function calculateFolderGridBounds(
  folders: TreeNode[],
  config: NestedLayoutConfig
): { width: number; height: number; cols: number; rows: number } {
  if (folders.length === 0) {
    return { width: 0, height: 0, cols: 0, rows: 0 };
  }

  // Determine grid layout - aim for more vertical arrangement
  // Use 2 columns max for folders to create vertical stacking
  const maxFolderCols = 2;
  const cols = Math.min(folders.length, maxFolderCols);
  const rows = Math.ceil(folders.length / maxFolderCols);

  // Calculate row heights (each row takes the max height of its folders)
  const rowHeights: number[] = [];
  const rowWidths: number[] = [];

  for (let row = 0; row < rows; row++) {
    const startIdx = row * maxFolderCols;
    const endIdx = Math.min(startIdx + maxFolderCols, folders.length);
    const rowFolders = folders.slice(startIdx, endIdx);

    const maxHeight = Math.max(...rowFolders.map(f => f.height));
    const totalWidth = rowFolders.reduce((sum, f) => sum + f.width, 0) +
      (rowFolders.length - 1) * config.itemGapX;

    rowHeights.push(maxHeight);
    rowWidths.push(totalWidth);
  }

  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) +
    (rows - 1) * config.itemGapY;
  const maxWidth = Math.max(...rowWidths);

  return { width: maxWidth, height: totalHeight, cols, rows };
}

function calculateDimensions(
  node: TreeNode,
  config: NestedLayoutConfig
): void {
  if (node.type === 'file') {
    node.width = config.fileNodeWidth;
    node.height = config.fileNodeHeight;
    return;
  }

  for (const child of node.children) {
    calculateDimensions(child, config);
  }

  if (node.children.length === 0) {
    node.width = config.minContainerWidth;
    node.height = config.minContainerHeight;
    return;
  }

  const folders = node.children.filter((c) => c.type === 'folder');
  const files = node.children.filter((c) => c.type === 'file');

  const fileGridBounds = calculateFileGridBounds(files, config);
  const folderGridBounds = calculateFolderGridBounds(folders, config);

  // Stack files on top, folders below (or vice versa)
  // Put folders first (top), then files below for hierarchical feel
  const contentWidth = Math.max(fileGridBounds.width, folderGridBounds.width);
  const gapBetweenSections = (folders.length > 0 && files.length > 0) ? config.itemGapY * 1.5 : 0;
  const contentHeight = folderGridBounds.height + gapBetweenSections + fileGridBounds.height;

  node.width = Math.max(
    config.minContainerWidth,
    contentWidth + config.containerPadding * 2
  );
  node.height = Math.max(
    config.minContainerHeight,
    config.headerHeight + contentHeight + config.containerPadding
  );
}

// =============================================================================
// Phase 3: Assign Positions (Top-Down)
// =============================================================================

function assignPositions(
  node: TreeNode,
  startX: number,
  startY: number,
  config: NestedLayoutConfig
): void {
  node.x = startX;
  node.y = startY;

  if (node.type === 'file' || node.children.length === 0) {
    return;
  }

  const contentX = config.containerPadding;
  let currentY = config.headerHeight;

  const folders = node.children.filter((c) => c.type === 'folder');
  const files = node.children.filter((c) => c.type === 'file');

  // Position folders first (in a grid, max 2 columns)
  if (folders.length > 0) {
    const maxFolderCols = 2;
    const rows = Math.ceil(folders.length / maxFolderCols);

    for (let row = 0; row < rows; row++) {
      const startIdx = row * maxFolderCols;
      const endIdx = Math.min(startIdx + maxFolderCols, folders.length);
      const rowFolders = folders.slice(startIdx, endIdx);

      // Calculate row width for centering
      const rowWidth = rowFolders.reduce((sum, f) => sum + f.width, 0) +
        (rowFolders.length - 1) * config.itemGapX;

      // Center the row
      let folderX = contentX + (node.width - config.containerPadding * 2 - rowWidth) / 2;

      const rowMaxHeight = Math.max(...rowFolders.map(f => f.height));

      for (const folder of rowFolders) {
        // Vertically center folders within the row
        const yOffset = (rowMaxHeight - folder.height) / 2;
        assignPositions(folder, folderX, currentY + yOffset, config);
        folderX += folder.width + config.itemGapX;
      }

      currentY += rowMaxHeight + config.itemGapY;
    }

    // Add extra gap before files
    if (files.length > 0) {
      currentY += config.itemGapY * 0.5;
    }
  }

  // Position files in a grid (max 3 columns for more vertical layout)
  if (files.length > 0) {
    const maxCols = Math.min(config.maxItemsPerRow, 3);
    const cols = Math.min(files.length, maxCols);
    const gridWidth = cols * config.fileNodeWidth + (cols - 1) * config.itemGapX;

    // Center the file grid
    const gridStartX = contentX + (node.width - config.containerPadding * 2 - gridWidth) / 2;

    files.forEach((file, index) => {
      const col = index % maxCols;
      const row = Math.floor(index / maxCols);
      file.x = gridStartX + col * (config.fileNodeWidth + config.itemGapX);
      file.y = currentY + row * (config.fileNodeHeight + config.itemGapY);
    });
  }
}

// =============================================================================
// Tree to ReactFlow Conversion
// =============================================================================

function countFiles(node: TreeNode): number {
  if (node.type === 'file') {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function getDominantCategory(node: TreeNode): Category {
  if (node.type === 'file') {
    return node.originalNode?.data.category || 'unknown';
  }

  const categoryCounts = new Map<Category, number>();

  function collectCategories(n: TreeNode): void {
    if (n.type === 'file' && n.originalNode) {
      const cat = n.originalNode.data.category;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    for (const child of n.children) {
      collectCategories(child);
    }
  }

  collectCategories(node);

  if (categoryCounts.size === 0) {
    return 'folder';
  }

  let maxCategory: Category = 'unknown';
  let maxCount = 0;

  categoryCounts.forEach((count, category) => {
    if (count > maxCount) {
      maxCount = count;
      maxCategory = category;
    }
  });

  return maxCategory;
}

function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return '';
  }
  return parts.slice(0, -1).join('/');
}

function treeToReactFlowNodes(root: TreeNode): NestedDiagramNode[] {
  const nodes: NestedDiagramNode[] = [];

  function traverse(node: TreeNode, parentId: string | undefined): void {
    if (node.id === 'root') {
      for (const child of node.children) {
        traverse(child, undefined);
      }
      return;
    }

    if (node.type === 'folder') {
      const folderNode: Node<NestedFolderNodeData, 'nestedFolder'> = {
        id: node.id,
        type: 'nestedFolder',
        position: { x: node.x, y: node.y },
        data: {
          label: node.name,
          path: node.path,
          parentPath: getParentPath(node.path),
          width: node.width,
          height: node.height,
          fileCount: countFiles(node),
          depth: node.depth,
          isExpanded: true,
          category: getDominantCategory(node),
        },
        style: {
          width: node.width,
          height: node.height,
        },
        ...(parentId && { parentId, extent: 'parent' as const }),
      };
      nodes.push(folderNode);

      for (const child of node.children) {
        traverse(child, node.id);
      }
    } else if (node.type === 'file' && node.originalNode) {
      const original = node.originalNode;
      const fileNode: Node<NestedFileNodeData, 'nestedFile'> = {
        id: node.id,
        type: 'nestedFile',
        position: { x: node.x, y: node.y },
        data: {
          label: node.name,
          path: original.data.path,
          folder: original.data.folder,
          language: original.data.language,
          role: original.data.role,
          description: original.data.description,
          category: original.data.category,
          imports: original.data.imports,
          sizeBytes: original.data.size_bytes,
          lineCount: original.data.line_count,
          depth: node.depth,
        },
        ...(parentId && { parentId, extent: 'parent' as const }),
      };
      nodes.push(fileNode);
    }
  }

  traverse(root, undefined);
  return nodes;
}

function sortNodesForReactFlow(nodes: NestedDiagramNode[]): NestedDiagramNode[] {
  const childrenMap = new Map<string, NestedDiagramNode[]>();
  const rootNodes: NestedDiagramNode[] = [];

  for (const node of nodes) {
    const parentId = (node as Node).parentId;
    if (parentId) {
      const siblings = childrenMap.get(parentId) || [];
      siblings.push(node);
      childrenMap.set(parentId, siblings);
    } else {
      rootNodes.push(node);
    }
  }

  const sorted: NestedDiagramNode[] = [];
  const queue = [...rootNodes];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const children = childrenMap.get(node.id) || [];
    queue.push(...children);
  }

  return sorted;
}

// =============================================================================
// Main Export Functions
// =============================================================================

export function buildNestedNodes(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  config: Partial<NestedLayoutConfig> = {}
): NestedLayoutResult {
  const finalConfig = { ...DEFAULT_NESTED_LAYOUT_CONFIG, ...config };

  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Phase 1: Build tree
  const tree = buildTree(nodes);

  // Phase 2: Calculate dimensions (bottom-up)
  calculateDimensions(tree, finalConfig);

  // Phase 3: Position top-level children vertically (stacked)
  let currentY = 0;
  for (const child of tree.children) {
    assignPositions(child, 0, currentY, finalConfig);
    currentY += child.height + finalConfig.topLevelGap;
  }

  // Convert to ReactFlow format
  const reactFlowNodes = treeToReactFlowNodes(tree);
  const sortedNodes = sortNodesForReactFlow(reactFlowNodes);
  const nestedEdges = edges as unknown as NestedDiagramEdge[];

  return {
    nodes: sortedNodes,
    edges: nestedEdges,
  };
}

export function calculateContainerBounds(
  children: Array<{ x: number; y: number; width: number; height: number }>,
  padding: number = 20
): { width: number; height: number } {
  if (children.length === 0) {
    return { width: padding * 2, height: padding * 2 };
  }

  let maxX = 0;
  let maxY = 0;

  for (const child of children) {
    const rightEdge = child.x + child.width;
    const bottomEdge = child.y + child.height;

    if (rightEdge > maxX) {
      maxX = rightEdge;
    }
    if (bottomEdge > maxY) {
      maxY = bottomEdge;
    }
  }

  return {
    width: maxX + padding,
    height: maxY + padding,
  };
}
