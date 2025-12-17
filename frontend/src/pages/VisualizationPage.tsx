import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Search,
  FileCode,
  GitBranch,
  Clock,
} from 'lucide-react';

import CustomNode, { type CustomNodeType } from '../components/CustomNode';
import CategoryNode, { type CategoryNodeType, type CategoryNodeData } from '../components/CategoryNode';
import NodeDetailPanel from '../components/NodeDetailPanel';
import type {
  ReactFlowGraph,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
  Category,
} from '../types';
import { roleColors, languageColors, categoryColors, roleLabels } from '../types';

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
const topCategoryPadding = 80;  // Padding inside top-level categories
const topCategoryHeaderHeight = 70;  // Space for top-level header
const roleGapX = 50;  // Horizontal gap between role containers
const roleGapY = 50;  // Vertical gap between role containers

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
// Returns array of {row, col, totalInRow} for each node index
function getTreePositions(nodeCount: number): { row: number; col: number; totalInRow: number }[] {
  const positions: { row: number; col: number; totalInRow: number }[] = [];
  let remaining = nodeCount;
  let row = 0;
  let index = 0;

  while (remaining > 0) {
    const nodesInRow = row + 1; // Row 0 has 1 node, row 1 has 2, etc.
    const actualInRow = Math.min(nodesInRow, remaining);

    for (let col = 0; col < actualInRow; col++) {
      positions.push({ row, col, totalInRow: actualInRow });
      index++;
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

  // Calculate number of rows needed for tree layout
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

  const width = maxCols * (nodeWidth + nodeGapX) + rolePadding * 2;
  const height = roleHeaderHeight + rows * (nodeHeight + nodeGapY) + rolePadding;

  return {
    width: Math.max(width, 300),
    height: Math.max(height, 180),
    rows,
    maxCols,
  };
}

// Custom layout that creates nested category hierarchy:
// Frontend/Backend -> Role Categories -> File Nodes (in tree pattern)
function getNestedCategoryLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[]
): { nodes: AllNodeTypes[]; edges: Edge[] } {
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

  // Sort role groups by total dependency count (sum of all nodes in the role)
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

  // Layout role categories in a circular pattern within a top-level category
  const layoutRoleCategoriesInCircle = (
    roleGroups: RoleGroup[],
    topCategoryId: string,
    topCategory: 'frontend' | 'backend'
  ): {
    roleCategoryNodes: CategoryNodeType[];
    fileNodes: CustomNodeType[];
    circleRadius: number;
  } => {
    const roleCategoryNodes: CategoryNodeType[] = [];
    const positionedFileNodes: CustomNodeType[] = [];

    if (roleGroups.length === 0) {
      return { roleCategoryNodes, fileNodes: positionedFileNodes, circleRadius: 300 };
    }

    // Calculate dimensions for all role categories first
    const roleDimensions = roleGroups.map((rg) => calculateTreeRoleDimensions(rg.nodes.length));
    const maxRoleWidth = Math.max(...roleDimensions.map((d) => d.width));
    const maxRoleHeight = Math.max(...roleDimensions.map((d) => d.height));

    // Calculate the circle radius needed to fit all role containers
    // Use a larger radius for more containers
    const numRoles = roleGroups.length;
    const roleSpacing = 80; // Space between role containers

    // Calculate radius based on number of roles - arrange in concentric rings if many
    let circleRadius: number;
    if (numRoles <= 1) {
      circleRadius = Math.max(maxRoleWidth, maxRoleHeight) / 2 + 150;
    } else if (numRoles <= 4) {
      // Small number - arrange in a tight circle
      circleRadius = (maxRoleWidth + roleSpacing) * 1.2;
    } else if (numRoles <= 8) {
      // Medium number - larger circle
      circleRadius = (numRoles * (maxRoleWidth + roleSpacing)) / (2 * Math.PI) + maxRoleHeight;
    } else {
      // Many roles - use multiple rings or grid-like arrangement
      circleRadius = (numRoles * (maxRoleWidth + roleSpacing)) / (2 * Math.PI) + maxRoleHeight;
    }

    // Ensure minimum size
    circleRadius = Math.max(circleRadius, 400);

    // Position role containers in a circular pattern
    const centerX = circleRadius;
    const centerY = circleRadius;
    const placementRadius = circleRadius - maxRoleHeight / 2 - 100; // Inset from edge

    roleGroups.forEach((roleGroup, index) => {
      const dims = roleDimensions[index];
      const roleCategoryId = `${topCategoryId}-${roleGroup.role}`;

      // Calculate position on the circle
      let x: number, y: number;

      if (numRoles === 1) {
        // Single role - center it
        x = centerX - dims.width / 2;
        y = centerY - dims.height / 2;
      } else {
        // Multiple roles - arrange in circle, starting from top
        const angle = (index / numRoles) * 2 * Math.PI - Math.PI / 2; // Start from top
        x = centerX + Math.cos(angle) * placementRadius - dims.width / 2;
        y = centerY + Math.sin(angle) * placementRadius - dims.height / 2;
      }

      // Create role category node
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
        parentId: topCategoryId,
        extent: 'parent' as const,
        draggable: true,
        selectable: true,
        expandParent: true,
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
      circleRadius: circleRadius * 2, // Diameter
    };
  };

  // Layout frontend categories
  const frontendLayout = layoutRoleCategoriesInCircle(frontendRoleGroups, 'category-frontend', 'frontend');

  // Layout backend categories
  const backendLayout = layoutRoleCategoriesInCircle(backendRoleGroups, 'category-backend', 'backend');

  // Calculate total node counts
  const frontendNodeCount = frontendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);
  const backendNodeCount = backendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);

  // Create top-level category nodes (circular - width equals height)
  const frontendSize = Math.max(frontendLayout.circleRadius, 600);
  const backendSize = Math.max(backendLayout.circleRadius, 600);

  const frontendCategoryNode: CategoryNodeType = {
    id: 'category-frontend',
    type: 'category',
    position: { x: 0, y: 0 },
    data: {
      label: 'Frontend',
      category: 'frontend',
      width: frontendSize,
      height: frontendSize,
      nodeCount: frontendNodeCount,
      level: 'top',
    },
    draggable: true,
    selectable: true,
  };

  const backendCategoryNode: CategoryNodeType = {
    id: 'category-backend',
    type: 'category',
    position: { x: frontendSize + 100, y: 0 },
    data: {
      label: 'Backend',
      category: 'backend',
      width: backendSize,
      height: backendSize,
      nodeCount: backendNodeCount,
      level: 'top',
    },
    draggable: true,
    selectable: true,
  };

  // Combine all nodes in the correct order:
  // 1. Top-level categories (render first, behind everything)
  // 2. Role categories (render second, behind file nodes)
  // 3. File nodes (render last, on top)
  const allNodes: AllNodeTypes[] = [
    frontendCategoryNode,
    backendCategoryNode,
    ...frontendLayout.roleCategoryNodes,
    ...backendLayout.roleCategoryNodes,
    ...frontendLayout.fileNodes,
    ...backendLayout.fileNodes,
  ];

  return { nodes: allNodes, edges };
}

export default function VisualizationPage() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeTypes>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNodeData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ArchitecturalRole | 'all'>('all');

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

    // Apply nested category layout (Frontend/Backend -> Role -> Files in tree pattern)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getNestedCategoryLayout(
      fileNodesForLayout,
      filteredEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [graphData, searchQuery, languageFilter, roleFilter, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Only select file nodes, not category nodes
      if (node.type === 'custom') {
        setSelectedNode(node.data as ReactFlowNodeData);
      }
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

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

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
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

      {/* Main content */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
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
          <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} />
          <Controls className="!bg-slate-800 !border-slate-700" />
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
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-3 w-64">
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
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      languageFilter === 'all'
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
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        languageFilter === lang
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
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      roleFilter === 'all'
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
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        roleFilter === role
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

        {/* Node Detail Panel */}
        <NodeDetailPanel data={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}
