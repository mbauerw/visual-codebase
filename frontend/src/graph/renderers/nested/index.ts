/**
 * Nested (folder) layout node renderers (ports of the former React Flow NestedFileNode / NestedFolderNode).
 */

import type { NodeRendererRegistry } from '../../core/types';
import { NestedFileNode } from './NestedFileNode';
import { NestedFolderNode } from './NestedFolderNode';

export { NestedFileNode, getCompactRoleLabel, getLanguageAbbreviation } from './NestedFileNode';
export { NestedFolderNode } from './NestedFolderNode';

export const nestedRenderers: NodeRendererRegistry = {
  file: NestedFileNode,
  folder: NestedFolderNode,
};
