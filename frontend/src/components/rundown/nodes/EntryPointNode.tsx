import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EntryPointNode as EntryPointNodeType } from '../layoutUtils';

export default function EntryPointNode({
  data,
}: NodeProps<EntryPointNodeType>) {
  return (
    <div className="bg-emerald-100 border-2 border-emerald-400 text-emerald-800 rounded-full px-4 py-2 text-center shadow-sm">
      <span className="text-xs font-semibold whitespace-nowrap">
        {data.label}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !border-emerald-700 !w-2 !h-2 !border"
      />
    </div>
  );
}
