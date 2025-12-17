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
import { roleColors, languageColors, categoryColors } from '../types';

// Define node types with proper typing for React Flow v12
const nodeTypes: NodeTypes = {
  custom: CustomNode,
  category: CategoryNode,
};

// Combined node type for all nodes in the graph
type AllNodeTypes = CustomNodeType | CategoryNodeType;

const nodeWidth = 220;
const nodeHeight = 100;
const nodeGapX = 30;
const nodeGapY = 20;
const categoryPadding = 40;
const categoryHeaderHeight = 60;

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

// Custom layout that creates category parent nodes and positions children inside
function getCategorizedLayout(
  fileNodes: CustomNodeType[],
  edges: Edge[],
  containerWidth: number = 1400
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

  // Separate nodes into frontend and backend
  const frontendFileNodes: CustomNodeType[] = [];
  const backendFileNodes: CustomNodeType[] = [];

  fileNodes.forEach((node) => {
    const group = categorizeNode(node.data.category);
    if (group === 'frontend') {
      frontendFileNodes.push(node);
    } else {
      backendFileNodes.push(node);
    }
  });

  // Sort each group by dependency count (descending)
  const sortByDeps = (a: CustomNodeType, b: CustomNodeType) =>
    dependencyCount[b.id] - dependencyCount[a.id];

  frontendFileNodes.sort(sortByDeps);
  backendFileNodes.sort(sortByDeps);

  // Calculate dimensions for each category
  const halfWidth = (containerWidth - categoryPadding * 3) / 2;
  const nodesPerRow = Math.max(1, Math.floor((halfWidth - categoryPadding * 2) / (nodeWidth + nodeGapX)));

  const calculateCategoryDimensions = (nodeCount: number) => {
    const rows = Math.ceil(nodeCount / nodesPerRow);
    const width = Math.min(nodeCount, nodesPerRow) * (nodeWidth + nodeGapX) + categoryPadding * 2;
    const height = categoryHeaderHeight + rows * (nodeHeight + nodeGapY) + categoryPadding;
    return { width: Math.max(width, 300), height: Math.max(height, 200) };
  };

  const frontendDims = calculateCategoryDimensions(frontendFileNodes.length);
  const backendDims = calculateCategoryDimensions(backendFileNodes.length);

  // Create category parent nodes
  const frontendCategoryNode: CategoryNodeType = {
    id: 'category-frontend',
    type: 'category',
    position: { x: 0, y: 0 },
    data: {
      label: 'Frontend',
      category: 'frontend',
      width: frontendDims.width,
      height: frontendDims.height,
      nodeCount: frontendFileNodes.length,
    },
    draggable: true,
    selectable: true,
  };

  const backendCategoryNode: CategoryNodeType = {
    id: 'category-backend',
    type: 'category',
    position: { x: frontendDims.width + categoryPadding * 2, y: 0 },
    data: {
      label: 'Backend',
      category: 'backend',
      width: backendDims.width,
      height: backendDims.height,
      nodeCount: backendFileNodes.length,
    },
    draggable: true,
    selectable: true,
  };

  // Position file nodes inside their parent categories
  const positionNodesInCategory = (
    categoryNodes: CustomNodeType[],
    parentId: string
  ): CustomNodeType[] => {
    return categoryNodes.map((node, index): CustomNodeType => {
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;
      return {
        ...node,
        position: {
          x: categoryPadding + col * (nodeWidth + nodeGapX),
          y: categoryHeaderHeight + row * (nodeHeight + nodeGapY),
        },
        parentId,
        extent: 'parent' as const,
        expandParent: true,
      };
    });
  };

  const positionedFrontendNodes = positionNodesInCategory(frontendFileNodes, 'category-frontend');
  const positionedBackendNodes = positionNodesInCategory(backendFileNodes, 'category-backend');

  // Combine all nodes: category nodes first (so they render behind), then file nodes
  const allNodes: AllNodeTypes[] = [
    frontendCategoryNode,
    backendCategoryNode,
    ...positionedFrontendNodes,
    ...positionedBackendNodes,
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

    // Apply categorized layout with parent nodes
    const { nodes: layoutedNodes, edges: layoutedEdges } = getCategorizedLayout(
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
