import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';

import CustomNode, { type CustomNodeType } from '../components/CustomNode';
import CategoryNode, { type CategoryNodeType, type CategoryNodeData } from '../components/CategoryNode';
import CategoryBackground, { type CategorySection } from '../components/Categorybackground'
import NodeDetailPanel from '../components/NodeDetailPanel';
import type {
  ReactFlowGraph,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
  Category,
  LayoutType,
} from '../types';
import { roleColors, languageColors, categoryColors, roleLabels } from '../types';
import GithubEmbed from '../components/GithubEmbed';

// Define node types with proper typing for React Flow v12
const nodeTypes: NodeTypes = {
  custom: CustomNode,
  category: CategoryNode,
};

// Combined node type for all nodes in the graph
type AllNodeTypes = CustomNodeType | CategoryNodeType;

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

  const width = maxCols * (nodeWidth + nodeGapX) + rolePadding * 2 + 50;
  const height = roleHeaderHeight + rows * (nodeHeight + nodeGapY) + rolePadding + 100;

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

    // Calculate the circle radius needed
    const numRoles = roleGroups.length;
    const roleSpacing = 10;

    let circleRadius: number;
    if (numRoles <= 1) {
      circleRadius = Math.max(maxRoleWidth, maxRoleHeight) / 2 + 100;
    } else if (numRoles <= 4) {
      circleRadius = (maxRoleWidth + roleSpacing) + 100;
    } else if (numRoles <= 8) {
      circleRadius = (numRoles * (maxRoleWidth + roleSpacing)) / (2 * Math.PI) + maxRoleHeight;
    } else {
      circleRadius = (numRoles * (maxRoleWidth + roleSpacing)) / (2 * Math.PI) + maxRoleHeight;
    }

    circleRadius = Math.max(circleRadius, 400);

    // Calculate center position (with offset for this category section)
    const centerX = offsetX + circleRadius;
    const centerY = circleRadius; // Add some top padding
    const placementRadius = circleRadius - maxRoleHeight / 2 - 100;

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
  const frontendWidth = frontendLayout.circleRadius + 100;
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

// File Hierarchy Layout - arranges files in a tree structure based on file paths
// Folders on the left, deeper files expand to the right
function getFileHierarchyLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): LayoutResult {
  // Build a tree structure from file paths
  interface TreeNode {
    name: string;
    path: string;
    children: Map<string, TreeNode>;
    fileNode?: CustomNodeType;
  }

  const root: TreeNode = { name: '', path: '', children: new Map() };

  // Insert each file into the tree
  fileNodes.forEach((node) => {
    const pathParts = node.data.path.split('/').filter(Boolean);
    let current = root;

    pathParts.forEach((part: string, index: number) => {
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: pathParts.slice(0, index + 1).join('/'),
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    });

    // Attach the file node to the leaf
    current.fileNode = node;
  });

  // Calculate positions for each depth level
  const positionedNodes: CustomNodeType[] = [];
  const levelWidth = nodeWidth + 80;
  const verticalGap = nodeHeight + 20;

  let currentY = 50;

  // Traverse the tree and assign positions
  function traverse(treeNode: TreeNode, depth: number): number {
    const x = 50 + depth * levelWidth;
    let startY = currentY;
    let childrenEndY = startY;

    // First, process all children to get their total height
    const sortedChildren = Array.from(treeNode.children.values()).sort((a, b) => {
      // Folders (nodes with children but no fileNode) come first
      const aIsFolder = a.children.size > 0 && !a.fileNode;
      const bIsFolder = b.children.size > 0 && !b.fileNode;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    sortedChildren.forEach((child) => {
      childrenEndY = traverse(child, depth + 1);
    });

    // If this node has a file, position it
    if (treeNode.fileNode) {
      const y = sortedChildren.length > 0
        ? (startY + childrenEndY) / 2 - nodeHeight / 2
        : currentY;

      positionedNodes.push({
        ...treeNode.fileNode,
        position: { x, y },
      });

      if (sortedChildren.length === 0) {
        currentY += verticalGap;
      }

      return Math.max(childrenEndY, y + nodeHeight);
    }

    return childrenEndY;
  }

  // Start traversal from root children
  const sortedRootChildren = Array.from(root.children.values()).sort((a, b) => {
    const aIsFolder = a.children.size > 0 && !a.fileNode;
    const bIsFolder = b.children.size > 0 && !b.fileNode;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  sortedRootChildren.forEach((child) => {
    traverse(child, 0);
  });

  return { nodes: positionedNodes, edges, categorySections: [] };
}

// Dependency Hierarchy Layout - arranges files based on import frequency
// Files with fewer importers (like app.tsx) on left, heavily imported files on right
function getDependencyHierarchyLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): LayoutResult {
  // Build a graph of import relationships
  // Count how many times each file is imported (incoming edges)
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

// Inner component that uses useReactFlow
function VisualizationPageInner() {
  const navigate = useNavigate();
  const { getViewport } = useReactFlow();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeTypes>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNodeData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ArchitecturalRole | 'all'>('all');
  const [layoutType, setLayoutType] = useState<LayoutType>('role');
  const [categorySections, setCategorySections] = useState<CategorySection[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [expanded, setExpanded] = useState<boolean>(true);

  // Load data from session storage
  useEffect(() => {
    const storedData = sessionStorage.getItem('analysisResult');
    if (storedData) {
      try {
        const data: ReactFlowGraph = JSON.parse(storedData);
        setGraphData(data);
      } catch (e) {
        console.error('Failed to parse analysis result:', e);
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [navigate]);

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
        layoutResult = getDependencyHierarchyLayout(fileNodesForLayout, filteredEdges);
        break;
      case 'role':
      default:
        layoutResult = getNestedCategoryLayout(fileNodesForLayout, filteredEdges);
        break;
    }

    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
    setCategorySections(layoutResult.categorySections);
  }, [graphData, searchQuery, languageFilter, roleFilter, layoutType, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'custom') {
        setSelectedNode(node.data as ReactFlowNodeData);
      }
    },
    []
  );

  // Handle node double-click to expand the panel
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'custom') {
        setExpanded(true);
      }
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

  if (!graphData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
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
            {graphData.metadata.directory_path.split('/').pop()}
          </h1>
        </div>

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
                    {graphData.metadata.directory_path.split('/').pop()}
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
                fitView
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
          <NodeDetailPanel data={selectedNode} onClose={() => setSelectedNode(null)} setExpand={setExpanded} expanded={expanded} />
        </div>

      </div>
    </div>
  );
}

// Wrap with ReactFlowProvider to enable useReactFlow hook
export default function VisualizationPage() {
  return (
    <ReactFlowProvider>
      <VisualizationPageInner />
    </ReactFlowProvider>
  );
}