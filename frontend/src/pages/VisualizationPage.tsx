import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
  Panel,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Search,
  FileCode,
  GitBranch,
  Clock,
  LayoutGrid,
  FolderTree,
  Network,
  User,
} from 'lucide-react';

import CustomNode, { type CustomNodeType } from '../components/CustomNode';
import CategoryNode, { type CategoryNodeType, type CategoryNodeData, CategoryRoleData } from '../components/CategoryNode';
import CategoryBackground, { type CategorySection } from '../components/Categorybackground'
import NodeDetailPanel from '../components/NodeDetailPanel';
import CategoryRolePanel from '../components/CateogoryDetailPanel';
import UserDashboardModal from '../components/UserDashboardModal';
import type {
  ReactFlowGraph,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
  Category,
  LayoutType,
  AnalysisMetadata,
} from '../types';
import { roleColors, languageColors, categoryColors, roleLabels } from '../types';
import GithubEmbed from '../components/GithubEmbed';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from '../components/AuthModal';
import { getAnalysisResult } from '../api/client';

// Define node types with proper typing for React Flow v12
const nodeTypes: NodeTypes = {
  custom: CustomNode,
  category: CategoryNode,
};

// Combined node type for all nodes in the graph
type AllNodeTypes = CustomNodeType | CategoryNodeType;

interface stylesType  {
  background: string
  '--xy-node-color-default'?: string
}

const nodeWidth = 200;
const nodeHeight = 90;
const nodeGapX = 40;  // Horizontal space between file nodes
const nodeGapY = 35;  // Vertical space between file nodes
const rolePadding = 45;  // Padding inside role containers
const roleHeaderHeight = 55;  // Space for role header

// Categorize nodes into Frontend vs Backend groups
function categorizeNode(category: Category): 'frontend' | 'backend' {
  switch (category) {
    case 'frontend':
      return 'frontend';
    case 'backend':
    case 'infrastructure':
      return 'backend';
    case 'shared':
    case 'test':
    case 'config':
    case 'unknown':
    default:
      return 'frontend';
  }
}

// Calculate tree layout positions for nodes
function getTreePositions(nodeCount: number): { row: number; col: number; totalInRow: number }[] {
  const positions: { row: number; col: number; totalInRow: number }[] = [];
  let remaining = nodeCount;
  let row = 0;

  console.log("Calculating tree positions for node count:", nodeCount);
  while (remaining > 0) {
    const nodesInRow = row + 1;
    const actualInRow = Math.min(nodesInRow, remaining);

    for (let col = 0; col < actualInRow; col++) {
      positions.push({ row, col, totalInRow: actualInRow });
    }

    remaining -= actualInRow;
    row++;
  }

  return positions;
}

// Calculate dimensions for a role category with tree layout
function calculateTreeRoleDimensions(nodeCount: number): { width: number; height: number; rows: number; maxCols: number } {
  if (nodeCount === 0) {
    return { width: 250, height: 150, rows: 0, maxCols: 0 };
  }

  console.log("Calculating tree role dimensions for node count:", nodeCount);
  let remaining = nodeCount;
  let rows = 0;
  let maxCols = 0;

  while (remaining > 0) {
    const nodesInRow = rows + 1;
    const actualInRow = Math.min(nodesInRow, remaining);
    maxCols = Math.max(maxCols, actualInRow);
    remaining -= actualInRow;
    rows++;
  }

  const width = maxCols * (nodeWidth + nodeGapX) + rolePadding * 2 ;
  const height = roleHeaderHeight + rows * (nodeHeight + nodeGapY) + rolePadding ;

  return {
    width: Math.max(width, 300),
    height: Math.max(height, 180),
    rows,
    maxCols,
  };
}

// Layout interface for return type
interface LayoutResult {
  nodes: AllNodeTypes[];
  edges: Edge[];
  categorySections: CategorySection[];
}

// Custom layout that creates nested category hierarchy:
// Static Background (Frontend/Backend) -> Role Categories (nodes) -> File Nodes (in tree pattern)
function getNestedCategoryLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): LayoutResult {
  // Count dependencies for each node
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

  // Group nodes by category (frontend/backend) and then by role
  type RoleGroup = { role: ArchitecturalRole; nodes: CustomNodeType[] };

  const frontendRoles: Map<ArchitecturalRole, CustomNodeType[]> = new Map();
  const backendRoles: Map<ArchitecturalRole, CustomNodeType[]> = new Map();

  fileNodes.forEach((node) => {
    const categoryGroup = categorizeNode(node.data.category);
    const roleMap = categoryGroup === 'frontend' ? frontendRoles : backendRoles;

    if (!roleMap.has(node.data.role)) {
      roleMap.set(node.data.role, []);
    }
    roleMap.get(node.data.role)!.push(node);
  });

  // Sort nodes within each role by dependency count
  const sortByDeps = (a: CustomNodeType, b: CustomNodeType) =>
    dependencyCount[b.id] - dependencyCount[a.id];

  frontendRoles.forEach((nodes) => nodes.sort(sortByDeps));
  backendRoles.forEach((nodes) => nodes.sort(sortByDeps));

  // Sort role groups by total dependency count
  const sortRoleGroups = (roleMap: Map<ArchitecturalRole, CustomNodeType[]>): RoleGroup[] => {
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

  // Layout role categories in a circular pattern and return absolute positions
  const layoutRoleCategoriesInCircle = (
    roleGroups: RoleGroup[],
    categoryId: string,
    topCategory: 'frontend' | 'backend',
    offsetX: number
  ): {
    roleCategoryNodes: CategoryNodeType[];
    fileNodes: CustomNodeType[];
    circleRadius: number;
    centerX: number;
    centerY: number;
  } => {
    const roleCategoryNodes: CategoryNodeType[] = [];
    const positionedFileNodes: CustomNodeType[] = [];

    if (roleGroups.length === 0) {
      return {
        roleCategoryNodes,
        fileNodes: positionedFileNodes,
        circleRadius: 300,

        centerX: offsetX + 300,
        centerY: 300,
      };
    }

    // Calculate dimensions for all role categories first
    const roleDimensions = roleGroups.map((rg) => calculateTreeRoleDimensions(rg.nodes.length));
    const maxRoleWidth = Math.max(...roleDimensions.map((d) => d.width));
    const maxRoleHeight = Math.max(...roleDimensions.map((d) => d.height));
    const averageRoleWidth = roleDimensions.reduce((sum, d) => sum + d.width, 0) / roleDimensions.length;
    const averageRoleHeight = roleDimensions.reduce((sum, d) => sum + d.height, 0) / roleDimensions.length;

    // Calculate the circle radius needed
    const numRoles = roleGroups.length;
    const roleSpacing = 10;

    let circleRadius: number;
    if (numRoles <= 1) {
      circleRadius = Math.max(maxRoleWidth, maxRoleHeight) / 2;
    } else if (numRoles <= 4) {
      circleRadius = (maxRoleWidth + roleSpacing);
    } else if (numRoles <= 8) {
      circleRadius = (numRoles * (maxRoleWidth + roleSpacing)) / (2 * Math.PI) + maxRoleHeight;
    } else {
      circleRadius = (numRoles * (maxRoleWidth + roleSpacing)) / (2 * Math.PI) + maxRoleHeight;
    }

    circleRadius = Math.max(circleRadius, 400);

    // Calculate center position (with offset for this category section)
    const centerX = offsetX + circleRadius;
    console.log("Center X:", centerX);
    const centerY = circleRadius; // Add some top padding
    console.log("Center Y:", centerY);
    const placementRadius = circleRadius - maxRoleHeight / 2 - 200;
    console.log("Placement Radius:", placementRadius);

    roleGroups.forEach((roleGroup, index) => {
      const dims = roleDimensions[index];
      const roleCategoryId = `${categoryId}-${roleGroup.role}`;

      // Calculate absolute position on the circle
      let x: number, y: number;

      if (numRoles === 1) {
        x = centerX - dims.width / 2;
        y = centerY - dims.height / 2;
      } else {
        const angle = (index / numRoles) * 2 * Math.PI - Math.PI / 2;
        x = centerX + Math.cos(angle) * placementRadius - dims.width / 2;
        y = centerY + Math.sin(angle) * placementRadius - dims.height / 2;
      }

      // Create role category node (NO parentId - absolute positioning)
      const roleCategoryNode: CategoryNodeType = {
        id: roleCategoryId,
        type: 'category',
        position: { x, y },
        data: {
          label: roleLabels[roleGroup.role],
          category: topCategory,
          role: roleGroup.role,
          width: dims.width,
          height: dims.height,
          nodeCount: roleGroup.nodes.length,
          level: 'role',
        },
        draggable: true,
        selectable: true,
      };
      roleCategoryNodes.push(roleCategoryNode);

      // Position file nodes in tree pattern within this role category
      const treePositions = getTreePositions(roleGroup.nodes.length);
      const containerCenterX = dims.width / 2;

      roleGroup.nodes.forEach((node, nodeIndex) => {
        const pos = treePositions[nodeIndex];
        const rowWidth = pos.totalInRow * nodeWidth + (pos.totalInRow - 1) * nodeGapX;
        const rowStartX = containerCenterX - rowWidth / 2;
        const nodeX = rowStartX + pos.col * (nodeWidth + nodeGapX);
        const nodeY = roleHeaderHeight + pos.row * (nodeHeight + nodeGapY);

        positionedFileNodes.push({
          ...node,
          position: { x: nodeX, y: nodeY },
          parentId: roleCategoryId,
          extent: 'parent' as const,
          expandParent: true,
        });
      });
    });

    return {
      roleCategoryNodes,
      fileNodes: positionedFileNodes,
      circleRadius: circleRadius * 2,
      centerX,
      centerY,
    };
  };

  // Layout frontend categories (starting at x=0)
  const frontendLayout = layoutRoleCategoriesInCircle(
    frontendRoleGroups,
    'frontend',
    'frontend',
    50 // Left padding
  );

  // Layout backend categories (offset to the right of frontend)
  const frontendWidth = frontendLayout.circleRadius;
  const backendLayout = layoutRoleCategoriesInCircle(
    backendRoleGroups,
    'backend',
    'backend',
    frontendWidth + 50 // Gap between sections
  );

  // Calculate total node counts
  const frontendNodeCount = frontendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);
  const backendNodeCount = backendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);

  // Create category sections for the static background
  const frontendSize = Math.max(frontendLayout.circleRadius, 600);
  const backendSize = Math.max(backendLayout.circleRadius, 600);

  const categorySections: CategorySection[] = [
    {
      id: 'section-frontend',
      label: 'Frontend',
      category: 'frontend',
      x: frontendLayout.centerX - frontendSize / 2,
      y: frontendLayout.centerY - frontendSize / 2,
      width: frontendSize,
      height: frontendSize,
      nodeCount: frontendNodeCount,
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
    },
  ];

  // Combine all nodes (only role categories and file nodes - no top-level category nodes)
  const allNodes: AllNodeTypes[] = [
    ...frontendLayout.roleCategoryNodes,
    ...backendLayout.roleCategoryNodes,
    ...frontendLayout.fileNodes,
    ...backendLayout.fileNodes,
  ];

  return { nodes: allNodes, edges, categorySections };
}

// File Hierarchy Layout - arranges folders in a centered tree structure
// Root at top, children expand left and right below, with edges connecting folders
function getFileHierarchyLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): LayoutResult {
  // Build a tree structure from file paths
  interface TreeNode {
    name: string;
    path: string;
    depth: number;
    children: TreeNode[];
    files: CustomNodeType[];
    // Layout properties (calculated later)
    width: number;
    height: number;
    subtreeWidth: number;
    x: number;
    y: number;
  }

  const root: TreeNode = {
    name: 'root',
    path: '',
    depth: 0,
    children: [],
    files: [],
    width: 0,
    height: 0,
    subtreeWidth: 0,
    x: 0,
    y: 0,
  };

  // Map to quickly find tree nodes by path
  const nodesByPath: Map<string, TreeNode> = new Map();
  nodesByPath.set('', root);

  // Insert each file into the tree, creating folder nodes along the way
  fileNodes.forEach((node) => {
    const pathParts = node.data.path.split('/').filter(Boolean);
    let currentPath = '';

    // Navigate/create folder path (all but the last part which is the file)
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!nodesByPath.has(currentPath)) {
        const newNode: TreeNode = {
          name: part,
          path: currentPath,
          depth: i + 1,
          children: [],
          files: [],
          width: 0,
          height: 0,
          subtreeWidth: 0,
          x: 0,
          y: 0,
        };
        nodesByPath.set(currentPath, newNode);

        // Add to parent's children
        const parent = nodesByPath.get(parentPath)!;
        parent.children.push(newNode);
      }
    }

    // Add file to the appropriate folder
    const folderPath = pathParts.slice(0, -1).join('/');
    const folder = nodesByPath.get(folderPath) || root;
    folder.files.push(node);
  });

  // Layout constants
  const folderPadding = 25;
  const folderHeaderHeight = 40;
  const fileGapX = 50;
  const fileGapY = 20;
  const filesPerRow = 3;
  const folderGapX = 240; // Horizontal gap between sibling folders
  const levelGapY = 320; // Vertical gap between depth levels

  // Calculate dimensions for a folder based on its files
  function calculateFolderDimensions(fileCount: number): { width: number; height: number } {
    if (fileCount === 0) {
      return { width: 120, height: 50 };
    }
    const rows = Math.ceil(fileCount / filesPerRow);
    const cols = Math.min(fileCount, filesPerRow);
    const width = folderPadding * 2 + cols * nodeWidth + (cols - 1) * fileGapX;
    const height = folderHeaderHeight + folderPadding + rows * nodeHeight + (rows - 1) * fileGapY + folderPadding;
    return { width: Math.max(width, 180), height: Math.max(height, 70) };
  }

  // First pass: calculate dimensions for each folder
  function calculateDimensions(node: TreeNode) {
    // Sort children alphabetically
    node.children.sort((a, b) => a.name.localeCompare(b.name));

    // Recursively calculate children first
    node.children.forEach(calculateDimensions);

    // Calculate this node's dimensions
    const dims = calculateFolderDimensions(node.files.length);
    node.width = dims.width;
    node.height = dims.height;

    // Calculate subtree width (max of own width or sum of children's subtree widths)
    if (node.children.length === 0) {
      node.subtreeWidth = node.width;
    } else {
      const childrenTotalWidth = node.children.reduce(
        (sum, child) => sum + child.subtreeWidth,
        0
      ) + (node.children.length - 1) * folderGapX;
      node.subtreeWidth = Math.max(node.width, childrenTotalWidth);
    }
  }

  calculateDimensions(root);

  // Second pass: assign positions (centered tree layout)
  function assignPositions(node: TreeNode, centerX: number, y: number) {
    node.x = centerX - node.width / 2;
    node.y = y;

    if (node.children.length > 0) {
      // Calculate starting X for children (centered under parent)
      const childrenTotalWidth = node.children.reduce(
        (sum, child) => sum + child.subtreeWidth,
        0
      ) + (node.children.length - 1) * folderGapX;

      let childX = centerX - childrenTotalWidth / 2;
      const childY = y + node.height + levelGapY;

      node.children.forEach((child) => {
        const childCenterX = childX + child.subtreeWidth / 2;
        assignPositions(child, childCenterX, childY);
        childX += child.subtreeWidth + folderGapX;
      });
    }
  }

  // Start positioning from root
  const startY = 50;
  const canvasCenterX = root.subtreeWidth / 2 + 50;
  assignPositions(root, canvasCenterX, startY);

  // Build the result nodes and edges
  const allNodes: AllNodeTypes[] = [];
  const folderEdges: Edge[] = [];

  function buildNodesAndEdges(node: TreeNode, parentId: string | null) {
    // Skip root if it has no files (just a container)
    const folderId = `folder-${node.path || 'root'}`;
    const showFolder = node.files.length > 0 || node.depth === 0 || node.children.length === 0;

    if (showFolder || node.children.length > 0) {
      // Create folder node
      const folderNode: CategoryNodeType = {
        id: folderId,
        type: 'category',
        position: { x: node.x, y: node.y },
        data: {
          label: node.name === 'root' ? '/' : node.name,
          category: 'folder',
          width: node.width ,
          height: node.height,
          nodeCount: node.files.length,
          level: 'folder',
          depth: node.depth,
        },
        draggable: true,
        selectable: true,
      };
      allNodes.push(folderNode);

      // Create edge from parent to this folder
      if (parentId) {
        folderEdges.push({
          id: `edge-${parentId}-${folderId}`,
          source: parentId,
          target: folderId,
          type: 'smoothstep',
          style: { stroke: '#64748b', strokeWidth: 2 },
          animated: false,
        });
      }

      // Position files inside this folder
      node.files.forEach((fileNode, index) => {
        const row = Math.floor(index / filesPerRow);
        const col = index % filesPerRow;
        const fileX = folderPadding + col * (nodeWidth + fileGapX);
        const fileY = folderHeaderHeight + folderPadding + row * (nodeHeight + fileGapY);

        allNodes.push({
          ...fileNode,
          position: { x: fileX, y: fileY },
          parentId: folderId,
          extent: 'parent' as const,
          expandParent: true,
        });
      });
    }

    // Process children
    node.children.forEach((child) => {
      buildNodesAndEdges(child, showFolder || node.children.length > 0 ? folderId : parentId);
    });
  }

  // Build from root's children (or root if it has files)
  if (root.files.length > 0) {
    buildNodesAndEdges(root, null);
  } else {
    // Start from children, creating a virtual root connection
    root.children.forEach((child) => {
      buildNodesAndEdges(child, null);
    });
  }

  // Combine folder edges with file dependency edges (keeping original edges for files)
  const combinedEdges = [...folderEdges, ...edges];

  return { nodes: allNodes, edges: combinedEdges, categorySections: [] };
}

// Dependency Hierarchy Layout - arranges files based on import frequency
// Files with fewer importers (like app.tsx) on left, heavily imported files on right
function getDependencyHierarchyLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): LayoutResult {

  console.log("Files nodes: ", fileNodes);

  const importedByCount: Record<string, number> = {};
  const importersOf: Record<string, Set<string>> = {};

  fileNodes.forEach((node) => {
    importedByCount[node.id] = 0;
    importersOf[node.id] = new Set();
  });

  // Count direct imports
  edges.forEach((edge) => {
    // edge.source imports edge.target (source -> target means source imports target)
    if (importedByCount[edge.target] !== undefined) {
      importedByCount[edge.target]++;
      importersOf[edge.target].add(edge.source);
    }
  });

  // Calculate "dependency depth" - how deep in the dependency chain a file is
  // Files that are only imported (never import) have highest depth
  // Files that only import (never imported) have depth 0
  const dependencyDepth: Record<string, number> = {};

  // Calculate transitive dependency score
  // Higher score = more foundational (imported by more files transitively)
  function calculateDepthScore(nodeId: string, visited: Set<string> = new Set()): number {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    const directImporters = importersOf[nodeId] || new Set();
    let score = directImporters.size;

    // Add transitive importers
    directImporters.forEach(importerId => {
      score += calculateDepthScore(importerId, new Set(visited)) * 0.5;
    });

    return score;
  }

  fileNodes.forEach((node) => {
    dependencyDepth[node.id] = calculateDepthScore(node.id);
  });

  // Group nodes by their dependency depth ranges
  const maxDepth = Math.max(...Object.values(dependencyDepth), 1);
  const numColumns = Math.min(8, Math.ceil(Math.sqrt(fileNodes.length)));

  // Assign each node to a column based on its depth
  const columns: CustomNodeType[][] = Array.from({ length: numColumns }, () => []);

  fileNodes.forEach((node) => {
    const depth = dependencyDepth[node.id];
    const columnIndex = Math.min(
      numColumns - 1,
      Math.floor((depth / maxDepth) * numColumns)
    );
    columns[columnIndex].push(node);
  });

  // Sort nodes within each column by import count for consistent ordering
  columns.forEach((column) => {
    column.sort((a, b) => {
      const depthDiff = dependencyDepth[a.id] - dependencyDepth[b.id];
      if (Math.abs(depthDiff) > 0.1) return depthDiff;
      return a.data.label.localeCompare(b.data.label);
    });
  });

  // Position nodes
  const positionedNodes: CustomNodeType[] = [];
  const columnWidth = nodeWidth + 100;
  const rowHeight = nodeHeight + 30;
  const startX = 50;
  const startY = 50;

  columns.forEach((column, colIndex) => {
    const x = startX + colIndex * columnWidth;
    const columnStartY = startY;

    column.forEach((node, rowIndex) => {
      const y = columnStartY + rowIndex * rowHeight;
      positionedNodes.push({
        ...node,
        position: { x, y },
      });
    });
  });

  return { nodes: positionedNodes, edges, categorySections: [] };
}

function testLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): LayoutResult {

  console.log("Files nodes: ", fileNodes);


  const positionedNodes: CustomNodeType[] = [];
  const folderCategoryNodes: CategoryNodeType[] = [];
  let folderNodes: Map<string, CustomNodeType[]> = new Map();


  let x = 0
  let y = 0
  let rowIndex = 0
  let prevWidth = 1


  fileNodes.forEach((node, index) => {

    console.log("folder: ", node.data.folder)
    console.log("path: ", node.data.path)

    const base = node.data.path.split('/')[0]
    if (!folderNodes.has(base)){
      folderNodes.set(base, [])
    }

    if (!folderNodes.has(node.data.folder)) {
      folderNodes.set(node.data.folder, [])
    }
    folderNodes.get(node.data.folder)?.push(node)

  })

  // Sort alphabetically by folder name
  folderNodes = new Map([...folderNodes].sort((a, b) => 
    a[0].localeCompare(b[0])
  ))

  x = 0
  y = 0
  let folderX = 0
  let folderY = 0
  let baseShift = 0
  rowIndex = 0
  let folderRowIndex = 0
  prevWidth = 1
  let currentBase = ''
  let baseInit = false

  folderNodes.forEach((folder, key) => {

    if (!baseInit) {
      currentBase = key.split('/')[0]
      baseInit = true

    }
    const base = key.split('/')[0]
    console.log("KEY == ", key)
    console.log("BASE ==", base)
    if (currentBase !== base) {
      folderY = 0
      baseShift = 2000
      folderX = baseShift
      folderRowIndex = 0
      currentBase = base
      prevWidth = 1
    }

    const folderHeight = 300;
    const folderWidth = 300
    const folderGapY = 400;
    folderX = folderX + 500;


    const totalNodes = folder.length;
    const columns = 3;
    const rows = Math.ceil(totalNodes / columns);

    folderRowIndex = folderRowIndex + 1
    if (folderRowIndex - 1 == prevWidth) {
      prevWidth = prevWidth + 1
      folderRowIndex = 0
      folderY = folderY + folderGapY
      folderX = baseShift
      console.log("Reset the Row: ", folderRowIndex)
    }


    const folderCategoryNode: CategoryNodeType = {
      id: key,
      type: 'category',
      position: { x: folderX, y: folderY },
      data: {
        label: key,
        category: 'folder',
        width: folderWidth * rows,
        height: folderHeight * rows,
        nodeCount: folder.length,
        level: 'folder',
        depth: prevWidth
      },
      draggable: true,
      selectable: true,
    };
    folderCategoryNodes.push(folderCategoryNode);

    rowIndex = 1
    const columnWidth = 240;
    const rowHeight = 140;
    x = 20
    y = 50

    folder.forEach((node) => {
      if (rowIndex - 1 == 3) {
        rowIndex = 0
        x = 0
        y = y + rowHeight;
      }
      
      positionedNodes.push({
        ...node,
        position: { x: x, y: y },
        parentId: key,
        extent: 'parent' as const,
        expandParent: true,
      });

      rowIndex += 1;
      x = x + columnWidth;

    })
  })


  const allNode: AllNodeTypes[] = [
    ...folderCategoryNodes,
    ...positionedNodes,
  ]

  return { nodes: allNode, edges: edges, categorySections: [] }

}

// Inner component that uses useReactFlow
function VisualizationPageInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getViewport, fitView: reactFlowFitView } = useReactFlow();
  const { user, signOut } = useAuth();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeTypes>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNodeData | null>(null);
  const [selectedCateogry, setSelectedCategory] = useState<CategoryRoleData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ArchitecturalRole | 'all'>('all');
  const [layoutType, setLayoutType] = useState<LayoutType>('role');
  const [categorySections, setCategorySections] = useState<CategorySection[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [expanded, setExpanded] = useState<boolean>(true);
  const [styles, setStyles] = useState<stylesType>();
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);

  const handleOpenAuthModal = (tab: number) => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  // Load data from URL query parameter or session storage
  useEffect(() => {
    const analysisId = searchParams.get('analysis');

    const loadData = async () => {
      setLoading(true);

      try {
        // If analysis ID is provided in URL, fetch from API
        if (analysisId) {
          console.log('Loading analysis from API:', analysisId);
          const data = await getAnalysisResult(analysisId);
          console.log('Loaded analysis data:', data);
          setGraphData(data);
        } else {
          // Otherwise, try to load from session storage (for new analyses)
          const storedData = sessionStorage.getItem('analysisResult');

          if (storedData) {
            console.log('Loading analysis from sessionStorage');
            const data: ReactFlowGraph = JSON.parse(storedData);
            setGraphData(data);
          } else {
            console.error('No analysis ID in URL and no data in sessionStorage');
            navigate('/');
          }
        }
      } catch (error) {
        console.error('Failed to load analysis:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, searchParams]);

  // Apply layout and filters
  useEffect(() => {
    if (!graphData) return;

    // Filter nodes
    const filteredNodes = graphData.nodes.filter((node) => {
      const matchesSearch =
        searchQuery === '' ||
        node.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.data.path.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLanguage =
        languageFilter === 'all' || node.data.language === languageFilter;

      const matchesRole =
        roleFilter === 'all' || node.data.role === roleFilter;

      return matchesSearch && matchesLanguage && matchesRole;
    });

    // Get visible node IDs
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter edges to only show those between visible nodes
    const filteredEdges: Edge[] = graphData.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // Convert to CustomNodeType format
    const fileNodesForLayout: CustomNodeType[] = filteredNodes.map((n) => ({
      id: n.id,
      type: 'custom' as const,
      position: n.position,
      data: n.data,
    }));

    // Apply selected layout
    let layoutResult: LayoutResult;
    
    switch (layoutType) {
      case 'file-hierarchy':
        layoutResult = getFileHierarchyLayout(fileNodesForLayout, filteredEdges); 
        break;
      case 'dependency':
        layoutResult = testLayout(fileNodesForLayout, filteredEdges);
        setStyles({
          background: '#111a31',
        })
        break;
      case 'role':
      default:
        layoutResult = getNestedCategoryLayout(fileNodesForLayout, filteredEdges);
        setStyles({
          background: '#111a31'
        })
        break;
    }

    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
    setCategorySections(layoutResult.categorySections);
  }, [graphData, searchQuery, languageFilter, roleFilter, layoutType, setNodes, setEdges]);

  // Handle fitView - only call on initial load or when switching to non-role layouts
  useEffect(() => {
    if (nodes.length === 0) return;

    // On initial load, always fit view
    if (isInitialLoad) {
      setTimeout(() => {
        reactFlowFitView({ padding: 0.1, duration: 200 });
        setIsInitialLoad(false);
      }, 50);
      return;
    }

    // For non-role layouts, fit view to see all nodes
    if (layoutType !== 'role') {
      setTimeout(() => {
        reactFlowFitView({ padding: 0.1, duration: 200 });
      }, 50);
    }
    // For role layout, do NOT call fitView to preserve alignment with CategoryBackground
  }, [nodes, layoutType, isInitialLoad, reactFlowFitView]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'custom') {
        setSelectedCategory(null);
        setSelectedNode(node.data as ReactFlowNodeData);
      }
      if (node.type === 'category') {
        setSelectedNode(null);      
        setSelectedCategory({
          label: node.data.label,
          role: node.data.role,
          nodeCount: node.data.nodeCount,
          description: node.data.description,
        } as CategoryRoleData);
      }
    },
    []
  );

  // Handle category node selection
  // const onCategoryNodeClick = useCallback(
  //   (_: React.MouseEvent, node: Node) => {
  //     if (node.type === 'category') {
  //       setSelectedCategory(null);      
  //       setSelectedCategory({
  //         label: node.data.label,
  //         role: node.data.role,
  //         nodeCount: node.data.nodeCount,
  //         description: 
  //       });
  //     }

  // Handle node double-click to expand the panel
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'custom') {
        setExpanded(true);
      }
      // if (node.type === 'category') {
      //   setSelectedNode(null);      
      //   setSelectedCategory({
      //     label: node.data.label,
      //     role: node.data.role,
      //     nodeCount: node.data.nodeCount,
      //     description: node.data.description,
      //   } as CategoryRoleData);
      // }
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Track viewport changes for background sync
  const onMove = useCallback(() => {
    setViewport(getViewport());
  }, [getViewport]);

  // Get unique languages and roles for filters
  const availableLanguages = useMemo(() => {
    if (!graphData) return [];
    return [...new Set(graphData.nodes.map((n) => n.data.language))];
  }, [graphData]);

  const availableRoles = useMemo(() => {
    if (!graphData) return [];
    return [...new Set(graphData.nodes.map((n) => n.data.role))];
  }, [graphData]);

  // Count file nodes (excluding category nodes)
  const fileNodeCount = useMemo(() => {
    return nodes.filter(n => n.type === 'custom').length;
  }, [nodes]);

  if (loading || !graphData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading analysis...</div>
      </div>
    );
  }

  const mainSectionGap = 'gap-[100px]';
  

  return (
    <div className="min-h-screen max-h-screen w-screen bg-gray-100 flex flex-col overflow-hidden ">
      {/* Header */}
      <div className="h-14 fixed top-0 left-0 w-full bg-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Back</span>
          </button>

          <div className="h-6 w-px bg-slate-700" />

          <h1 className="text-white font-semibold">
            {getAnalysisDisplayName(graphData.metadata)}
          </h1>
        </div>

        {/* Desktop Stats and Auth */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <FileCode size={16} />
              <span>{graphData.metadata.file_count} files</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch size={16} />
              <span>{graphData.metadata.edge_count} dependencies</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{graphData.metadata.analysis_time_seconds.toFixed(1)}s</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDashboardOpen(true)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700"
              >
                My Analyses
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded">
                <User size={14} className="text-slate-400" />
                <span className="text-sm text-slate-300">{user.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={signOut}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAuthModal(0)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700"
              >
                Log In
              </button>
              <button
                onClick={() => handleOpenAuthModal(1)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Mobile Stats Only */}
        <div className="flex md:hidden items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <FileCode size={14} />
            <span>{graphData.metadata.file_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitBranch size={14} />
            <span>{graphData.metadata.edge_count}</span>
          </div>
        </div>
      </div>

      {/* Main grid layout */}
      <div className={`grid mt-14 grid-rows-1 transition-all duration-200 min-h-[calc(100vh-3.5rem)] relative overflow-hidden ${expanded
        ? 'xl:grid-cols-[5fr_minmax(400px,1fr)] grid-cols-[3fr_minmax(250px,1fr)]'
        : 'grid-cols-[1fr_38px]'
        }`}>

        {/* Main content */}
        <div className={`min-h-full overflow-y-auto flex flex-col ${mainSectionGap} items-center [scrollbar-width:10]`}>

          {/* Hero Section */}
          <div className='max-w-[900px] h-[500px] w-full py-12 px-8 '>
            <div className='rounded-2xl h-full p-8  backdrop-blur-sm bg-none'>
              <div className='flex flex-col items-start gap-6 h-full'>
                <div className='flex w-full items-center justify-center relative h-16'>
                  {/* <div className='p-4 absolute left-0 top-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg'>
                    <FileCode size={32} className='text-white' />
                  </div> */}
                  <h2 className='text-2xl text-red-500 text-center '>OVERVIEW</h2>
                </div>
                <div className='flex-1 w-full items-center justify-between flex flex-col gap-5'>
                  <h2 className='text-7xl font-semibold text-black mb-3 tracking-tight'>
                      {getAnalysisDisplayName(graphData.metadata)}

                  </h2>
                  <p className='text-slate-400 text-lg w-3/4 leading-relaxed mb-6'>
                    A comprehensive visualization of your codebase architecture. Explore {graphData.metadata.file_count} files
                    with {graphData.metadata.edge_count} dependencies across your project structure.
                  </p>
                  <div className='flex flex-wrap gap-3'>
                    <div className='flex items-center gap-2 bg-slate-700/50 px-4 py-2 rounded-full'>
                      <FileCode size={16} className='text-indigo-400' />
                      <span className='text-slate-300 text-sm font-medium'>{graphData.metadata.file_count} Files</span>
                    </div>
                    <div className='flex items-center gap-2 bg-slate-700/50 px-4 py-2 rounded-full'>
                      <GitBranch size={16} className='text-emerald-400' />
                      <span className='text-slate-300 text-sm font-medium'>{graphData.metadata.edge_count} Dependencies</span>
                    </div>
                    <div className='flex items-center gap-2 bg-slate-700/50 px-4 py-2 rounded-full'>
                      <Clock size={16} className='text-amber-400' />
                      <span className='text-slate-300 text-sm font-medium'>Analyzed in {graphData.metadata.analysis_time_seconds.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* React Flow Container */}
          <div className='w-full px-8 pb-12 justify-center flex flex-col gap-10 items-center'>
            <div className='flex w-full items-center justify-center relative h-16'>
              {/* <div className='p-4 absolute left-0 top-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg'>
                    <FileCode size={32} className='text-white' />
                  </div> */}
              <h2 className='text-2xl text-red-500 text-center '>VISUALIZATION</h2>
            </div>
            <div className='h-[900px] max-w-[1200px] w-full rounded-2xl overflow-hidden border border-4 border-neutral-700 outline outline-2 outline-neutral-500 shadow-2xl shadow-black bg-slate-300 relative'>

              {/* Static category background - only show for role layout */}
              {layoutType === 'role' && (
                <CategoryBackground
                  sections={categorySections}
                  transform={viewport}
                />
              )}

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                onMove={onMove}
                nodeTypes={nodeTypes}
                style={styles}
                minZoom={0.1}
                maxZoom={2}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                  animated: false,
                  style: { stroke: '#475569', strokeWidth: 1.5 },
                }}
              >
                <Controls />
                <MiniMap
                  nodeColor={(node) => {
                    if (node.type === 'category') {
                      const catData = node.data as CategoryNodeData | undefined;
                      return catData?.category === 'frontend'
                        ? categoryColors.frontend
                        : categoryColors.backend;
                    }
                    const data = node.data as ReactFlowNodeData | undefined;
                    return data?.role ? roleColors[data.role] : '#6b7280';
                  }}
                  maskColor="rgba(15, 23, 42, 0.8)"
                  className="!bg-slate-800 !border-slate-700"
                />

                {/* Filters Panel */}
                <Panel position="top-left" className="!m-4">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-3 w-52">
                    {/* Layout Selector */}
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                        Layout
                      </label>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setLayoutType('role')}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${layoutType === 'role'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          <LayoutGrid size={12} />
                          Role
                        </button>
                        <button
                          onClick={() => setLayoutType('file-hierarchy')}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${layoutType === 'file-hierarchy'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          <FolderTree size={12} />
                          Files
                        </button>
                        <button
                          onClick={() => setLayoutType('dependency')}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${layoutType === 'dependency'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          <Network size={12} />
                          Deps
                        </button>
                      </div>
                    </div>
                    {/* Search */}
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                      />
                      <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    {/* Language Filter */}
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                        Language
                      </label>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setLanguageFilter('all')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${languageFilter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          All
                        </button>
                        {availableLanguages.map((lang) => (
                          <button
                            key={lang}
                            onClick={() => setLanguageFilter(lang)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${languageFilter === lang
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:text-white'
                              }`}
                            style={{
                              borderLeft: `2px solid ${languageColors[lang]}`,
                            }}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Role Filter */}
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                        Role
                      </label>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        <button
                          onClick={() => setRoleFilter('all')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${roleFilter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          All
                        </button>
                        {availableRoles.map((role) => (
                          <button
                            key={role}
                            onClick={() => setRoleFilter(role)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${roleFilter === role
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:text-white'
                              }`}
                            style={{
                              borderLeft: `2px solid ${roleColors[role]}`,
                            }}
                          >
                            {role.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-700">
                      Showing {fileNodeCount} of {graphData.nodes.length} files
                    </div>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          </div>
          <div className="h-[900px] min-h-[800px] w-[80%] bg-none py-10 ">
            <GithubEmbed
              owner="facebook"
              repo="react"
              initialPath="packages" />

          </div>

        </div>

        {/* Right Panel / NodeDetailPanel */}
        <div className="h-full bg-slate-900  overflow-hidden border-l border-slate-800 ">
          {selectedNode && (
          <NodeDetailPanel data={selectedNode} onClose={() => setSelectedNode(null)} setExpand={setExpanded} expanded={expanded} />
          )}
          {selectedCateogry && (
            <CategoryRolePanel data={selectedCateogry} onClose={() => setSelectedCategory(null)} setExpand={setExpanded} expanded={expanded} />
          )}
          {!selectedNode && !selectedCateogry && (
                      <NodeDetailPanel data={null} onClose={() => setSelectedNode(null)} setExpand={setExpanded} expanded={expanded} />
                   ) }
        </div>

      </div>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
      />

      {/* User Dashboard Modal */}
      <UserDashboardModal
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />
    </div>
  );
}

// Helper function to get display name for the analysis
function getAnalysisDisplayName(metadata: AnalysisMetadata): string {
  if (metadata.github_repo) {
    // For GitHub repos, show "owner/repo" or just "repo" if path is specified
    const { owner, repo, path } = metadata.github_repo;
    if (path) {
      return `${owner}/${repo}/${path}`;
    }
    return `${owner}/${repo}`;
  }

  if (metadata.directory_path) {
    // For local directories, show the last part of the path
    return metadata.directory_path.split('/').pop() || metadata.directory_path;
  }

  // Fallback
  return 'Unknown Project';
}

// Wrap with ReactFlowProvider to enable useReactFlow hook
export default function VisualizationPage() {
  return (
    <ReactFlowProvider>
      <VisualizationPageInner />
    </ReactFlowProvider>
  );
}