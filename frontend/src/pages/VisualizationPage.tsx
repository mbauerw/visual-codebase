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
  ReactFlowProvider,
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
import Magnifier from '../components/Magnifier';
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
const nodeGapX = 20;
const nodeGapY = 15;
const rolePadding = 25;
const roleHeaderHeight = 45;
const topCategoryPadding = 50;
const topCategoryHeaderHeight = 60;
const roleGapX = 30;
const roleGapY = 30;

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

// Custom layout that creates nested category hierarchy:
// Frontend/Backend -> Role Categories -> File Nodes
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
  type CategoryGroup = { category: 'frontend' | 'backend'; roleGroups: RoleGroup[] };

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

  // Calculate dimensions for a role category based on its nodes
  const nodesPerRowInRole = 2; // Keep role categories compact

  const calculateRoleDimensions = (nodeCount: number) => {
    const rows = Math.ceil(nodeCount / nodesPerRowInRole);
    const cols = Math.min(nodeCount, nodesPerRowInRole);
    const width = cols * (nodeWidth + nodeGapX) + rolePadding * 2;
    const height = roleHeaderHeight + rows * (nodeHeight + nodeGapY) + rolePadding;
    return { width: Math.max(width, 250), height: Math.max(height, 150) };
  };

  // Layout role categories within a top-level category
  // Returns: positioned role category nodes, positioned file nodes, and total dimensions
  const layoutRoleCategories = (
    roleGroups: RoleGroup[],
    topCategoryId: string,
    topCategory: 'frontend' | 'backend'
  ): {
    roleCategoryNodes: CategoryNodeType[];
    fileNodes: CustomNodeType[];
    totalWidth: number;
    totalHeight: number;
  } => {
    const roleCategoryNodes: CategoryNodeType[] = [];
    const positionedFileNodes: CustomNodeType[] = [];

    let currentX = topCategoryPadding;
    let currentY = topCategoryHeaderHeight;
    let rowHeight = 0;
    let maxWidth = 0;
    let totalHeight = topCategoryHeaderHeight;
    const maxRowWidth = 900; // Max width before wrapping to next row

    roleGroups.forEach((roleGroup) => {
      const dims = calculateRoleDimensions(roleGroup.nodes.length);

      // Check if we need to wrap to the next row
      if (currentX + dims.width > maxRowWidth && currentX > topCategoryPadding) {
        currentX = topCategoryPadding;
        currentY += rowHeight + roleGapY;
        rowHeight = 0;
      }

      const roleCategoryId = `${topCategoryId}-${roleGroup.role}`;

      // Create role category node
      const roleCategoryNode: CategoryNodeType = {
        id: roleCategoryId,
        type: 'category',
        position: { x: currentX, y: currentY },
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

      // Position file nodes within this role category
      roleGroup.nodes.forEach((node, index) => {
        const row = Math.floor(index / nodesPerRowInRole);
        const col = index % nodesPerRowInRole;

        positionedFileNodes.push({
          ...node,
          position: {
            x: rolePadding + col * (nodeWidth + nodeGapX),
            y: roleHeaderHeight + row * (nodeHeight + nodeGapY),
          },
          parentId: roleCategoryId,
          extent: 'parent' as const,
          expandParent: true,
        });
      });

      // Update positioning for next role category
      currentX += dims.width + roleGapX;
      rowHeight = Math.max(rowHeight, dims.height);
      maxWidth = Math.max(maxWidth, currentX);
      totalHeight = Math.max(totalHeight, currentY + dims.height + topCategoryPadding);
    });

    return {
      roleCategoryNodes,
      fileNodes: positionedFileNodes,
      totalWidth: maxWidth + topCategoryPadding,
      totalHeight,
    };
  };

  // Layout frontend categories
  const frontendLayout = layoutRoleCategories(frontendRoleGroups, 'category-frontend', 'frontend');

  // Layout backend categories
  const backendLayout = layoutRoleCategories(backendRoleGroups, 'category-backend', 'backend');

  // Calculate total node counts
  const frontendNodeCount = frontendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);
  const backendNodeCount = backendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);

  // Create top-level category nodes
  const frontendCategoryNode: CategoryNodeType = {
    id: 'category-frontend',
    type: 'category',
    position: { x: 0, y: 0 },
    data: {
      label: 'Frontend',
      category: 'frontend',
      width: Math.max(frontendLayout.totalWidth, 400),
      height: Math.max(frontendLayout.totalHeight, 300),
      nodeCount: frontendNodeCount,
      level: 'top',
    },
    draggable: true,
    selectable: true,
  };

  const backendCategoryNode: CategoryNodeType = {
    id: 'category-backend',
    type: 'category',
    position: { x: Math.max(frontendLayout.totalWidth, 400) + 80, y: 0 },
    data: {
      label: 'Backend',
      category: 'backend',
      width: Math.max(backendLayout.totalWidth, 400),
      height: Math.max(backendLayout.totalHeight, 300),
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

function VisualizationContent() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeTypes>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNodeData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ArchitecturalRole | 'all'>('all');
  const [magnifierEnabled, setMagnifierEnabled] = useState(true);

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

    // Apply nested category layout (Frontend/Backend -> Role -> Files)
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

          {/* Magnifier component */}
          <Magnifier enabled={magnifierEnabled} size={160} zoom={2} />

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

              {/* Magnifier Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500 uppercase tracking-wide">
                  Magnifier
                </label>
                <button
                  onClick={() => setMagnifierEnabled(!magnifierEnabled)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    magnifierEnabled
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {magnifierEnabled ? 'ON' : 'OFF'}
                </button>
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

// Wrap with ReactFlowProvider for the Magnifier to work
export default function VisualizationPage() {
  return (
    <ReactFlowProvider>
      <VisualizationContent />
    </ReactFlowProvider>
  );
}
