/**
 * RoleLayoutGraph - React Flow graph for the Role-based layout.
 *
 * This component displays files grouped by architectural role in a circular
 * arrangement, with Frontend/Backend category backgrounds.
 *
 * Features:
 * - Own ReactFlowProvider for isolated state
 * - Role-based grouping with tree layout inside each role
 * - Category background sections (Frontend/Backend)
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
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search } from 'lucide-react';

import CustomNode, { type CustomNodeType } from '../CustomNode';
import CategoryNode, { type CategoryNodeType, type CategoryNodeData } from '../CategoryNode';
import ImportEdge from '../ImportEdge';
import CategoryBackground, { type CategorySection } from '../Categorybackground';
import type {
  ReactFlowNodeData,
  ArchitecturalRole,
  Category,
} from '../../types';
import { roleColors, languageColors, categoryColors, roleLabels } from '../../types';
import type { RoleLayoutGraphProps } from './SharedGraphTypes';
import { GRAPH_BACKGROUNDS } from './SharedGraphTypes';

// Node types for this layout
const nodeTypes: NodeTypes = {
  custom: CustomNode,
  category: CategoryNode,
};

// Edge types
const edgeTypes: EdgeTypes = {
  import: ImportEdge,
};

// Combined node type
type AllNodeTypes = CustomNodeType | CategoryNodeType;

// Layout constants
const nodeWidth = 220;
const nodeHeight = 90;
const nodeGapX = 120; // Horizontal gap between nodes
const nodeGapY = 55; // Vertical gap between nodes
const rolePadding = 45;
const roleHeaderHeight = 55;

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

/**
 * Calculate rectangular grid dimensions for a given node count.
 * Constraint: rows (height) is always 2 more than cols (width).
 * Examples: 1x3, 2x4, 3x5, 4x6, 5x7, etc.
 */
function calculateGridDimensions(nodeCount: number): { cols: number; rows: number } {
  if (nodeCount === 0) {
    return { cols: 0, rows: 0 };
  }

  if (nodeCount === 1) {
    return { cols: 1, rows: 1 };
  }

  if (nodeCount === 2) {
    return { cols: 2, rows: 1 };
  }
  // Find the smallest grid where:
  // - cols * rows >= nodeCount
  // - rows = cols + 2
  let cols = 1;
  while (true) {
    const rows = cols + 2;
    if (cols * rows >= nodeCount) {
      return { cols, rows };
    }
    cols++;
  }
}

/**
 * Calculate positions for nodes in a rectangular grid layout.
 * Returns positions with row and col indices.
 */
function getRectangularPositions(nodeCount: number): { row: number; col: number; totalCols: number; totalRows: number }[] {
  const { cols, rows } = calculateGridDimensions(nodeCount);
  const positions: { row: number; col: number; totalCols: number; totalRows: number }[] = [];

  let nodeIndex = 0;
  for (let row = 0; row < rows && nodeIndex < nodeCount; row++) {
    for (let col = 0; col < cols && nodeIndex < nodeCount; col++) {
      positions.push({ row, col, totalCols: cols, totalRows: rows });
      nodeIndex++;
    }
  }

  return positions;
}

/**
 * Calculate dimensions for a role category with rectangular grid layout.
 */
function calculateRectangularRoleDimensions(nodeCount: number): { width: number; height: number; rows: number; maxCols: number } {
  if (nodeCount === 0) {
    return { width: 250, height: 150, rows: 0, maxCols: 0 };
  }

  const { cols, rows } = calculateGridDimensions(nodeCount);

  const width = cols * (nodeWidth + nodeGapX) - nodeGapX + rolePadding * 2;
  const height = roleHeaderHeight + rows * (nodeHeight + nodeGapY) - nodeGapY + rolePadding;

  return {
    width: Math.max(width, 300),
    height: Math.max(height, 180),
    rows,
    maxCols: cols,
  };
}

// Layout interface for return type
interface LayoutResult {
  nodes: AllNodeTypes[];
  edges: Edge[];
  categorySections: CategorySection[];
}

// Custom layout that creates nested category hierarchy
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

  // Layout role categories in a circular pattern
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
    const roleDimensions = roleGroups.map((rg) => calculateRectangularRoleDimensions(rg.nodes.length));
    const maxRoleWidth = Math.max(...roleDimensions.map((d) => d.width));
    const maxRoleHeight = Math.max(...roleDimensions.map((d) => d.height));

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

    // Calculate center position
    const centerX = offsetX + circleRadius;
    const centerY = circleRadius;
    const placementRadius = circleRadius - maxRoleHeight / 2 - 200;

    roleGroups.forEach((roleGroup, index) => {
      const dims = roleDimensions[index];
      const roleCategoryId = `${categoryId}-${roleGroup.role}`;

      // Calculate position on the circle
      let x: number, y: number;

      if (numRoles === 1) {
        x = centerX - dims.width / 2;
        y = centerY - dims.height / 2;
      } else {
        const angle = (index / numRoles) * 2 * Math.PI - Math.PI / 2;
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
        draggable: true,
        selectable: true,
      };
      roleCategoryNodes.push(roleCategoryNode);

      // Position file nodes in rectangular grid pattern
      const gridPositions = getRectangularPositions(roleGroup.nodes.length);
      const containerCenterX = dims.width / 2;

      roleGroup.nodes.forEach((node, nodeIndex) => {
        const pos = gridPositions[nodeIndex];

        // Calculate how many nodes are in this row (last row may have fewer)
        const nodesInThisRow = pos.row === pos.totalRows - 1
          ? roleGroup.nodes.length - (pos.totalRows - 1) * pos.totalCols
          : pos.totalCols;

        // Center each row
        const rowWidth = nodesInThisRow * nodeWidth + (nodesInThisRow - 1) * nodeGapX;
        const rowStartX = containerCenterX - rowWidth / 2;

        // Calculate position within the row
        const colInRow = pos.row === pos.totalRows - 1
          ? nodeIndex - (pos.totalRows - 1) * pos.totalCols
          : pos.col;

        const nodeX = rowStartX + colInRow * (nodeWidth + nodeGapX);
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

  // Layout frontend categories
  const frontendLayout = layoutRoleCategoriesInCircle(
    frontendRoleGroups,
    'frontend',
    'frontend',
    50
  );

  // Layout backend categories
  const frontendWidth = frontendLayout.circleRadius;
  const backendLayout = layoutRoleCategoriesInCircle(
    backendRoleGroups,
    'backend',
    'backend',
    frontendWidth + 50
  );

  // Calculate total node counts
  const frontendNodeCount = frontendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);
  const backendNodeCount = backendRoleGroups.reduce((sum, rg) => sum + rg.nodes.length, 0);

  // Create category sections for the background
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

  // Combine all nodes
  const allNodes: AllNodeTypes[] = [
    ...frontendLayout.roleCategoryNodes,
    ...backendLayout.roleCategoryNodes,
    ...frontendLayout.fileNodes,
    ...backendLayout.fileNodes,
  ];

  return { nodes: allNodes, edges, categorySections };
}

// Inner component that uses useReactFlow
function RoleLayoutGraphInner({
  graphData,
  searchQuery,
  languageFilter,
  roleFilter,
  onNodeSelect,
  onCategorySelect,
  onEdgeClick,
  onPaneClick,
  selectedNodeId,
  selectionSource,
}: RoleLayoutGraphProps) {
  const { fitView: reactFlowFitView, getViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeTypes>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [categorySections, setCategorySections] = useState<CategorySection[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastLayoutRef = useRef<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

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

    // Convert to CustomNodeType format
    const fileNodesForLayout: CustomNodeType[] = filteredNodes.map((n) => ({
      id: n.id,
      type: 'custom' as const,
      position: n.position,
      data: n.data,
    }));

    // Apply layout
    const layoutResult = getNestedCategoryLayout(fileNodesForLayout, filteredEdges);

    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
    setCategorySections(layoutResult.categorySections);
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
    if (!selectedNodeId && !selectedEdgeId) {
      // Reset all edges to default style
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...edge,
          style: { stroke: '#475569', strokeWidth: 1.5 },
          animated: false,
          selected: false,
          markerEnd: {
            type: 'arrowclosed',
            color: '#475569',
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
              stroke: '#475569',
              strokeWidth: 1.5,
              opacity: 0.3,
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#475569',
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
          return {
            ...node,
            className: '',
          };
        });
      });
      return;
    }

    // File node is selected
    if (!selectedNodeId) return;

    // Determine highlight color based on selection source
    const highlightColor = selectionSource === 'tierlist' ? '#60a5fa' : '#fbbf24';
    const ringClass = selectionSource === 'tierlist' ? 'ring-4 ring-blue-400' : 'ring-2 ring-amber-400';

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
              strokeWidth: 8,
              strokeDasharray: '20, 20',
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
            stroke: '#475569',
            strokeWidth: 1.5,
            opacity: 0.3,
            strokeDasharray: '20, 20',
          },
          animated: false,
          markerEnd: {
            type: 'arrowclosed',
            color: '#475569',
            width: 20,
            height: 20,
          },
        };
      });
    });

    // Highlight connected nodes
    const selectedNodeClass = selectionSource === 'tierlist'
      ? 'ring-8 ring-blue-500 scale-[1.1]'
      : 'ring-2 ring-amber-500';

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
  }, [selectedNodeId, selectedEdgeId, selectionSource, edges, setEdges, setNodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Clear edge selection when clicking a node
      setSelectedEdgeId(null);

      if (node.type === 'custom') {
        const nodeData = node.data as ReactFlowNodeData;
        onNodeSelect(node.id, nodeData);
      }
      if (node.type === 'category') {
        const catData = node.data as CategoryNodeData;
        // Get files for this role from graphData
        const roleFiles = graphData?.nodes
          .filter(n => n.data.role === catData.role)
          .map(n => n.data) || [];

        onCategorySelect({
          label: catData.label,
          role: catData.role!,
          nodeCount: catData.nodeCount,
          description: '',
          files: roleFiles,
        });
      }
    },
    [graphData, onNodeSelect, onCategorySelect]
  );

  // Handle edge click
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      // Highlight the clicked edge and connected nodes
      setSelectedEdgeId(edge.id);
      onEdgeClick?.(edge, { x: event.clientX, y: event.clientY });
    },
    [onEdgeClick]
  );

  // Handle pane click - clear all local selections
  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    onPaneClick();
  }, [onPaneClick]);

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

  // Count file nodes
  const fileNodeCount = useMemo(() => {
    return nodes.filter(n => n.type === 'custom').length;
  }, [nodes]);

  return (
    <div className="w-full h-full relative">
      {/* Category background */}
      <CategoryBackground
        sections={categorySections}
        transform={viewport}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onMove={onMove}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        style={{ background: GRAPH_BACKGROUNDS.role }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'import',
          animated: false,
          style: { stroke: '#475569', strokeWidth: 1.5 },
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
                readOnly
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Language Filter */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                Language
              </label>
              <div className="flex flex-wrap gap-1">
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    languageFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  All
                </span>
                {availableLanguages.map((lang) => (
                  <span
                    key={lang}
                    className={`px-2 py-1 text-xs rounded ${
                      languageFilter === lang
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                    style={{
                      borderLeft: `2px solid ${languageColors[lang]}`,
                    }}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
            {/* Role Filter */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                Role
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    roleFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  All
                </span>
                {availableRoles.map((role) => (
                  <span
                    key={role}
                    className={`px-2 py-1 text-xs rounded ${
                      roleFilter === role
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                    style={{
                      borderLeft: `2px solid ${roleColors[role]}`,
                    }}
                  >
                    {role.replace('_', ' ')}
                  </span>
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
  );
}

// Main component wrapped with ReactFlowProvider
export default function RoleLayoutGraph(props: RoleLayoutGraphProps) {
  return (
    <ReactFlowProvider>
      <RoleLayoutGraphInner {...props} />
    </ReactFlowProvider>
  );
}
