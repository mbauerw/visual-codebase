/**
 * RundownEntryPointNode — an entry-point file pill at the top of the rundown
 * flow diagram (port of the former React Flow
 * `components/rundown/nodes/EntryPointNode.tsx`, minus the Handle: the edge
 * leaves from the slot's bottom edge, see theme/rundownTheme.ts anchors).
 */

import type { NodeRenderProps } from '../../core/types';
import type { EntryPointNodeData } from '../../../components/rundown/layoutUtils';

export function RundownEntryPointNode({ node }: NodeRenderProps<EntryPointNodeData>) {
  const data = node.data;
  return (
    <div
      data-testid="rundown-entry-point-node"
      className="w-full h-full bg-emerald-100 border-2 border-emerald-400 text-emerald-800 rounded-full px-4 py-2 flex items-center justify-center shadow-sm"
      title={data.filePath}
    >
      <span className="text-xs font-semibold whitespace-nowrap truncate">
        {data.label}
      </span>
    </div>
  );
}

export default RundownEntryPointNode;
