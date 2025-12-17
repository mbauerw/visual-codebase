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
  Monitor,
  Server,
} from 'lucide-react';

import CustomNode, { type CustomNodeType } from '../components/CustomNode';
import NodeDetailPanel from '../components/NodeDetailPanel';
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
};

const nodeWidth = 220;
const nodeHeight = 120;
const nodeGapX = 40;
const nodeGapY = 30;
const categoryPadding = 60;
const categoryHeaderHeight = 50;

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
      // Shared/test/config/unknown go to frontend by default, or could be split
      return 'frontend';
  }
}

// Custom layout that groups nodes by Frontend/Backend with dependency-based ordering
function getCategorizedLayout(
  nodes: CustomNodeType[],
  edges: Edge[],
  containerWidth: number = 1600
): { nodes: CustomNodeType[]; edges: Edge[]; categoryBounds: { frontend: { x: number; y: number; width: number; height: number }; backend: { x: number; y: number; width: number; height: number } } } {
  // Count dependencies for each node (incoming + outgoing)
  const dependencyCount: Record<string, number> = {};
  nodes.forEach((node) => {
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
  const frontendNodes: CustomNodeType[] = [];
  const backendNodes: CustomNodeType[] = [];

  nodes.forEach((node) => {
    const group = categorizeNode(node.data.category);
    if (group === 'frontend') {
      frontendNodes.push(node);
    } else {
      backendNodes.push(node);
    }
  });

  // Sort each group by dependency count (descending - more deps at top)
  const sortByDeps = (a: CustomNodeType, b: CustomNodeType) =>
    dependencyCount[b.id] - dependencyCount[a.id];

  frontendNodes.sort(sortByDeps);
  backendNodes.sort(sortByDeps);

  // Calculate layout dimensions
  const halfWidth = (containerWidth - categoryPadding * 3) / 2;
  const nodesPerRow = Math.max(1, Math.floor(halfWidth / (nodeWidth + nodeGapX)));

  // Position frontend nodes (left side)
  const positionNodesInCategory = (
    categoryNodes: CustomNodeType[],
    startX: number
  ): { nodes: CustomNodeType[]; height: number } => {
    const positioned = categoryNodes.map((node, index): CustomNodeType => {
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;
      return {
        ...node,
        position: {
          x: startX + col * (nodeWidth + nodeGapX),
          y: categoryHeaderHeight + row * (nodeHeight + nodeGapY),
        },
      };
    });
    const rows = Math.ceil(categoryNodes.length / nodesPerRow);
    const height = categoryHeaderHeight + rows * (nodeHeight + nodeGapY);
    return { nodes: positioned, height };
  };

  const frontendResult = positionNodesInCategory(frontendNodes, categoryPadding);
  const backendResult = positionNodesInCategory(backendNodes, categoryPadding + halfWidth + categoryPadding);

  const maxHeight = Math.max(frontendResult.height, backendResult.height, 400);

  const categoryBounds = {
    frontend: {
      x: categoryPadding / 2,
      y: 0,
      width: halfWidth + categoryPadding,
      height: maxHeight,
    },
    backend: {
      x: categoryPadding + halfWidth + categoryPadding / 2,
      y: 0,
      width: halfWidth + categoryPadding,
      height: maxHeight,
    },
  };

  return {
    nodes: [...frontendResult.nodes, ...backendResult.nodes],
    edges,
    categoryBounds,
  };
}

// Category bounds type
interface CategoryBounds {
  frontend: { x: number; y: number; width: number; height: number };
  backend: { x: number; y: number; width: number; height: number };
}

export default function VisualizationPage() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNodeData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ArchitecturalRole | 'all'>('all');
  const [categoryBounds, setCategoryBounds] = useState<CategoryBounds | null>(null);

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
    const nodesForLayout: CustomNodeType[] = filteredNodes.map((n) => ({
      id: n.id,
      type: 'custom' as const,
      position: n.position,
      data: n.data,
    }));

    // Apply categorized layout (Frontend | Backend)
    const { nodes: layoutedNodes, edges: layoutedEdges, categoryBounds: bounds } = getCategorizedLayout(
      nodesForLayout,
      filteredEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setCategoryBounds(bounds);
  }, [graphData, searchQuery, languageFilter, roleFilter, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: CustomNodeType) => {
      setSelectedNode(node.data);
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

          {/* Category Container Overlays */}
          {categoryBounds && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              {/* Frontend Container */}
              <g transform={`translate(${categoryBounds.frontend.x}, ${categoryBounds.frontend.y})`}>
                <rect
                  width={categoryBounds.frontend.width}
                  height={categoryBounds.frontend.height}
                  fill="rgba(97, 218, 251, 0.03)"
                  stroke={categoryColors.frontend}
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  rx={12}
                />
                <rect
                  x={0}
                  y={0}
                  width={140}
                  height={36}
                  fill="#0f172a"
                  rx={8}
                />
                <foreignObject x={8} y={6} width={130} height={28}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Monitor size={16} color={categoryColors.frontend} />
                    <span style={{ color: categoryColors.frontend, fontWeight: 600, fontSize: '14px' }}>
                      Frontend
                    </span>
                  </div>
                </foreignObject>
              </g>

              {/* Backend Container */}
              <g transform={`translate(${categoryBounds.backend.x}, ${categoryBounds.backend.y})`}>
                <rect
                  width={categoryBounds.backend.width}
                  height={categoryBounds.backend.height}
                  fill="rgba(16, 185, 129, 0.03)"
                  stroke={categoryColors.backend}
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  rx={12}
                />
                <rect
                  x={0}
                  y={0}
                  width={130}
                  height={36}
                  fill="#0f172a"
                  rx={8}
                />
                <foreignObject x={8} y={6} width={120} height={28}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={16} color={categoryColors.backend} />
                    <span style={{ color: categoryColors.backend, fontWeight: 600, fontSize: '14px' }}>
                      Backend
                    </span>
                  </div>
                </foreignObject>
              </g>
            </svg>
          )}

          <Controls className="!bg-slate-800 !border-slate-700" />
          <MiniMap
            nodeColor={(node) => {
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
                Showing {nodes.length} of {graphData.nodes.length} files
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