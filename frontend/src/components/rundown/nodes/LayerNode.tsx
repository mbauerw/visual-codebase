import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { LayerNode as LayerNodeType } from '../layoutUtils';

export default function LayerNode({ data }: NodeProps<LayerNodeType>) {
  return (
    <div
      className="rounded-lg border-2 px-4 py-3 transition-opacity"
      style={{
        minWidth: 600,
        backgroundColor: data.isActive ? data.colorBg : '#f8fafc',
        borderColor: data.isActive ? data.colorBorder : '#e2e8f0',
        opacity: data.isActive ? 1 : 0.4,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-4 !h-1"
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold"
            style={{ color: data.isActive ? data.colorText : '#94a3b8' }}
          >
            {data.label}
          </div>

          {data.isActive && data.action && (
            <p className="text-sm text-slate-600 mt-0.5 italic">
              {data.action}
            </p>
          )}
        </div>

        {data.isActive && data.keyFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end shrink-0">
            {data.keyFiles.map((file) => (
              <span
                key={file}
                className="font-mono text-xs text-slate-500 bg-white/60 px-1.5 py-0.5 rounded"
              >
                {file}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-4 !h-1"
      />
    </div>
  );
}
