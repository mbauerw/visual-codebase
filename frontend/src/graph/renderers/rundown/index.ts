/**
 * Rundown flow diagram node renderers (ports of the former React Flow LayerNode / EntryPointNode).
 *
 * Kind mapping (see components/rundown/layoutUtils.ts):
 *   'category' → RundownLayerNode       (architecture layer box)
 *   'file'     → RundownEntryPointNode  (entry-point pill)
 */

import type { NodeRendererRegistry } from '../../core/types';
import { RundownLayerNode } from './RundownLayerNode';
import { RundownEntryPointNode } from './RundownEntryPointNode';

export { RundownLayerNode } from './RundownLayerNode';
export { RundownEntryPointNode } from './RundownEntryPointNode';

export const rundownRenderers: NodeRendererRegistry = {
  category: RundownLayerNode,
  file: RundownEntryPointNode,
};
