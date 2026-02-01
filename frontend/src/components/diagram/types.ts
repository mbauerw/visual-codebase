/**
 * Type definitions for the Nested Containment Diagram visualization.
 */

import type { Node, Edge } from '@xyflow/react';
import type {
  Language,
  ArchitecturalRole,
  Category,
  ReactFlowEdgeData
} from '../../types';

// =============================================================================
// File Node Types
// =============================================================================

/**
 * Data payload for a file node in the nested diagram.
 */
export interface NestedFileNodeData extends Record<string, unknown> {
  /** Display name (typically the file name without path) */
  label: string;
  /** Full file path relative to repository root */
  path: string;
  /** Parent folder path */
  folder: string;
  /** Programming language detected for this file */
  language: Language;
  /** Architectural role assigned by LLM analysis */
  role: ArchitecturalRole;
  /** Brief description of the file's purpose */
  description: string;
  /** High-level category (frontend, backend, etc.) */
  category: Category;
  /** List of import paths this file depends on */
  imports: string[];
  /** File size in bytes */
  sizeBytes: number;
  /** Number of lines in the file */
  lineCount: number;
  /** Nesting depth within folder hierarchy (0 = root level) */
  depth: number;
}

/**
 * React Flow node type for file nodes in nested diagram.
 */
export type NestedFileNode = Node<NestedFileNodeData, 'nestedFile'>;

// =============================================================================
// Folder Container Node Types
// =============================================================================

/**
 * Data payload for folder container nodes.
 */
export interface NestedFolderNodeData extends Record<string, unknown> {
  /** Folder name (not full path) */
  label: string;
  /** Full folder path relative to repository root */
  path: string;
  /** Parent folder path (empty string for root) */
  parentPath: string;
  /** Calculated width to contain all children */
  width: number;
  /** Calculated height to contain all children */
  height: number;
  /** Number of direct and indirect file children */
  fileCount: number;
  /** Nesting depth (0 = top-level folder) */
  depth: number;
  /** Whether this folder is expanded (showing contents) */
  isExpanded: boolean;
  /** Category derived from contained files */
  category: Category;
}

/**
 * React Flow node type for folder container nodes.
 */
export type NestedFolderNode = Node<NestedFolderNodeData, 'nestedFolder'>;

// =============================================================================
// Union Types
// =============================================================================

export type NestedDiagramNode = NestedFileNode | NestedFolderNode;
export type NestedDiagramEdge = Edge<ReactFlowEdgeData & Record<string, unknown>>;

// =============================================================================
// Layout Configuration
// =============================================================================

export interface NestedLayoutConfig {
  /** Padding inside folder containers (around children) */
  containerPadding: number;
  /** Height reserved for folder header/label */
  headerHeight: number;
  /** Horizontal gap between sibling items */
  itemGapX: number;
  /** Vertical gap between rows of children */
  itemGapY: number;
  /** Maximum items per row in grid layout */
  maxItemsPerRow: number;
  /** Base width for file nodes */
  fileNodeWidth: number;
  /** Base height for file nodes */
  fileNodeHeight: number;
  /** Minimum container width */
  minContainerWidth: number;
  /** Minimum container height */
  minContainerHeight: number;
  /** Gap between top-level folder groups */
  topLevelGap: number;
}

export const DEFAULT_NESTED_LAYOUT_CONFIG: NestedLayoutConfig = {
  containerPadding: 24,
  headerHeight: 45,
  itemGapX: 20,
  itemGapY: 20,
  maxItemsPerRow: 3, // Fewer columns for more vertical layout
  fileNodeWidth: 150,
  fileNodeHeight: 60,
  minContainerWidth: 200,
  minContainerHeight: 120,
  topLevelGap: 60, // Stack top-level folders vertically with this gap
};
