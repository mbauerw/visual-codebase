/**
 * Shared type definitions for graph layout components.
 * These interfaces define the common props and data structures
 * used by RoleLayoutGraph and NestedLayoutGraph.
 */

import type { Edge } from '@xyflow/react';
import type {
  ReactFlowGraph,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
} from '../../types';
import type { CategoryRoleData } from '../CategoryNode';

/**
 * Base props shared by all graph layout components.
 */
export interface BaseGraphProps {
  /** The analysis graph data from the API */
  graphData: ReactFlowGraph;
  /** Current search query for filtering nodes */
  searchQuery: string;
  /** Language filter ('all' or specific language) */
  languageFilter: Language | 'all';
  /** Role filter ('all' or specific role) */
  roleFilter: ArchitecturalRole | 'all';
  /** Callback when a file node is selected */
  onNodeSelect: (nodeId: string, nodeData: ReactFlowNodeData) => void;
  /** Callback when a category node is selected (role layout only) */
  onCategorySelect?: (categoryData: CategoryRoleData) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edge: Edge, position: { x: number; y: number }) => void;
  /** Callback when clicking on the pane (deselects) */
  onPaneClick: () => void;
  /** Currently selected node ID for highlighting */
  selectedNodeId: string | null;
  /** Source of the selection (for styling differences) */
  selectionSource: 'node' | 'tierlist' | null;
}

/**
 * Props specific to the Role Layout graph.
 * This layout groups files by architectural role in a circular arrangement
 * with Frontend/Backend category backgrounds.
 */
export interface RoleLayoutGraphProps extends BaseGraphProps {
  /** Callback when a category node is selected */
  onCategorySelect: (categoryData: CategoryRoleData) => void;
}

/**
 * Props specific to the Nested Layout graph.
 * This layout shows files in a nested folder containment structure
 * with amber color scheme.
 */
export interface NestedLayoutGraphProps extends BaseGraphProps {
  // Nested layout currently uses the same base props
  // Add nested-specific props here if needed in the future
}

/**
 * Common constants for graph backgrounds
 */
export const GRAPH_BACKGROUNDS = {
  role: '#111a31',
  nested: '#fffbeb', // amber-50 (CANVAS_BACKGROUND)
} as const;
