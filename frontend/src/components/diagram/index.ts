// Components
export { default as NestedFolderNode } from './NestedFolderNode';
export { default as NestedFileNode } from './NestedFileNode';

export type { NestedFolderNodeType } from './NestedFolderNode';
export type { NestedFileNodeType } from './NestedFileNode';

// Layout
export { buildNestedNodes, calculateContainerBounds } from './nestedLayout';

// Types
export type {
  NestedFileNodeData,
  NestedFolderNodeData,
  NestedDiagramNode,
  NestedDiagramEdge,
  NestedLayoutConfig,
} from './types';

export { DEFAULT_NESTED_LAYOUT_CONFIG } from './types';

// Constants
export {
  FOLDER_DEPTH_COLORS,
  FOLDER_BORDER_COLORS,
  FOLDER_TEXT_COLORS,
  getDepthColor,
  getDepthBorderColor,
  getDepthTextColor,
  getDepthOpacity,
  getDepthZIndex,
  CONTAINER_PADDING,
  MIN_CONTAINER_SIZE,
  CANVAS_BACKGROUND,
} from './constants';
