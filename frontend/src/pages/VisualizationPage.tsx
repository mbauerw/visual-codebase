import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  ArrowLeft,
  Search,
  Filter,
  LayoutGrid,
  FileCode,
  GitBranch,
  Clock,
} from 'lucide-react';

import CustomNode from '../components/CustomNode';
import NodeDetailPanel from '../components/NodeDetailPanel';
import type {
  ReactFlowGraph,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
} from '../types';
import { roleColors, languageColors } from '../types';

const nodeTypes = {
  custom: CustomNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 80;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
    };
  });

  return { nodes: layoutedNodes as Node[], edges };
}

export default function VisualizationPage() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
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
    let filteredNodes = graphData.nodes.filter((node) => {
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
    const filteredEdges = graphData.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      filteredNodes.map((n) => ({
        ...n,
        type: 'custom',
      })),
      filteredEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [graphData, searchQuery, languageFilter, roleFilter, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.data as ReactFlowNodeData);
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
          onNodesChange={onNodesChange as OnNodesChange<Node>}
          onEdgesChange={onEdgesChange as OnEdgesChange<Edge>}
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
              const data = node.data as ReactFlowNodeData;
              return roleColors[data.role] || '#6b7280';
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
