/**
 * NestedLayoutGraph - React Flow graph for the Nested Containment layout.
 *
 * This component displays files in a nested folder containment structure
 * with an amber color scheme inspired by CodeCanvas.
 *
 * Features:
 * - Own ReactFlowProvider for isolated state
 * - Nested folder containment visualization
 * - Amber color scheme with depth-based shading
 * - Selection highlighting with dependency visualization
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
  type EdgeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search } from 'lucide-react';

import {
  NestedFolderNode,
  NestedFileNode,
  buildNestedNodes,
  CANVAS_BACKGROUND,
  getDepthColor,
} from '../diagram';
import ImportEdge from '../ImportEdge';
import type {
  ReactFlowNode,
  ReactFlowEdge,
  ReactFlowNodeData,
} from '../../types';
import { roleColors, languageColors } from '../../types';
import type { NestedLayoutGraphProps } from './SharedGraphTypes';
import type { NestedFileNodeData, NestedFolderNodeData } from '../diagram/types';

// Node types for this layout
const nodeTypes: NodeTypes = {
  nestedFolder: NestedFolderNode,
  nestedFile: NestedFileNode,
};

// Edge types
const edgeTypes: EdgeTypes = {
  import: ImportEdge,
};

// Inner component that uses useReactFlow
function NestedLayoutGraphInner({
  graphData,
  searchQuery,
  languageFilter,
  roleFilter,
  onNodeSelect,
  onEdgeClick,
  onPaneClick,
  selectedNodeId,
  selectionSource,
  onLanguageFilterChange,
  onRoleFilterChange,
}: NestedLayoutGraphProps) {
  const { fitView: reactFlowFitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastLayoutRef = useRef<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Apply layout and filters
  useEffect(() => {
    if (!graphData) return;

    // Create a fingerprint of the current filter state
    const filterFingerprint = `${searchQuery}-${languageFilter}-${roleFilter}`;

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

    // Filter edges
    const filteredEdges: Edge[] = (graphData.edges as Edge[]).filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // Convert to ReactFlowNode format for buildNestedNodes
    const nodesForNested: ReactFlowNode[] = filteredNodes.map(node => ({
      id: node.id,
      type: node.type || 'custom',
      position: node.position,
      data: node.data,
    }));

    // Cast edges to the expected type for buildNestedNodes
    const edgesForNested = filteredEdges as unknown as ReactFlowEdge[];
    const nestedResult = buildNestedNodes(nodesForNested, edgesForNested);

    setNodes(nestedResult.nodes as unknown as Node[]);
    setEdges(nestedResult.edges as unknown as Edge[]);
    lastLayoutRef.current = filterFingerprint;
  }, [graphData, searchQuery, languageFilter, roleFilter, setNodes, setEdges]);

  // Handle fitView
  useEffect(() => {
    if (nodes.length === 0) return;

    if (isInitialLoad) {
      setTimeout(() => {
        reactFlowFitView({ padding: 0.1, duration: 200 });
        setIsInitialLoad(false);
      }, 50);
    }
  }, [nodes.length, isInitialLoad, reactFlowFitView]);

  // Highlight edges and connected nodes when a node or edge is selected
  useEffect(() => {
    // No selection at all - reset everything
    if (!selectedNodeId && !selectedEdgeId && !selectedFolderId) {
      // Reset all edges to default style
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...edge,
          style: { stroke: '#92400e', strokeWidth: 1.5 },
          animated: false,
          selected: false,
          markerEnd: {
            type: 'arrowclosed',
            color: '#92400e',
            width: 20,
            height: 20,
          },
        }))
      );
      // Reset all nodes to default style
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          className: '',
        }))
      );
      return;
    }

    // Edge is selected - highlight edge and connected nodes with blue
    if (selectedEdgeId && !selectedNodeId) {
      const highlightColor = '#60a5fa'; // blue-400

      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id === selectedEdgeId) {
            return {
              ...edge,
              selected: true,
              style: {
                stroke: highlightColor,
                strokeWidth: 6,
              },
              markerEnd: {
                type: 'arrowclosed',
                color: highlightColor,
                width: 16,
                height: 16,
              },
            };
          }
          return {
            ...edge,
            selected: false,
            style: {
              stroke: '#92400e',
              strokeWidth: 1.5,
              opacity: 0.3,
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#92400e',
              width: 20,
              height: 20,
            },
          };
        })
      );

      // Highlight connected nodes with blue ring
      setNodes((currentNodes) => {
        const selectedEdge = currentNodes.length > 0
          ? edges.find(e => e.id === selectedEdgeId)
          : null;

        return currentNodes.map((node) => {
          if (selectedEdge && (node.id === selectedEdge.source || node.id === selectedEdge.target)) {
            return {
              ...node,
              className: 'ring-2 ring-blue-400',
            };
          }
          // Keep folder highlighting if a folder is selected
          if (selectedFolderId && node.id === selectedFolderId) {
            return {
              ...node,
              className: 'ring-2 ring-amber-800',
            };
          }
          return {
            ...node,
            className: '',
          };
        });
      });
      return;
    }

    // Folder is selected (but not a file node)
    if (selectedFolderId && !selectedNodeId) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === selectedFolderId) {
            return {
              ...node,
              className: 'ring-2 ring-amber-800',
            };
          }
          return {
            ...node,
            className: '',
          };
        })
      );
      // Reset edges to default
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...edge,
          style: { stroke: '#92400e', strokeWidth: 1.5 },
          animated: false,
          selected: false,
          markerEnd: {
            type: 'arrowclosed',
            color: '#92400e',
            width: 20,
            height: 20,
          },
        }))
      );
      return;
    }

    // File node is selected
    if (!selectedNodeId) return;

    // Determine highlight color based on selection source
    const highlightColor = selectionSource === 'tierlist' ? '#60a5fa' : '#f59e0b'; // blue vs amber
    const ringClass = selectionSource === 'tierlist' ? 'ring-4 ring-blue-400' : 'ring-2 ring-amber-500';

    // Highlight edges connected to the selected node
    const connectedNodeIds = new Set<string>();

    setEdges((currentEdges) => {
      currentEdges.forEach((edge) => {
        if (edge.source === selectedNodeId) {
          connectedNodeIds.add(edge.target);
        }
        if (edge.target === selectedNodeId) {
          connectedNodeIds.add(edge.source);
        }
      });

      return currentEdges.map((edge) => {
        const isConnected =
          edge.source === selectedNodeId || edge.target === selectedNodeId;

        if (isConnected) {
          return {
            ...edge,
            style: {
              stroke: highlightColor,
              strokeWidth: 6,
              strokeDasharray: '15, 15',
            },
            markerEnd: {
              type: 'arrowclosed',
              color: highlightColor,
              width: 14,
              height: 14,
            },
          };
        }

        return {
          ...edge,
          style: {
            stroke: '#92400e',
            strokeWidth: 1.5,
            opacity: 0.3,
          },
          animated: false,
          markerEnd: {
            type: 'arrowclosed',
            color: '#92400e',
            width: 20,
            height: 20,
          },
        };
      });
    });

    // Highlight connected nodes
    const selectedNodeClass = selectionSource === 'tierlist'
      ? 'ring-4 ring-blue-500 scale-[1.05]'
      : 'ring-2 ring-amber-600';

    setTimeout(() => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === selectedNodeId) {
            return {
              ...node,
              className: selectedNodeClass,
            };
          }
          if (connectedNodeIds.has(node.id)) {
            return {
              ...node,
              className: ringClass,
            };
          }
          return {
            ...node,
            className: '',
          };
        })
      );
    }, 0);
  }, [selectedNodeId, selectedEdgeId, selectedFolderId, selectionSource, edges, setEdges, setNodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'nestedFile') {
        const data = node.data as NestedFileNodeData;
        // Convert NestedFileNodeData back to ReactFlowNodeData format
        const nodeData: ReactFlowNodeData = {
          label: data.label,
          path: data.path,
          folder: data.folder,
          language: data.language,
          role: data.role,
          description: data.description,
          category: data.category,
          imports: data.imports,
          size_bytes: data.sizeBytes,
          line_count: data.lineCount,
        };
        // Clear folder/edge selection when clicking a file
        setSelectedFolderId(null);
        setSelectedEdgeId(null);
        onNodeSelect(node.id, nodeData);
      } else if (node.type === 'nestedFolder') {
        // Highlight folder on click
        setSelectedFolderId(node.id);
        setSelectedEdgeId(null);
      }
    },
    [onNodeSelect]
  );

  // Handle edge click
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      // Highlight the clicked edge and connected nodes
      setSelectedEdgeId(edge.id);
      setSelectedFolderId(null);
      onEdgeClick?.(edge, { x: event.clientX, y: event.clientY });
    },
    [onEdgeClick]
  );

  // Handle pane click - clear all local selections
  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    setSelectedFolderId(null);
    onPaneClick();
  }, [onPaneClick]);

  // Get unique languages and roles for display
  const availableLanguages = useMemo(() => {
    if (!graphData) return [];
    return [...new Set(graphData.nodes.map((n) => n.data.language))];
  }, [graphData]);

  const availableRoles = useMemo(() => {
    if (!graphData) return [];
    return [...new Set(graphData.nodes.map((n) => n.data.role))];
  }, [graphData]);

  // Count file nodes
  const fileNodeCount = useMemo(() => {
    return nodes.filter(n => n.type === 'nestedFile').length;
  }, [nodes]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={[2]}
        panActivationKeyCode={['Space', 'Meta']}
        onPaneContextMenu={(e) => e.preventDefault()}
        onNodeContextMenu={(e) => e.preventDefault()}
        onEdgeContextMenu={(e) => e.preventDefault()}
        style={{ background: CANVAS_BACKGROUND }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'import',
          animated: false,
          style: { stroke: '#92400e', strokeWidth: 1.5 },
        }}
        onError={(code, message) => {
          // Suppress handle-not-found warnings (error code 008)
          if (code === '008') return;
          console.warn(`[React Flow]: ${message}`);
        }}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'nestedFolder') {
              const data = node.data as NestedFolderNodeData | undefined;
              return getDepthColor(data?.depth ?? 0);
            }
            const data = node.data as NestedFileNodeData | undefined;
            return data?.role ? roleColors[data.role] : '#92400e';
          }}
          maskColor="rgba(254, 243, 199, 0.6)"
          className="!bg-amber-50 !border-amber-300"
        />

        {/* Filters Panel */}
        <Panel position="top-left" className="!m-4">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3 w-52 shadow-lg">
            {/* Search */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-600"
              />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                readOnly
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-amber-300 rounded text-sm text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            {/* Language Filter */}
            <div>
              <label className="text-xs text-amber-700 uppercase tracking-wide mb-1 block">
                Language
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => onLanguageFilterChange?.('all')}
                  className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                    languageFilter === 'all'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  All
                </button>
                {availableLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => onLanguageFilterChange?.(lang)}
                    className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                      languageFilter === lang
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
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
              <label className="text-xs text-amber-700 uppercase tracking-wide mb-1 block">
                Role
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                <button
                  onClick={() => onRoleFilterChange?.('all')}
                  className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                    roleFilter === 'all'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  All
                </button>
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => onRoleFilterChange?.(role)}
                    className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                      roleFilter === role
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
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
            <div className="text-xs text-amber-700 pt-2 border-t border-amber-300">
              Showing {fileNodeCount} of {graphData.nodes.length} files
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// Main component wrapped with ReactFlowProvider
export default function NestedLayoutGraph(props: NestedLayoutGraphProps) {
  return (
    <ReactFlowProvider>
      <NestedLayoutGraphInner {...props} />
    </ReactFlowProvider>
  );
}
